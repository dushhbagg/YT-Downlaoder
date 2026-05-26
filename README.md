# 🎥 Premium YouTube Downloader

A modern, fast, and beautiful YouTube Downloader web application featuring a premium, responsive glassmorphic UI. It allows downloading videos in various resolutions (up to 4K/2160p) or extracting high-quality audio, complete with live progress tracking.

---

## ✨ Features

- **🚀 Live Progress Tracker:** See download and conversion progress in real-time.
- **💎 Multi-Resolution Support:** Download in **4K (2160p)**, **2K (1440p)**, **Full HD (1080p)**, **HD (720p)**, **480p**, or extract high-quality **Audio (M4A)**.
- **🎨 Modern Premium UI:** Gorgeous, responsive design utilizing HSL colors, smooth glassmorphism, micro-animations, and full responsiveness across devices.
- **⚡ Fast Downloader Engine:** Powered by Python's `yt-dlp` with multi-threaded fragment downloads for maximum speed.
- **🛡️ Secure & Clean:** No sketchy ads or popups; pure local processing.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React + Vite
- **Styling:** Vanilla CSS (Modern Flexbox/Grid, Custom CSS variables, Glassmorphism, Responsive layout)
- **Icons:** Inline SVG assets

### Backend
- **Framework:** Flask (Python) with CORS enabled
- **Engine:** `yt-dlp` for video extraction and downloading
- **Media Processing:** `imageio-ffmpeg` for merging video and audio fragments seamlessly

---

## 🚀 Getting Started

Follow these steps to run the application locally.

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [Python 3.8+](https://www.python.org/)

---

### 1. Backend Setup (Flask)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment (optional but recommended):
   ```bash
   python -m venv .venv
   ```

3. Activate the virtual environment:
   - **Windows:**
     ```bash
     .venv\Scripts\activate
     ```
   - **macOS/Linux:**
     ```bash
     source .venv/bin/activate
     ```

4. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Start the backend Flask server:
   ```bash
   python app.py
   ```
   The backend will run at `http://localhost:5001`.

---

### 2. Frontend Setup (React + Vite)

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```

2. Install the frontend dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (optional):
   Ensure your `.env` file contains:
   ```env
   VITE_API_URL=http://localhost:5001
   ```

4. Start the frontend Vite development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser to experience the app!

---

## 📂 Project Structure

```
YT Downloader/
├── backend/
│   ├── app.py               # Flask application with download endpoints
│   ├── requirements.txt     # Python dependencies list
│   └── test_format.py       # Format testing script
├── frontend/
│   ├── public/              # Static assets (images, icons)
│   ├── src/                 # React source code
│   │   ├── Components/      # Reusable UI components (VideoInfo, etc.)
│   │   ├── Pages/           # Application views (Home page, etc.)
│   │   ├── App.jsx          # Main application component
│   │   ├── index.css        # Premium global styling and design system
│   │   └── main.jsx         # App entry point
│   ├── .env                 # Local environment variables
│   ├── .gitignore           # Frontend-specific Git ignore rules
│   ├── package.json         # NPM script configurations
│   └── vite.config.js       # Vite bundler configuration
└── .gitignore               # Root Git ignore rules
```

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
