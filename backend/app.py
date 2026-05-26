import os
import json
import threading
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import yt_dlp
import tempfile
import uuid
import imageio_ffmpeg

app = Flask(__name__)
CORS(app)

progress_store = {}

def get_video_url():
    video_url = (request.args.get('url') or '').strip()
    if not video_url or not video_url.startswith(('http://', 'https://')):
        return None
    return video_url

def yt_dlp_base_opts():
    cookies_path = os.path.join(os.path.dirname(__file__), 'cookies.txt')
    opts = {
        'quiet': True,
        'no_warnings': True,
        'noplaylist': True,
        'retries': 3,
        'fragment_retries': 3,
        'extractor_retries': 3,
        'socket_timeout': 20,
        'js_runtimes': {
            'quickjs': {}
        },
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'ios']
            }
        },
        'http_headers': {
            'User-Agent': (
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/125.0.0.0 Safari/537.36'
            ),
            'Accept-Language': 'en-US,en;q=0.9',
        },
    }
    
    if os.path.exists(cookies_path):
        opts['cookiefile'] = cookies_path
        
    return opts

@app.route('/info', methods=['GET'])
def get_info():
    video_url = get_video_url()
    if not video_url:
        return jsonify({'error': 'Valid HTTP URL required'}), 400

    ydl_opts = {
        **yt_dlp_base_opts(),
        'skip_download': True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            
            response_data = {
                'title': info.get('title', 'Unknown Title'),
                'thumbnail': info.get('thumbnail', ''),
                'author': info.get('uploader', info.get('channel', 'Unknown Author')),
            }
            return jsonify(response_data)
    except Exception as e:
        print("Info fetch error:", str(e))
        return jsonify({'error': 'Failed to retrieve video info', 'details': str(e)}), 500

@app.route('/start_download', methods=['GET'])
def start_download():
    video_url = get_video_url()
    quality = request.args.get('quality', 'best')
    if not video_url:
        return jsonify({'error': 'Valid HTTP URL required'}), 400

    job_id = uuid.uuid4().hex
    progress_store[job_id] = {'status': 'starting', 'percent': 0}

    def download_thread(j_id, url, q):
        try:
            temp_dir = tempfile.gettempdir()
            output_template = os.path.join(temp_dir, f'yt_{j_id}.%(ext)s')

            format_map = {
                'best': 'bestvideo+bestaudio/best',
                '2160p': 'bestvideo[height<=2160]+bestaudio/best',
                '1440p': 'bestvideo[height<=1440]+bestaudio/best',
                '1080p': 'bestvideo[height<=1080]+bestaudio/best',
                '720p': 'bestvideo[height<=720]+bestaudio/best',
                '480p': 'bestvideo[height<=480]+bestaudio/best',
                'audio': 'bestaudio[ext=m4a]/bestaudio'
            }
            selected_format = format_map.get(q, format_map['best'])

            def progress_hook(d):
                if d['status'] == 'downloading':
                    downloaded = d.get('downloaded_bytes', 0)
                    total = d.get('total_bytes', 0) or d.get('total_bytes_estimate', 0)
                    if total > 0:
                        percent = (downloaded / total) * 100
                        progress_store[j_id]['percent'] = round(percent, 1)
                        progress_store[j_id]['status'] = 'downloading'
                elif d['status'] == 'finished':
                    progress_store[j_id]['status'] = 'extracting' if q == 'audio' else 'merging'

            ydl_opts = {
                **yt_dlp_base_opts(),
                'format': selected_format,
                'outtmpl': output_template,
                'ffmpeg_location': imageio_ffmpeg.get_ffmpeg_exe(),
                'progress_hooks': [progress_hook],
                'concurrent_fragment_downloads': 10
            }

            if q == 'audio':
                ydl_opts['postprocessors'] = [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'm4a',
                }]
            else:
                ydl_opts['merge_output_format'] = 'mkv'

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                
                expected_filename = ydl.prepare_filename(info)
                file_base = os.path.splitext(expected_filename)[0]
                
                # yt-dlp might have output an .mkv or .webm or .mp4 file. Find exactly what it created.
                import glob
                matches = glob.glob(f"{file_base}.*")
                if matches:
                    expected_filename = matches[0]
                
                title = info.get('title', 'video')
                safe_title = "".join(x for x in title if x.isalnum() or x in " -_")
                
                progress_store[j_id]['filepath'] = expected_filename
                progress_store[j_id]['title'] = safe_title
                progress_store[j_id]['status'] = 'completed'

        except Exception as e:
            print("Download error:", str(e))
            progress_store[j_id]['status'] = 'error'
            progress_store[j_id]['error'] = str(e)

    t = threading.Thread(target=download_thread, args=(job_id, video_url, quality))
    t.start()
    
    return jsonify({"job_id": job_id})

@app.route('/progress', methods=['GET'])
def get_progress():
    job_id = request.args.get('job_id')
    return jsonify(progress_store.get(job_id, {'status': 'not_found'}))

@app.route('/get_file', methods=['GET'])
def get_file():
    job_id = request.args.get('job_id')
    data = progress_store.get(job_id)
    if not data or data['status'] != 'completed':
        return "File not ready", 404
    
    filepath = data['filepath']
    ext = os.path.splitext(filepath)[1] or '.mp4'
        
    return send_file(
        filepath,
        as_attachment=True,
        download_name=f"{data['title']}{ext}"
    )

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
