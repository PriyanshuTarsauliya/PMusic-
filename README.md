# PMusic-

A fast, responsive web-based music discovery and playback application featuring real-time YouTube full-song audio resolution, interactive queues, and instant search.

## Features

- **Music Search & Discovery**: Search tracks, albums, artists, and playlists.
- **Full Song Audio Resolver**: Instant YouTube audio stream matching for complete songs.
- **Interactive Player**: Modern player UI with play/pause, seek, volume, and queue management.
- **Render Ready**: Includes configuration for seamless 1-click cloud deployment on [Render](https://render.com).

## Getting Started Locally

1. **Install dependencies** (uses Node.js 18+ built-ins):
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```

3. **Open in browser**:
   Navigate to `http://localhost:3456`.

## Deployment to Render

This repository includes a `render.yaml` blueprint:
1. Log in to [Render](https://dashboard.render.com).
2. Click **New +** -> **Blueprint**.
3. Connect the `PMusic-` repository and apply the blueprint to deploy automatically.
