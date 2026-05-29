import React, { useState } from 'react';

function VideoInfo({ videoInfo, handleDownload, activeDownloads }) {
  const [activeTab, setActiveTab] = useState('video_audio');
  const [copied, setCopied] = useState(false);

  if (!videoInfo) return null;

  // Utility to format sizes dynamically
  const formatSize = (bytes) => {
    if (bytes === null || bytes === undefined) return 'Unknown Size';
    try {
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let size = Number(bytes);
      let unitIndex = 0;
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
      }
      return `${size.toFixed(1)} ${units[unitIndex]}`;
    } catch {
      return 'Unknown Size';
    }
  };

  // Copy video details text block to clipboard
  const handleCopyDetails = () => {
    const text = `🎥 YT DOWNLOADER MAX - VIDEO DETAILS\n` +
                 `-----------------------------------\n` +
                 `Title: ${videoInfo.title}\n` +
                 `Channel: ${videoInfo.channel}\n` +
                 `Duration: ${videoInfo.duration_formatted}\n` +
                 `Views: ${videoInfo.views_formatted}\n` +
                 `Upload Date: ${videoInfo.upload_date_formatted}\n` +
                 `Link: ${videoInfo.url || 'https://youtube.com'}`;
    
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Filter available downloads based on selected tab
  const filteredOptions = videoInfo.download_options.filter(
    (opt) => opt.type === activeTab
  );

  return (
    <div className="video-info">
      {/* LEFT COLUMN: VIDEO CARD */}
      <div className="video-details-col">
        <div className="thumbnail-wrapper">
          <img src={videoInfo.thumbnail} alt={videoInfo.title} />
          <span className="duration-badge">{videoInfo.duration_formatted}</span>
        </div>

        <div className="meta-info-container">
          <h3>{videoInfo.title}</h3>
          <div className="channel-name">{videoInfo.channel}</div>
          
          <div className="stats-grid">
            <div className="stat-item" title="Views">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              {videoInfo.views_formatted}
            </div>
            
            <div className="stat-item" title="Upload Date">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
              {videoInfo.upload_date_formatted}
            </div>
          </div>

          <button 
            className="copy-info-btn" 
            onClick={handleCopyDetails}
            aria-label="Copy video details"
          >
            {copied ? (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--success)' }}>
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
                Details Copied!
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
                Copy Video Details
              </>
            )}
          </button>
        </div>
      </div>

      {/* RIGHT COLUMN: DOWNLOAD FORMATS */}
      <div className="video-downloads-col">
        {/* Navigation Tabs */}
        <div className="tabs-header">
          <button 
            className={`tab-btn ${activeTab === 'video_audio' ? 'active' : ''}`}
            onClick={() => setActiveTab('video_audio')}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 7a2 2 0 0 0-2.45-1.45L16 7V5a2 2 0 0 0-2-2H2a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2l4.55 1.45A2 2 0 0 0 23 17V7Z"/>
            </svg>
            Video + Audio
          </button>
          
          <button 
            className={`tab-btn ${activeTab === 'video_only' ? 'active' : ''}`}
            onClick={() => setActiveTab('video_only')}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            </svg>
            Video Only
          </button>
          
          <button 
            className={`tab-btn ${activeTab === 'audio_only' ? 'active' : ''}`}
            onClick={() => setActiveTab('audio_only')}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
            Audio Only
          </button>
        </div>

        {/* Quality Cards Grid */}
        <div className="quality-grid">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, index) => {
              const isPremium = opt.height >= 1080 || (opt.type === 'audio_only' && opt.bitrate >= 256);
              const labelText = opt.label;
              
              return (
                <div 
                  className="quality-card" 
                  key={index}
                  onClick={() => handleDownload(opt)}
                >
                  <div className="quality-card-left">
                    <div className={`resolution-badge ${isPremium ? 'premium' : ''}`}>
                      {opt.height ? `${opt.height}p` : opt.format.toUpperCase()}
                    </div>
                    
                    <div className="quality-card-details">
                      <div className="quality-card-label">{labelText}</div>
                      <div className="quality-card-meta">
                        <span className="meta-tag">{opt.format.toUpperCase()}</span>
                        <span className="meta-tag">{formatSize(opt.size)}</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    className="card-dl-btn"
                    onClick={(e) => {
                      e.stopPropagation(); // prevent card double triggers
                      handleDownload(opt);
                    }}
                    aria-label={`Download ${labelText}`}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                  </button>
                </div>
              );
            })
          ) : (
            <div className="no-formats-fallback">
              No available formats found for this category.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VideoInfo;
