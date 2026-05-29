import datetime
import yt_dlp

def format_views(views):
    """Format view count into a readable string (e.g. 1.2M views)."""
    if views is None:
        return "Unknown views"
    try:
        views = int(views)
        if views >= 1000000000:
            return f"{views / 1000000000:.1f}B views"
        elif views >= 1000000:
            return f"{views / 1000000:.1f}M views"
        elif views >= 1000:
            return f"{views / 1000:.1f}K views"
        return f"{views} views"
    except Exception:
        return f"{views} views"

def format_upload_date(date_str):
    """Format YouTube YYYYMMDD upload date to standard string (e.g. Nov 10, 2014)."""
    if not date_str:
        return "Unknown date"
    try:
        dt = datetime.datetime.strptime(date_str, "%Y%m%d")
        return dt.strftime("%b %d, %Y")
    except Exception:
        return date_str

def format_duration(seconds):
    """Format duration in seconds to standard format (e.g. HH:MM:SS or MM:SS)."""
    if not seconds:
        return "Unknown"
    try:
        seconds = int(seconds)
        h = seconds // 3600
        m = (seconds % 3600) // 60
        s = seconds % 60
        if h > 0:
            return f"{h}:{m:02d}:{s:02d}"
        return f"{m}:{s:02d}"
    except Exception:
        return "Unknown"

def extract_video_details(url, base_opts):
    """
    Extracts video metadata and filters available formats to construct a list of 
    structured download options with estimated file sizes.
    """
    ydl_opts = {
        **base_opts,
        'skip_download': True,
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        
        duration = info.get('duration', 0) or 0
        title = info.get('title', 'Unknown Title')
        
        # Parse formats list
        raw_formats = info.get('formats', [])
        
        # Separate audio and video streams
        video_streams = []
        audio_streams = []
        
        for f in raw_formats:
            # We skip storyboards/mhtml
            if f.get('ext') == 'mhtml' or f.get('format_note') == 'storyboard':
                continue
                
            vcodec = f.get('vcodec', 'none')
            acodec = f.get('acodec', 'none')
            
            is_video = vcodec != 'none' and vcodec is not None
            is_audio = acodec != 'none' and acodec is not None
            
            if is_video:
                video_streams.append(f)
            elif is_audio:
                audio_streams.append(f)
                
        # Find best audio-only streams
        best_mp4_audio = None # usually m4a (AAC)
        best_webm_audio = None # usually webm (Opus)
        best_overall_audio = None
        
        for a in audio_streams:
            ext = a.get('ext', '')
            abr = a.get('abr', 0) or a.get('tbr', 0) or 0
            
            # overall best audio
            if not best_overall_audio or abr > (best_overall_audio.get('abr', 0) or best_overall_audio.get('tbr', 0) or 0):
                best_overall_audio = a
                
            if ext in ['m4a', 'mp4']:
                if not best_mp4_audio or abr > (best_mp4_audio.get('abr', 0) or best_mp4_audio.get('tbr', 0) or 0):
                    best_mp4_audio = a
            elif ext in ['webm', 'ogg']:
                if not best_webm_audio or abr > (best_webm_audio.get('abr', 0) or best_webm_audio.get('tbr', 0) or 0):
                    best_webm_audio = a
                    
        # If specific container best audio is not found, fallback to overall
        if not best_mp4_audio:
            best_mp4_audio = best_overall_audio
        if not best_webm_audio:
            best_webm_audio = best_overall_audio
            
        options = []
        
        # Let's map target resolutions
        target_heights = [144, 240, 360, 480, 720, 1080, 1440, 2160]
        
        # 1. VIDEO + AUDIO MERGED OPTIONS
        for h in target_heights:
            for ext in ['mp4', 'webm']:
                # Find best video stream at height h and container ext
                matching_videos = [v for v in video_streams if v.get('height') == h and v.get('ext') == ext]
                if not matching_videos:
                    continue
                    
                # Get the best matching video by bitrate/fps
                best_v = max(matching_videos, key=lambda x: (x.get('tbr', 0) or 0, x.get('fps', 30) or 30))
                
                # Pick audio for merge
                selected_audio = best_webm_audio if ext == 'webm' else best_mp4_audio
                
                # Size calculation
                v_size = best_v.get('filesize') or best_v.get('filesize_approx')
                if not v_size and best_v.get('tbr') and duration:
                    v_size = int(best_v.get('tbr') * 1000 * duration / 8)
                    
                a_size = 0
                a_id = ""
                if selected_audio:
                    a_id = selected_audio.get('format_id', '')
                    a_size = selected_audio.get('filesize') or selected_audio.get('filesize_approx')
                    if not a_size and selected_audio.get('tbr') and duration:
                        a_size = int(selected_audio.get('tbr') * 1000 * duration / 8)
                        
                total_size = (v_size or 0) + (a_size or 0)
                
                # If this format already has both audio and video, we don't need to specify separate audio
                if best_v.get('acodec') != 'none' and best_v.get('acodec') is not None:
                    format_id = best_v.get('format_id')
                    total_size = best_v.get('filesize') or best_v.get('filesize_approx') or total_size
                else:
                    if a_id:
                        format_id = f"{best_v.get('format_id')}+{a_id}"
                    else:
                        format_id = best_v.get('format_id')
                
                fps = best_v.get('fps')
                fps_str = f" {int(fps)}fps" if fps and fps > 30 else ""
                res_label = f"{h}p{fps_str}"
                if h == 2160:
                    res_label = f"4K Ultra HD ({h}p{fps_str})"
                elif h == 1440:
                    res_label = f"2K Quad HD ({h}p{fps_str})"
                elif h == 1080:
                    res_label = f"Full HD ({h}p{fps_str})"
                elif h == 720:
                    res_label = f"HD ({h}p{fps_str})"
                
                options.append({
                    'type': 'video_audio',
                    'height': h,
                    'format': ext,
                    'size': total_size if total_size > 0 else None,
                    'label': res_label,
                    'format_id': format_id
                })
                
        # 2. VIDEO ONLY OPTIONS (NO AUDIO)
        for h in target_heights:
            for ext in ['mp4', 'webm']:
                matching_videos = [v for v in video_streams if v.get('height') == h and v.get('ext') == ext]
                if not matching_videos:
                    continue
                best_v = max(matching_videos, key=lambda x: (x.get('tbr', 0) or 0, x.get('fps', 30) or 30))
                
                v_size = best_v.get('filesize') or best_v.get('filesize_approx')
                if not v_size and best_v.get('tbr') and duration:
                    v_size = int(best_v.get('tbr') * 1000 * duration / 8)
                    
                fps = best_v.get('fps')
                fps_str = f" {int(fps)}fps" if fps and fps > 30 else ""
                res_label = f"{h}p{fps_str} (Mute)"
                
                options.append({
                    'type': 'video_only',
                    'height': h,
                    'format': ext,
                    'size': v_size if v_size and v_size > 0 else None,
                    'label': res_label,
                    'format_id': best_v.get('format_id')
                })
                
        # 3. AUDIO ONLY OPTIONS
        # M4A Direct (best AAC stream)
        if best_mp4_audio:
            m4a_size = best_mp4_audio.get('filesize') or best_mp4_audio.get('filesize_approx')
            if not m4a_size and best_mp4_audio.get('tbr') and duration:
                m4a_size = int(best_mp4_audio.get('tbr') * 1000 * duration / 8)
            options.append({
                'type': 'audio_only',
                'format': 'm4a',
                'size': m4a_size if m4a_size and m4a_size > 0 else None,
                'label': 'M4A Audio (High Quality)',
                'format_id': best_mp4_audio.get('format_id')
            })
            
        # WebM Direct (best Opus stream)
        if best_webm_audio:
            webm_a_size = best_webm_audio.get('filesize') or best_webm_audio.get('filesize_approx')
            if not webm_a_size and best_webm_audio.get('tbr') and duration:
                webm_a_size = int(best_webm_audio.get('tbr') * 1000 * duration / 8)
            options.append({
                'type': 'audio_only',
                'format': 'webm',
                'size': webm_a_size if webm_a_size and webm_a_size > 0 else None,
                'label': 'Opus Audio (WebM Quality)',
                'format_id': best_webm_audio.get('format_id')
            })

        # MP3 Re-encoded options
        if best_overall_audio:
            best_aid = best_overall_audio.get('format_id')
            mp3_bitrates = [
                {'kbps': 320, 'label': 'MP3 Audio (320kbps - Ultra Quality)'},
                {'kbps': 192, 'label': 'MP3 Audio (192kbps - Standard Quality)'},
                {'kbps': 128, 'label': 'MP3 Audio (128kbps - Basic Quality)'}
            ]
            for br in mp3_bitrates:
                # size estimation = bitrate * duration
                mp3_size = int((br['kbps'] * 1000) * duration / 8)
                options.append({
                    'type': 'audio_only',
                    'format': 'mp3',
                    'size': mp3_size,
                    'label': br['label'],
                    'format_id': best_aid,
                    'bitrate': br['kbps']
                })
                
        return {
            'title': title,
            'thumbnail': info.get('thumbnail', ''),
            'channel': info.get('uploader', info.get('channel', 'Unknown Channel')),
            'duration': duration,
            'duration_formatted': format_duration(duration),
            'views': info.get('view_count'),
            'views_formatted': format_views(info.get('view_count')),
            'upload_date': info.get('upload_date'),
            'upload_date_formatted': format_upload_date(info.get('upload_date')),
            'download_options': options
        }
