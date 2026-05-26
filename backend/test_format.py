import yt_dlp
import imageio_ffmpeg

url = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'

ydl_opts = {
    'format': 'bestvideo[height<=2160]+bestaudio/best',
    'quiet': False,
    'no_warnings': True,
    'ffmpeg_location': imageio_ffmpeg.get_ffmpeg_exe(),
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info(url, download=False)
    print("Requested format:")
    print(info.get('format', 'N/A'))
    print(info.get('format_id', 'N/A'))
    print(info.get('height', 'N/A'))
