import React from 'react';

function QueueManager({ activeDownloads, handleCancel }) {
  const queueItems = Object.values(activeDownloads);

  if (queueItems.length === 0) return null;

  // Utility to determine standard label colors based on status
  const getStatusDetails = (status) => {
    switch (status) {
      case 'starting':
        return { label: 'Initializing...', color: 'var(--text-secondary)' };
      case 'downloading':
        return { label: 'Downloading', color: 'var(--primary)' };
      case 'merging':
        return { label: 'Merging HD Streams...', color: 'var(--secondary)' };
      case 'extracting':
        return { label: 'Converting Audio (FFmpeg)...', color: 'var(--secondary)' };
      case 'completed':
        return { label: 'Finished!', color: 'var(--success)' };
      case 'cancelled':
        return { label: 'Cancelled', color: 'var(--danger)' };
      case 'cancelling':
        return { label: 'Cancelling...', color: 'var(--warning)' };
      case 'error':
      default:
        return { label: 'Failed', color: 'var(--danger)' };
    }
  };

  return (
    <div className="queue-panel">
      <h2 className="section-title">
        Active Downloads Queue
        <span className="badge">{queueItems.length}</span>
      </h2>

      <div className="queue-grid">
        {queueItems.map((item) => {
          const statusInfo = getStatusDetails(item.status);
          const hasProgressBar = ['downloading', 'merging', 'extracting', 'completed'].includes(item.status);
          const isProcessing = ['starting', 'downloading', 'merging', 'extracting', 'cancelling'].includes(item.status);

          return (
            <div className="queue-item" key={item.jobId}>
              {/* Thumbnail */}
              <div className="queue-item-thumb">
                <img src={item.thumbnail} alt={item.title} />
              </div>

              {/* Detail Content */}
              <div className="queue-item-content">
                <div className="queue-item-title" title={item.title}>
                  {item.title}
                </div>

                <div className="queue-item-meta">
                  <div className="queue-item-meta-left">
                    <span>{item.resolution} ({item.format.toUpperCase()})</span>
                  </div>
                  
                  <div 
                    className="queue-item-meta-right" 
                    style={{ color: statusInfo.color }}
                  >
                    {isProcessing && <span className="loader colored" style={{ marginRight: '6px', verticalAlign: 'middle', width: '12px', height: '12px' }}></span>}
                    {statusInfo.label} {item.status === 'downloading' ? `(${item.percent}%)` : ''}
                  </div>
                </div>

                {/* Progress Bar */}
                {hasProgressBar && (
                  <div className="queue-progress-bar-bg">
                    <div 
                      className="queue-progress-bar-fill" 
                      style={{ 
                        width: `${item.status === 'completed' ? 100 : item.percent}%`,
                        background: item.status === 'completed' ? 'var(--success)' : undefined
                      }}
                    ></div>
                  </div>
                )}

                {/* Speeds, ETA or Error Display */}
                {item.status === 'downloading' && (
                  <div className="queue-item-meta" style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
                    <span>Speed: {item.speed}</span>
                    <span>ETA: {item.eta}</span>
                  </div>
                )}

                {item.status === 'error' && (
                  <div 
                    style={{ 
                      fontSize: '0.75rem', 
                      color: 'var(--danger)', 
                      whiteSpace: 'nowrap', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis',
                      marginTop: '0.2rem' 
                    }}
                    title={item.error}
                  >
                    Error: {item.error}
                  </div>
                )}
              </div>

              {/* Action Button: Cancel or Done Checkmark */}
              {isProcessing ? (
                <button 
                  className="queue-item-cancel-btn"
                  onClick={() => handleCancel(item.jobId)}
                  title="Cancel download"
                  aria-label="Cancel download"
                  disabled={item.status === 'cancelling'}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="m9 9 6 6M15 9l-6 6"/>
                  </svg>
                </button>
              ) : item.status === 'completed' ? (
                <div style={{ color: 'var(--success)', padding: '0.5rem', display: 'flex', alignItems: 'center' }}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                </div>
              ) : (
                // Cancelled or Error cross
                <div style={{ color: 'var(--danger)', padding: '0.5rem', display: 'flex', alignItems: 'center' }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 9-6 6M9 9l6 6"/>
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default QueueManager;
