import { useState } from 'react';
import Header from '../Components/Header';
import SearchInput from '../Components/SearchInput';
import VideoInfo from '../Components/VideoInfo';


function Home() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [error, setError] = useState(null);
  const [quality, setQuality] = useState('best');

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const fetchVideoInfo = async () => {
    if (!url) return;

    setLoading(true);
    setError(null);
    setVideoInfo(null);

    try {
      const response = await fetch(`${API_BASE_URL}/info?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        let message = 'Failed to fetch video info. Ensure the URL is correct.';
        try {
          const errorData = await response.json();
          message = errorData.details || errorData.error || message;
        } catch {
          // Keep the default message if the backend did not return JSON.
        }
        throw new Error(message);
      }

      const data = await response.json();
      setVideoInfo(data);
    } catch (err) {
      setError(err.message || 'An error occurred while fetching video details.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (customQuality) => {
    if (!url || !videoInfo) return;

    setDownloading(true);
    setDownloadProgress(0);
    setDownloadStatus('Starting...');
    setError(null);

    const selectedQuality = typeof customQuality === 'string' ? customQuality : quality;

    try {
      const startRes = await fetch(`${API_BASE_URL}/start_download?url=${encodeURIComponent(url)}&quality=${selectedQuality}`);
      if (!startRes.ok) throw new Error('Failed to start download');

      const { job_id } = await startRes.json();

      const interval = setInterval(async () => {
        try {
          const progRes = await fetch(`${API_BASE_URL}/progress?job_id=${job_id}`);
          if (!progRes.ok) return;
          const data = await progRes.json();

          if (data.status === 'downloading') {
            setDownloadProgress(data.percent || 0);
            setDownloadStatus(`Downloading... ${data.percent || 0}%`);
          } else if (data.status === 'merging') {
            setDownloadProgress(100);
            setDownloadStatus('Merging Video...');
          } else if (data.status === 'extracting') {
            setDownloadProgress(100);
            setDownloadStatus('Extracting Audio...');
          } else if (data.status === 'completed') {
            clearInterval(interval);
            setDownloadStatus('Done!');

            const downloadUrl = `${API_BASE_URL}/get_file?job_id=${job_id}`;
            const a = document.createElement('a');
            a.href = downloadUrl;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            setTimeout(() => setDownloading(false), 2000);
          } else if (data.status === 'error') {
            clearInterval(interval);
            throw new Error(data.error || 'An error occurred during download');
          }
        } catch (err) {
          clearInterval(interval);
          setError(err.message);
          setDownloading(false);
        }
      }, 1000);

    } catch (err) {
      setError(err.message);
      setDownloading(false);
    }
  };

  return (
    <div className="app-container">
      <Header />

      <div className="downloader-card">
        {error && <div className="error-message">{error}</div>}

        <SearchInput
          url={url}
          setUrl={setUrl}
          loading={loading}
          downloading={downloading}
          fetchVideoInfo={fetchVideoInfo}
        />

        <VideoInfo
          videoInfo={videoInfo}
          downloading={downloading}
          handleDownload={handleDownload}
          quality={quality}
          setQuality={setQuality}
          downloadStatus={downloadStatus}
          downloadProgress={downloadProgress}
        />
      </div>
    </div>
  );
}

export default Home;
