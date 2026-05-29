import React, { useState, useEffect } from 'react';
import Header from '../Components/Header';
import SearchInput from '../Components/SearchInput';
import VideoInfo from '../Components/VideoInfo';
import QueueManager from '../Components/QueueManager';
import HistoryManager from '../Components/HistoryManager';
import DiagnosticsPanel from '../Components/DiagnosticsPanel';


function Home() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Concurrent downloads queue state
  const [activeDownloads, setActiveDownloads] = useState({});
  
  // Completed downloads log stored in browser
  const [downloadHistory, setDownloadHistory] = useState([]);
  
  // Selected authentication source for bypassing bot filters
  const [cookiesSource, setCookiesSource] = useState(() => {
    return localStorage.getItem('yt_downloader_cookies_source') || 'cookies_txt';
  });
  
  // Theme state (loaded from local storage, default to 'dark')
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('yt_downloader_theme') || 'dark';
  });

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

  // Persist cookiesSource
  useEffect(() => {
    localStorage.setItem('yt_downloader_cookies_source', cookiesSource);
  }, [cookiesSource]);

  // Apply visual theme to HTML root element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('yt_downloader_theme', theme);
  }, [theme]);

  // Load completed history on mount
  useEffect(() => {
    try {
      const history = localStorage.getItem('yt_downloader_history');
      if (history) {
        setDownloadHistory(JSON.parse(history));
      }
    } catch (e) {
      console.error("Failed to load download history:", e);
    }
  }, []);

  // Theme switch handler
  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Main fetch query for video info metadata
  const fetchVideoInfo = async () => {
    if (!url) return;

    setLoading(true);
    setError(null);
    setVideoInfo(null);

    try {
      const response = await fetch(`${API_BASE_URL}/info?url=${encodeURIComponent(url)}&cookies_source=${cookiesSource}`);
      if (!response.ok) {
        let message = 'Failed to fetch video details. Ensure the URL is correct.';
        try {
          const errorData = await response.json();
          message = errorData.error || errorData.details || message;
        } catch {
          // Fallback message
        }
        throw new Error(message);
      }

      const data = await response.json();
      // Inject video link into details for copying
      data.url = url;
      setVideoInfo(data);
    } catch (err) {
      setError(err.message || 'An error occurred while fetching video details.');
    } finally {
      setLoading(false);
    }
  };

  // Add selected stream configuration to the background download thread queue
  const handleDownload = async (option) => {
    if (!url || !videoInfo) return;
    setError(null);

    try {
      let startUrl = `${API_BASE_URL}/start_download?url=${encodeURIComponent(url)}` +
                     `&format_id=${encodeURIComponent(option.format_id)}` +
                     `&type=${option.type}` +
                     `&ext=${option.format}` +
                     `&cookies_source=${cookiesSource}`;

      if (option.bitrate) {
        startUrl += `&bitrate=${option.bitrate}`;
      }

      const response = await fetch(startUrl);
      if (!response.ok) throw new Error("Failed to start download process");

      const data = await response.json();
      const jobId = data.job_id;

      // Register new active job
      setActiveDownloads(prev => ({
        ...prev,
        [jobId]: {
          jobId,
          title: videoInfo.title,
          thumbnail: videoInfo.thumbnail,
          resolution: option.height ? `${option.height}p` : option.label,
          format: option.format,
          percent: 0,
          speed: '0 KB/s',
          eta: 'Calculating...',
          status: 'starting',
          error: null
        }
      }));
    } catch (err) {
      setError(err.message || "Failed to add download to queue.");
    }
  };

  // Request thread abort via cancellation route
  const handleCancel = async (jobId) => {
    try {
      // Optimistically show as cancelling in UI
      setActiveDownloads(prev => {
        if (prev[jobId]) {
          return {
            ...prev,
            [jobId]: { ...prev[jobId], status: 'cancelling' }
          };
        }
        return prev;
      });

      const response = await fetch(`${API_BASE_URL}/cancel?job_id=${jobId}`);
      if (!response.ok) throw new Error("Abort request failed");
    } catch (err) {
      console.error("Cancel operation failed:", err);
    }
  };

  // Deletion individual item from local completed history logs
  const handleRemoveHistoryItem = (id) => {
    setDownloadHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem('yt_downloader_history', JSON.stringify(updated));
      return updated;
    });
  };

  // Clear entire local completed history log
  const handleClearHistory = () => {
    setDownloadHistory([]);
    localStorage.removeItem('yt_downloader_history');
  };

  // UNIFIED POLLING SCHEDULER: Checks progress on ALL active background downloads concurrently
  useEffect(() => {
    const activeJobs = Object.values(activeDownloads).filter(
      job => ['starting', 'downloading', 'merging', 'extracting', 'cancelling'].includes(job.status)
    );

    if (activeJobs.length === 0) return;

    const interval = setInterval(async () => {
      // Loop through all active download jobs
      for (const job of activeJobs) {
        try {
          const res = await fetch(`${API_BASE_URL}/progress?job_id=${job.jobId}`);
          if (!res.ok) {
            // If the job is deleted or server restart, mark it as error
            if (res.status === 404) {
              setActiveDownloads(prev => ({
                ...prev,
                [job.jobId]: { ...prev[job.jobId], status: 'error', error: 'Job not found on server' }
              }));
            }
            continue;
          }
          
          const data = await res.json();

          setActiveDownloads(prev => {
            const currentJob = prev[job.jobId];
            if (!currentJob) return prev;

            const updatedJob = {
              ...currentJob,
              status: data.status,
              percent: data.percent || 0,
              speed: data.speed || '0 KB/s',
              eta: data.eta || 'Calculating...',
              error: data.error
            };

            // AUTO DOWNLOAD FILE ON BROWSER WHEN COMPLETED
            if (data.status === 'completed' && currentJob.status !== 'completed') {
              const downloadUrl = `${API_BASE_URL}/get_file?job_id=${job.jobId}`;
              const a = document.createElement('a');
              a.href = downloadUrl;
              a.download = `${updatedJob.title}.${updatedJob.format}`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);

              // ADD TO DOWNLOAD LOG LOGIC
              const newLogItem = {
                id: job.jobId,
                title: updatedJob.title,
                thumbnail: updatedJob.thumbnail,
                channel: videoInfo ? videoInfo.channel : 'YouTube Channel',
                resolution: updatedJob.resolution,
                format: updatedJob.format,
                sourceUrl: url,
                dateString: new Date().toLocaleDateString(undefined, { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })
              };

              setDownloadHistory(prevHistory => {
                const updatedHistory = [newLogItem, ...prevHistory];
                localStorage.setItem('yt_downloader_history', JSON.stringify(updatedHistory));
                return updatedHistory;
              });
            }

            return {
              ...prev,
              [job.jobId]: updatedJob
            };
          });

        } catch (err) {
          console.error("Polling error for job ID:", job.jobId, err);
        }
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeDownloads, url, videoInfo, API_BASE_URL]);

  return (
    <div className="app-container">
      {/* Sleek logo and theme toggle */}
      <Header theme={theme} toggleTheme={toggleTheme} />

      <div className="downloader-card">
        {/* User alert notification center */}
        {error && <div className="error-message">{error}</div>}

        {/* Input group and validations */}
        <SearchInput
          url={url}
          setUrl={setUrl}
          loading={loading}
          fetchVideoInfo={fetchVideoInfo}
        />

        {/* Video metadata overview and resolution lists */}
        <VideoInfo
          videoInfo={videoInfo}
          handleDownload={handleDownload}
        />
      </div>

      {/* Diagnostics & Administration panel */}
      <DiagnosticsPanel 
        API_BASE_URL={API_BASE_URL} 
        cookiesSource={cookiesSource} 
        setCookiesSource={setCookiesSource} 
      />

      {/* Concurrent active queue manager panel */}
      <QueueManager 
        activeDownloads={activeDownloads} 
        handleCancel={handleCancel} 
      />

      {/* Completed history logs panel */}
      <HistoryManager 
        downloadHistory={downloadHistory}
        handleRemoveHistoryItem={handleRemoveHistoryItem}
        handleClearHistory={handleClearHistory}
      />
    </div>
  );
}

export default Home;
