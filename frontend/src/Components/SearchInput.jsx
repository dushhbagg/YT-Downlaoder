import React from 'react';

function SearchInput({ url, setUrl, loading, downloading, fetchVideoInfo }) {
  return (
    <div className="input-group">
      <input
        type="text"
        className="url-input"
        placeholder="Paste YouTube URL here..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={loading || downloading}
      />
      <button 
        className="action-btn" 
        onClick={fetchVideoInfo}
        disabled={!url || loading || downloading}
      >
        {loading ? <span className="loader"></span> : 'Get Video'}
      </button>
    </div>
  );
}

export default SearchInput;
