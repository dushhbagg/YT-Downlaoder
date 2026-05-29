import os
import sys
import json
# Insert current directory into Python search path to resolve imports on Render
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import tempfile
import static_ffmpeg

# Import modular components
import youtube_extractor
import download_manager

app = Flask(__name__)
# Enable CORS for frontend cross-origin requests
CORS(app)

# Automatically download and register static ffmpeg and ffprobe in PATH
static_ffmpeg.add_paths(weak=True)

def get_video_url():
    """Extract and validate the YouTube video URL from query parameters."""
    video_url = (request.args.get('url') or '').strip()
    if not video_url or not video_url.startswith(('http://', 'https://')):
        return None
    return video_url

def yt_dlp_base_opts():
    """Generates the base options structure for yt-dlp including cookie loading."""
    cookies_path = os.path.join(os.path.dirname(__file__), 'cookies.txt')
    exists = os.path.exists(cookies_path)
    
    opts = {
        'quiet': True,
        'no_warnings': True,
        'noplaylist': True,
        'retries': 3,
        'fragment_retries': 3,
        'extractor_retries': 3,
        'socket_timeout': 20,
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'ios']
            }
        },
    }
    
    if exists:
        opts['cookiefile'] = cookies_path
        
    return opts

@app.route('/info', methods=['GET'])
def get_info():
    """Returns detailed metadata and categorized download options for a YouTube video URL."""
    video_url = get_video_url()
    if not video_url:
        return jsonify({'error': 'Valid HTTP URL required'}), 400

    # 1. Primary attempt: Query with cookies enabled
    try:
        details = youtube_extractor.extract_video_details(video_url, yt_dlp_base_opts())
        return jsonify(details)
    except Exception as e:
        print("Primary info fetch failed, attempting self-healing anonymous fallback... Error details:", str(e))
        
        # 2. Fallback attempt: Strip cookies and query anonymously using mobile player clients
        try:
            opts = yt_dlp_base_opts()
            if 'cookiefile' in opts:
                del opts['cookiefile']
                
            details = youtube_extractor.extract_video_details(video_url, opts)
            print("Anonymous fallback succeeded!")
            return jsonify(details)
        except Exception as fallback_e:
            print("Anonymous fallback also failed. Error details:", str(fallback_e))
            return jsonify({
                'error': 'Failed to retrieve video info', 
                'details': f"Primary error (with cookies): {str(e)}. Fallback error (anonymous): {str(fallback_e)}"
            }), 500

@app.route('/start_download', methods=['GET'])
def start_download():
    """Spawns a multithreaded download process for the requested format combination."""
    video_url = get_video_url()
    if not video_url:
        return jsonify({'error': 'Valid HTTP URL required'}), 400

    format_id = request.args.get('format_id', 'best')
    download_type = request.args.get('type', 'video_audio')
    ext = request.args.get('ext', 'mp4')
    
    bitrate_str = request.args.get('bitrate')
    bitrate = int(bitrate_str) if bitrate_str and bitrate_str.isdigit() else None

    try:
        job_id = download_manager.start_download_job(
            url=video_url,
            format_id=format_id,
            download_type=download_type,
            ext=ext,
            base_opts=yt_dlp_base_opts(),
            bitrate=bitrate
        )
        return jsonify({"job_id": job_id})
    except Exception as e:
        print("Start download error:", str(e))
        return jsonify({'error': 'Failed to start download job', 'details': str(e)}), 500

@app.route('/progress', methods=['GET'])
def get_progress():
    """Checks the progress status (speed, percent, ETA, status) of an active background job."""
    job_id = request.args.get('job_id')
    if not job_id:
        return jsonify({'error': 'Job ID required'}), 400
        
    job_data = download_manager.progress_store.get(job_id)
    if not job_data:
        return jsonify({'status': 'not_found', 'error': 'Job not found'}), 404
        
    # Standard format: returns progress details
    # We strip filepath to keep progress response secure and lightweight
    progress_response = {k: v for k, v in job_data.items() if k != 'filepath'}
    return jsonify(progress_response)

@app.route('/cancel', methods=['GET'])
def cancel_download():
    """Flags an active download thread to abort immediately."""
    job_id = request.args.get('job_id')
    if not job_id:
        return jsonify({'error': 'Job ID required'}), 400
        
    success = download_manager.cancel_download_job(job_id)
    if success:
        return jsonify({'success': True, 'message': 'Cancellation requested'})
    return jsonify({'success': False, 'error': 'Job not found or already completed'}), 404

@app.route('/get_file', methods=['GET'])
def get_file():
    """Serves the completed download file to the client browser."""
    job_id = request.args.get('job_id')
    if not job_id:
        return "Job ID required", 400
        
    job_data = download_manager.progress_store.get(job_id)
    if not job_data or job_data.get('status') != 'completed':
        return "File not ready or job not found", 404
    
    filepath = job_data['filepath']
    ext = job_data.get('ext', 'mp4')
    title = job_data.get('title', 'video')
    
    if not os.path.exists(filepath):
        return "File does not exist on disk", 404
        
    return send_file(
        filepath,
        as_attachment=True,
        download_name=f"{title}.{ext}"
    )

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
