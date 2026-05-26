import React from 'react';

function VideoInfo({ videoInfo, downloading, handleDownload, quality, setQuality, downloadStatus, downloadProgress }) {
  if (!videoInfo) return null;

  return (
    <div className="video-info">
      <div className="thumbnail-wrapper">
        <img src={videoInfo.thumbnail} alt={videoInfo.title} />
      </div>

      <div className="details">
        <h3>{videoInfo.title}</h3>
        <p>{videoInfo.author}</p>

        <div className="quality-selector-group">
          <label className="quality-label">Resolution:</label>
          <select
            className="quality-select"
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            disabled={downloading}
          >
            <option value="best">Best Available (Default)</option>
            <option value="2160p">2160p (4K)</option>
            <option value="1440p">1440p (2K)</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="480p">480p</option>
          </select>
        </div>

        {downloading && (
          <div className="progress-container">
            <div className="progress-text">{downloadStatus}</div>
            <div className="progress-bar-bg">
              <div
                className="progress-bar-fill"
                style={{ width: `${downloadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="button-group">
          <button
            className="download-btn"
            onClick={() => handleDownload()}
            disabled={downloading}
          >
            {downloading ? (
              <>
                <span className="loader"></span> Processing...
              </>
            ) : (
              'Download Video'
            )}
          </button>
          <button
            className="download-audio-btn"
            onClick={() => handleDownload('audio')}
            disabled={downloading}
          >
            {downloading ? (
              <>
                <span className="loader"></span> Processing...
              </>
            ) : (
              'Download Audio Only'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default VideoInfo;
