import React from 'react';

function Header({ theme, toggleTheme }) {
  return (
    <div className="header-wrapper">
      <div className="header">
        <h1>YT Downloader Max</h1>
        <p>Ultra-fast YouTube downloads up to 4K resolution</p>
      </div>

      <button 
        className="theme-toggle-btn" 
        onClick={toggleTheme} 
        aria-label="Toggle theme"
        title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {theme === 'dark' ? (
          // Moon SVG Icon (Active Dark Mode)
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
          </svg>
        ) : (
          // Sun SVG Icon (Active Light Mode)
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
          </svg>
        )}
      </button>
    </div>
  );
}

export default Header;
