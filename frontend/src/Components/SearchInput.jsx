import React, { useState } from 'react';

function SearchInput({ url, setUrl, loading, downloading, fetchVideoInfo }) {
  const [touched, setTouched] = useState(false);

  // Simple YouTube URL validation check
  const isValidYoutubeUrl = (inputUrl) => {
    if (!inputUrl) return true; // don't show error for empty input
    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|embed\/|v\/|shorts\/)?([a-zA-Z0-9_-]{11})/;
    const sharedRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return ytRegex.test(inputUrl) || sharedRegex.test(inputUrl);
  };

  const handleInputChange = (e) => {
    setUrl(e.target.value);
    setTouched(true);
  };

  const showValidationHint = touched && url && !isValidYoutubeUrl(url);

  return (
    <div style={{ width: '100%' }}>
      <div className="input-group">
        <input
          type="text"
          className="url-input"
          placeholder="Paste YouTube URL here (e.g. https://www.youtube.com/watch?v=...)"
          value={url}
          onChange={handleInputChange}
          disabled={loading}
        />
        <button 
          className="action-btn" 
          onClick={fetchVideoInfo}
          disabled={!url || loading || showValidationHint}
        >
          {loading ? (
            <>
              <span className="loader"></span> Loading...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
              Get Video
            </>
          )}
        </button>
      </div>

      {showValidationHint && (
        <div className="url-validation-hint">
          Please enter a valid YouTube link (e.g. youtube.com/watch?v=... or youtu.be/...)
        </div>
      )}
    </div>
  );
}

export default SearchInput;
