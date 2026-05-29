import React from 'react';

function HistoryManager({ downloadHistory, handleRemoveHistoryItem, handleClearHistory }) {
  if (downloadHistory.length === 0) {
    return (
      <div className="history-wrapper">
        <h2 className="section-title">Download History</h2>
        <div className="no-history-fallback">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.75rem' }}>
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
          <p>No downloads logged yet. Start downloading to build your history!</p>
        </div>
      </div>
    );
  }

  // Helper to copy the video source URL back to clipboard
  const handleCopySourceUrl = (url, title) => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      alert(`Source URL for "${title.substring(0, 30)}..." copied!`);
    });
  };

  return (
    <div className="history-wrapper">
      <div className="history-header">
        <h2 className="section-title">
          Download History
          <span className="badge" style={{ background: 'var(--text-muted)' }}>
            {downloadHistory.length}
          </span>
        </h2>
        
        <button 
          className="clear-history-btn" 
          onClick={handleClearHistory}
          title="Clear entire log"
          aria-label="Clear entire download history"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/>
          </svg>
          Clear History
        </button>
      </div>

      <div className="history-grid">
        {downloadHistory.map((item) => (
          <div className="history-item" key={item.id}>
            <div className="history-item-left">
              {/* Thumbnail */}
              <div className="history-item-thumb">
                <img src={item.thumbnail} alt={item.title} />
              </div>

              {/* Description Details */}
              <div className="history-item-details">
                <div className="history-item-title" title={item.title}>
                  {item.title}
                </div>
                <div className="history-item-meta">
                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{item.channel}</span>
                  <span className="meta-tag" style={{ textTransform: 'uppercase' }}>
                    {item.resolution} • {item.format}
                  </span>
                  <span>{item.dateString}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="history-actions">
              {item.sourceUrl && (
                <button 
                  className="history-action-btn"
                  onClick={() => handleCopySourceUrl(item.sourceUrl, item.title)}
                  title="Copy video link"
                  aria-label="Copy video source link"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                </button>
              )}

              <button 
                className="history-action-btn delete"
                onClick={() => handleRemoveHistoryItem(item.id)}
                title="Remove from history"
                aria-label="Remove download log item"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default HistoryManager;
