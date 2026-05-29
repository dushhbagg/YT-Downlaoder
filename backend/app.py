import os
import sys
import json
import time
import subprocess
import importlib
import urllib.request

# Insert current directory into Python search path to resolve imports on Render
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import tempfile
import static_ffmpeg
import yt_dlp

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

def yt_dlp_base_opts(cookies_source=None):
    """
    Generates the base options structure for yt-dlp including cookie loading,
    browser impersonations, and HTTP user-agent spoofing.
    """
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
        
        # STATE-OF-THE-ART BYPASS: Spoof TLS fingerprints & client signatures (Chrome / Web)
        'impersonate': 'chrome',
        
        # Spoof standard Chrome headers to bypass bot gates
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        },
        
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'ios']
            }
        },
    }
    
    # Configure cookies based on source parameters
    if cookies_source in ['chrome', 'edge', 'firefox', 'safari', 'opera']:
        opts['cookiesfrombrowser'] = (cookies_source, )
    elif cookies_source == 'cookies_txt' or not cookies_source:
        if exists:
            opts['cookiefile'] = cookies_path
            
    return opts

def get_latest_ytdlp_version():
    """Fetches the latest released version of yt-dlp from the PyPI JSON API."""
    try:
        req = urllib.request.Request(
            "https://pypi.org/pypi/yt-dlp/json",
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            return data.get('info', {}).get('version')
    except Exception:
        return None

def validate_and_analyze_cookies():
    """Reads, validates Netscape headers, and extracts active cookie counts & expiry dates."""
    cookies_path = os.path.join(os.path.dirname(__file__), 'cookies.txt')
    if not os.path.exists(cookies_path):
        return {"status": "missing", "message": "No cookies.txt file present."}
    
    try:
        with open(cookies_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        
        # Verify Netscape Header
        has_header = False
        for line in lines[:5]:
            if "Netscape" in line or "cookie" in line.lower() or "haxx.se" in line:
                has_header = True
                break
                
        if not has_header:
            return {"status": "invalid_format", "message": "File is not in Netscape Cookie format."}
        
        valid_cookies_count = 0
        expired_cookies_count = 0
        earliest_expiration = None
        current_time = time.time()
        
        for line in lines:
            if line.startswith('#') or not line.strip():
                continue
            parts = line.strip().split('\t')
            if len(parts) >= 7:
                try:
                    exp = int(parts[4])
                    # 0 represents session cookies that expire on browser exit (treated as active)
                    if exp == 0:
                        valid_cookies_count += 1
                        continue
                    if exp < current_time:
                        expired_cookies_count += 1
                    else:
                        valid_cookies_count += 1
                        if earliest_expiration is None or exp < earliest_expiration:
                            earliest_expiration = exp
                except ValueError:
                    pass
                    
        if valid_cookies_count == 0 and expired_cookies_count > 0:
            return {"status": "expired", "message": "All cookies have expired. Upload fresh cookies."}
        elif valid_cookies_count == 0:
            return {"status": "empty", "message": "No valid cookies parsed."}
            
        import datetime
        expiry_str = "Session Only"
        if earliest_expiration:
            expiry_dt = datetime.datetime.fromtimestamp(earliest_expiration)
            expiry_str = expiry_dt.strftime("%b %d, %Y")
            
        return {
            "status": "active",
            "message": f"Active session with {valid_cookies_count} cookies loaded.",
            "expiry_date": expiry_str,
            "expired_count": expired_cookies_count
        }
    except Exception as e:
        return {"status": "error", "message": f"Failed to parse cookies: {str(e)}"}

# ----------------------------------------------------
# API ENDPOINTS
# ----------------------------------------------------
@app.route('/info', methods=['GET'])
def get_info():
    """Returns detailed metadata and categorized download options for a YouTube video URL."""
    video_url = get_video_url()
    if not video_url:
        return jsonify({'error': 'Valid HTTP URL required'}), 400

    cookies_source = request.args.get('cookies_source', 'cookies_txt')
    opts = yt_dlp_base_opts(cookies_source)

    # 1. Primary attempt: Query with requested cookie configuration
    try:
        details = youtube_extractor.extract_video_details(video_url, opts)
        return jsonify(details)
    except Exception as e:
        print("Primary info fetch failed, attempting self-healing anonymous fallback... Error details:", str(e))
        
        # 2. Fallback attempt: Strip cookies completely and query anonymously using mobile player clients
        try:
            fallback_opts = opts.copy()
            if 'cookiefile' in fallback_opts:
                del fallback_opts['cookiefile']
            if 'cookiesfrombrowser' in fallback_opts:
                del fallback_opts['cookiesfrombrowser']
                
            details = youtube_extractor.extract_video_details(video_url, fallback_opts)
            print("Anonymous fallback succeeded!")
            return jsonify(details)
        except Exception as fallback_e:
            print("Anonymous fallback also failed. Error details:", str(fallback_e))
            
            # Map specific exceptions to user-friendly error messages
            err_msg = str(fallback_e)
            user_friendly = "Failed to parse video info. YouTube blocked the connection."
            if "Sign in" in err_msg:
                user_friendly = "YouTube bot gate triggered. Logged-in session cookies required."
            elif "Incomplete YouTube ID" in err_msg or "Video unavailable" in err_msg:
                user_friendly = "This video is unavailable. Please verify the URL."
            elif "Private video" in err_msg:
                user_friendly = "This is a private video. Cookie credentials are required."
            elif "429" in err_msg:
                user_friendly = "Rate limit reached. Please wait a few seconds and try again."

            return jsonify({
                'error': user_friendly, 
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
    
    cookies_source = request.args.get('cookies_source', 'cookies_txt')
    opts = yt_dlp_base_opts(cookies_source)

    try:
        job_id = download_manager.start_download_job(
            url=video_url,
            format_id=format_id,
            download_type=download_type,
            ext=ext,
            base_opts=opts,
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

# ----------------------------------------------------
# SYSTEM DIAGNOSTICS & SYSTEM UPDATES
# ----------------------------------------------------
@app.route('/diagnostics', methods=['GET'])
def get_diagnostics():
    """Returns comprehensive versioning, authentication validity, and YouTube linkage states."""
    try:
        # Check current version
        current_version = yt_dlp.version.__version__
        latest_version = get_latest_ytdlp_version() or current_version
        update_available = current_version != latest_version
        
        # Check Cookie Status
        cookie_analysis = validate_and_analyze_cookies()
        
        # Check FFmpeg Linkage
        import shutil
        ffmpeg_found = shutil.which("ffmpeg") is not None
        
        # Test Connection to YouTube (Ping check)
        connection_status = "connected"
        connection_message = "Successfully connected to YouTube servers."
        try:
            req = urllib.request.Request(
                "https://www.youtube.com",
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            with urllib.request.urlopen(req, timeout=3) as _:
                pass
        except Exception as conn_err:
            connection_status = "blocked"
            connection_message = f"Failed to reach YouTube: {str(conn_err)}"
            
        return jsonify({
            "yt_dlp_version": current_version,
            "latest_yt_dlp_version": latest_version,
            "update_available": update_available,
            "cookie_status": cookie_analysis,
            "ffmpeg_status": "available" if ffmpeg_found else "missing",
            "connection": {
                "status": connection_status,
                "message": connection_message
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/upload_cookies', methods=['POST'])
def upload_cookies():
    """Accepts cookie file uploads or JSON texts, validates Netscape headers, and overwrites cookies.txt."""
    try:
        cookie_content = ""
        if 'file' in request.files:
            file = request.files['file']
            cookie_content = file.read().decode('utf-8', errors='ignore')
        elif request.is_json:
            data = request.get_json()
            cookie_content = data.get('content', '')
        else:
            cookie_content = request.data.decode('utf-8', errors='ignore')
            
        if not cookie_content.strip():
            return jsonify({"success": False, "error": "Empty cookie content."}), 400
            
        # Perform quick Netscape format header check
        if "Netscape" not in cookie_content and "cookie" not in cookie_content.lower() and "haxx.se" not in cookie_content:
            return jsonify({
                "success": False, 
                "error": "Invalid format. Cookies must be in Netscape HTTP Cookie format."
            }), 400
            
        # Write to cookies.txt file securely
        cookies_path = os.path.join(os.path.dirname(__file__), 'cookies.txt')
        with open(cookies_path, 'w', encoding='utf-8') as f:
            f.write(cookie_content)
            
        # Re-run analysis immediately
        analysis = validate_and_analyze_cookies()
        return jsonify({"success": True, "analysis": analysis})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/update_ytdl', methods=['POST'])
def update_ytdl():
    """Busts dependencies caches on Render by live upgrading the yt-dlp library using subprocess."""
    try:
        print("Initiating live yt-dlp upgrade...")
        process = subprocess.run(
            [sys.executable, "-m", "pip", "install", "--upgrade", "yt-dlp"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=60
        )
        
        if process.returncode == 0:
            # Reload module dynamically in-memory without server restart!
            global yt_dlp
            importlib.reload(yt_dlp)
            new_version = yt_dlp.version.__version__
            return jsonify({
                "success": True, 
                "message": f"Successfully updated yt-dlp to version {new_version}!",
                "version": new_version,
                "stdout": process.stdout
            })
        else:
            return jsonify({
                "success": False, 
                "error": "Pip installation failed.",
                "stderr": process.stderr
            }), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
