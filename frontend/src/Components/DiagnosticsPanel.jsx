import React, { useState, useEffect, useRef } from 'react';

function DiagnosticsPanel({ API_BASE_URL, cookiesSource, setCookiesSource }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const fileInputRef = useRef(null);

  // Load diagnostics metrics from server
  const fetchDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/diagnostics`);
      if (!res.ok) throw new Error("Failed to load diagnostics");
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err.message || "Diagnostics server unreachable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDiagnostics();
    }
  }, [isOpen]);

  // Handle pip upgrade requests for yt-dlp
  const handleUpdateYtdl = async () => {
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/update_ytdl`, { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Update failed");
      alert(result.message || "yt-dlp successfully updated!");
      fetchDiagnostics();
    } catch (err) {
      setError(err.message || "Failed to trigger live update");
    } finally {
      setUpdating(false);
    }
  };

  // Drag and drop handlers for Netscape cookies.txt
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processCookieFile = (file) => {
    if (!file) return;
    setUploadStatus({ status: 'reading', message: 'Reading cookie file...' });

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      
      // Perform strict local validation
      if (!text.includes("Netscape") && !text.includes("cookie") && !text.includes("haxx.se")) {
        setUploadStatus({ 
          status: 'error', 
          message: 'Invalid format! File must be in standard Netscape Cookie format.' 
        });
        return;
      }

      setUploadStatus({ status: 'uploading', message: 'Uploading to server...' });
      try {
        const res = await fetch(`${API_BASE_URL}/upload_cookies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: text })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Upload failed");
        
        setUploadStatus({ 
          status: 'success', 
          message: `Success! ${result.analysis.message || 'Cookies uploaded.'}` 
        });
        
        // Refresh diagnostics metric tiles
        fetchDiagnostics();
      } catch (err) {
        setUploadStatus({ status: 'error', message: err.message || 'Upload failed.' });
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCookieFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      processCookieFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="downloader-card" style={{ marginTop: '1.5rem', padding: isOpen ? '2.5rem' : '1.2rem 2.5rem' }}>
      <div 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <h2 className="section-title" style={{ margin: 0, fontSize: '1.15rem' }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M12 8v8M8 12h8"/>
          </svg>
          System Diagnostics & Administration
        </h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          {isOpen ? "COLLAPSE" : "EXPAND DASHBOARD"}
        </span>
      </div>

      {isOpen && (
        <div style={{ marginTop: '2rem', animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {error && <div className="error-message">{error}</div>}

          {/* Diagnostic Status Tiles Grid */}
          <div className="diag-grid">
            {/* 1. Connection Ping */}
            <div className="diag-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="diag-card-title">YouTube Link</span>
                <span className={`pulse-badge ${data?.connection?.status === 'connected' ? 'active' : 'blocked'}`}></span>
              </div>
              <div className="diag-card-value">
                {loading ? "Testing..." : (data?.connection?.status === 'connected' ? "CONNECTED" : "BLOCKED")}
              </div>
              <p className="diag-card-desc">{data?.connection?.message || "Validating server response..."}</p>
            </div>

            {/* 2. Cookie Status */}
            <div className="diag-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="diag-card-title">Cookie Session</span>
                <span className={`pulse-badge ${data?.cookie_status?.status === 'active' ? 'active' : 'blocked'}`}></span>
              </div>
              <div className="diag-card-value">
                {loading ? "Checking..." : (data?.cookie_status?.status === 'active' ? "ACTIVE" : "MISSING/EXPIRED")}
              </div>
              <p className="diag-card-desc">
                {data?.cookie_status?.status === 'active' 
                  ? `Expiry: ${data.cookie_status.expiry_date} (${data.cookie_status.expired_count} expired)` 
                  : (data?.cookie_status?.message || "No valid cookies loaded.")}
              </p>
            </div>

            {/* 3. Ffmpeg link */}
            <div className="diag-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="diag-card-title">Media Linkage</span>
                <span className={`pulse-badge ${data?.ffmpeg_status === 'available' ? 'active' : 'blocked'}`}></span>
              </div>
              <div className="diag-card-value">
                {loading ? "Locating..." : (data?.ffmpeg_status === 'available' ? "FFMPEG OK" : "MISSING")}
              </div>
              <p className="diag-card-desc">
                {data?.ffmpeg_status === 'available' 
                  ? "FFmpeg is linked and ready for high-definition merging." 
                  : "FFmpeg binary not detected in system path."}
              </p>
            </div>

            {/* 4. yt-dlp version */}
            <div className="diag-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="diag-card-title">Engine Version</span>
                {data?.update_available && <span className="update-pulse-tag">UPDATE AVAILABLE</span>}
              </div>
              <div className="diag-card-value" style={{ fontSize: '1.2rem' }}>
                v{data?.yt_dlp_version || "Checking..."}
              </div>
              <p className="diag-card-desc">
                Latest PyPI: v{data?.latest_yt_dlp_version || "..."}
              </p>
            </div>
          </div>

          {/* Core Controls: Dynamic Upgrade & Selector */}
          <div className="diag-controls-row">
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Authentication Source:
              </label>
              <select 
                className="quality-select" 
                value={cookiesSource}
                onChange={(e) => setCookiesSource(e.target.value)}
                style={{ width: '100%', padding: '0.8rem 1rem' }}
              >
                <option value="cookies_txt">Manual cookies.txt (Recommended for Cloud/Render)</option>
                <option value="chrome">Chrome Local Browser (Local only)</option>
                <option value="firefox">Firefox Local Browser (Local only)</option>
                <option value="edge">Edge Local Browser (Local only)</option>
                <option value="none">Anonymous Extraction (Fallback mobile client)</option>
              </select>

              <button 
                className="action-btn"
                onClick={handleUpdateYtdl}
                disabled={updating || loading}
                style={{ 
                  width: '100%', 
                  padding: '0.9rem', 
                  marginTop: '0.4rem',
                  background: data?.update_available ? 'linear-gradient(135deg, var(--primary), var(--accent))' : 'var(--surface-hover)',
                  color: 'var(--text-main)',
                  borderColor: data?.update_available ? 'var(--primary)' : 'transparent'
                }}
              >
                {updating ? (
                  <>
                    <span className="loader"></span> Upgrading yt-dlp...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                    {data?.update_available ? "Upgrade yt-dlp Engine Now" : "Check & Force Upgrade yt-dlp"}
                  </>
                )}
              </button>
            </div>

            {/* Drag & Drop Cookies Netscape Uploader */}
            <div style={{ flex: 1 }}>
              <div 
                className={`drag-upload-zone ${dragActive ? 'active' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={onButtonClick}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  onChange={handleFileSelect}
                  accept=".txt"
                />
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.5rem' }}>
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M12 8v8M8 12h8"/>
                </svg>
                <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                  Drag & Drop Netscape cookies.txt
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  or click to select file from disk
                </p>
              </div>

              {uploadStatus && (
                <div 
                  style={{ 
                    marginTop: '0.6rem', 
                    fontSize: '0.82rem', 
                    color: uploadStatus.status === 'success' ? 'var(--success)' : (uploadStatus.status === 'error' ? 'var(--danger)' : 'var(--primary)'),
                    textAlign: 'center',
                    fontWeight: 500
                  }}
                >
                  {uploadStatus.message}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DiagnosticsPanel;
