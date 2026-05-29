import os
import threading
import tempfile
import uuid
import glob
import yt_dlp

# Thread-safe in-memory job store
progress_store = {}

class DownloadCancelledException(Exception):
    """Custom exception raised when a user requests cancellation."""
    pass

def cleanup_temp_files(job_id):
    """Deletes temporary files matching the job_id pattern to free disk space."""
    temp_dir = tempfile.gettempdir()
    # Search for all temp files created for this specific job id
    pattern = os.path.join(temp_dir, f"yt_{job_id}*")
    for filepath in glob.glob(pattern):
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception as e:
            print(f"Error cleaning up temp file {filepath}: {str(e)}")

def start_download_job(url, format_id, download_type, ext, base_opts, bitrate=None):
    """
    Spawns a background thread to download the requested YouTube media stream 
    with custom progress reporting, bitrates, and cancellation capabilities.
    """
    job_id = uuid.uuid4().hex
    
    # Initialize job status in memory
    progress_store[job_id] = {
        'status': 'starting',
        'percent': 0,
        'speed': '0 KB/s',
        'eta': 'Calculating...',
        'title': 'Initializing...',
        'cancel_requested': False,
        'error': None
    }
    
    def run_download():
        try:
            temp_dir = tempfile.gettempdir()
            # Define output path matching job ID
            output_template = os.path.join(temp_dir, f'yt_{job_id}.%(ext)s')
            
            def progress_hook(d):
                # CHECK CANCELLATION EXPLICITLY IN HOOK
                if progress_store[job_id].get('cancel_requested'):
                    raise DownloadCancelledException("Download cancelled by user")
                    
                if d['status'] == 'downloading':
                    downloaded = d.get('downloaded_bytes', 0)
                    total = d.get('total_bytes', 0) or d.get('total_bytes_estimate', 0) or 0
                    
                    percent = 0.0
                    if total > 0:
                        percent = round((downloaded / total) * 100, 1)
                        
                    speed_val = d.get('speed')
                    speed_str = "0 KB/s"
                    if speed_val:
                        if speed_val >= 1024 * 1024:
                            speed_str = f"{speed_val / (1024 * 1024):.1f} MB/s"
                        elif speed_val >= 1024:
                            speed_str = f"{speed_val / 1024:.1f} KB/s"
                        else:
                            speed_str = f"{speed_val} B/s"
                            
                    eta_val = d.get('eta')
                    eta_str = "Calculating..."
                    if eta_val is not None:
                        m = eta_val // 60
                        s = eta_val % 60
                        if m > 0:
                            eta_str = f"{m}m {s}s"
                        else:
                            eta_str = f"{s}s"
                            
                    progress_store[job_id].update({
                        'status': 'downloading',
                        'percent': percent,
                        'speed': speed_str,
                        'eta': eta_str
                    })
                elif d['status'] == 'finished':
                    # Update status when entering postprocessor/merger stage
                    if download_type == 'audio_only':
                        progress_store[job_id].update({
                            'status': 'extracting',
                            'percent': 100,
                            'speed': '0 KB/s',
                            'eta': 'Processing...'
                        })
                    elif download_type == 'video_audio':
                        progress_store[job_id].update({
                            'status': 'merging',
                            'percent': 100,
                            'speed': '0 KB/s',
                            'eta': 'Processing...'
                        })
                        
            # Configure custom options for this specific download
            ydl_opts = {
                **base_opts,
                'format': format_id,
                'outtmpl': output_template,
                'progress_hooks': [progress_hook],
                'concurrent_fragment_downloads': 10
            }
            
            # Post processors based on type and extension
            if download_type == 'audio_only':
                if ext == 'mp3':
                    ydl_opts['postprocessors'] = [{
                        'key': 'FFmpegExtractAudio',
                        'preferredcodec': 'mp3',
                        'preferredquality': str(bitrate) if bitrate else '320',
                    }]
                elif ext == 'm4a':
                    ydl_opts['postprocessors'] = [{
                        'key': 'FFmpegExtractAudio',
                        'preferredcodec': 'm4a',
                    }]
            elif download_type == 'video_audio':
                ydl_opts['merge_output_format'] = ext
            elif download_type == 'video_only':
                # Ensure correct format structure is selected
                pass
                
            # Execute yt-dlp extract & download
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                
                # Determine final file location. Note that postprocessors/mergers 
                # might change final extension (e.g. merging to .mp4 or re-encoding to .mp3)
                expected_filename = ydl.prepare_filename(info)
                file_base = os.path.splitext(expected_filename)[0]
                
                matches = glob.glob(f"{file_base}.*")
                if matches:
                    # Prioritize exact extension match
                    matches.sort(key=lambda x: 0 if x.endswith(f".{ext}") else 1)
                    filepath = matches[0]
                else:
                    filepath = expected_filename
                    
                title = info.get('title', 'video')
                safe_title = "".join(x for x in title if x.isalnum() or x in " -_")
                if not safe_title.strip():
                    safe_title = "downloaded_file"
                    
                # Mark job as fully completed
                progress_store[job_id].update({
                    'status': 'completed',
                    'percent': 100,
                    'filepath': filepath,
                    'title': safe_title,
                    'ext': ext or os.path.splitext(filepath)[1].replace('.', '')
                })
                
        except DownloadCancelledException:
            # Handle cancellation graceful exit
            progress_store[job_id].update({
                'status': 'cancelled',
                'error': 'Download cancelled'
            })
            cleanup_temp_files(job_id)
        except Exception as e:
            # Handle errors during download/postprocessing
            progress_store[job_id].update({
                'status': 'error',
                'error': str(e)
            })
            cleanup_temp_files(job_id)
            
    t = threading.Thread(target=run_download)
    t.start()
    return job_id

def cancel_download_job(job_id):
    """Sets a cancel requested flag on the job. The progress hook will abort at next check."""
    if job_id in progress_store:
        progress_store[job_id]['cancel_requested'] = True
        progress_store[job_id]['status'] = 'cancelling'
        return True
    return False
