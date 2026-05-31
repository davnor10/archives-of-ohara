# Archives of Ohara

**Version 0.4.6**

A personal media library app for your local TV shows and movies. Browse your collection, watch with a built-in player, manage tags, and let the randomizer pick your next voyage — or even a random episode from a show you're already watching.

Add a free TMDB API key to automatically pull in posters, release years, ratings, and genre tags for your entire library.

Free and open-source under the [MIT License](LICENSE). If you find it useful, a ★ on GitHub goes a long way — or [buy me a coffee on Ko-Fi](https://ko-fi.com/archives_of_ohara) ☕

---

## Download

Go to the [**Releases**](https://github.com/davnor10/archives-of-ohara/releases) page and grab the latest build for your platform:

| Platform | File | Notes |
|---|---|---|
| **Windows** | `archives-of-ohara-x.x.x-setup.exe` | Run the installer. Click **More info → Run anyway** if Windows SmartScreen warns you. |
| **macOS** | `archives-of-ohara-x.x.x.dmg` | Open the DMG and drag to Applications. **Right-click → Open** on first launch to bypass Gatekeeper. |
| **Linux** | `archives-of-ohara-x.x.x.AppImage` | Mark as executable (`chmod +x`) then run. No installation needed. Alternatively, install the `.deb` package if your distro supports it. |

---

## Getting Started

### 1. Add your media folders

Open the app and go to **Settings** (top-right nav).

Under **TV Show Folders** and **Movie Folders**, click **+ Add Folder** and select the directories where your media files live. You can add as many folders as you like.

### 2. Scan your library

Click **Save & Scan Library**. The app will walk through your folders, find all video files, and add them to the database. This only takes a few seconds for most collections.

### 3. Fetch metadata (optional but recommended)

If you've added a TMDB API key (see below), clicking **Save & Scan Library** will automatically fetch posters, descriptions, ratings, and release years for your entire collection. You can also trigger this manually at any time with the **Refresh Metadata** button.

---

## Getting a Free TMDB API Key

TMDB (The Movie Database) provides free API access for personal projects.

1. Go to [themoviedb.org](https://www.themoviedb.org) and create a free account
2. Once logged in, click your avatar (top-right) → **Settings**
3. In the left sidebar, click **API**
4. Under **Request an API Key**, click the link and choose **Developer**
5. Fill in the form — for personal use, something like "personal media player" is fine
6. Copy the **API Key (v3 auth)** — it looks like a long string of letters and numbers
7. Paste it into **Settings → TMDB API → API Key** in the app and save

That's it. The key is free and has no meaningful rate limits for personal use.

---

## Features

- **TV Shows & Movies** — separate screens with poster grid, search, and tag filtering
- **Built-in player** — plays most formats; automatically transcodes incompatible codecs (HEVC, DTS, etc.) on the fly via ffmpeg
- **Multiple audio tracks** — switch between dubbed and subbed audio tracks mid-playback
- **Subtitles** — supports external `.srt`/`.vtt` files, embedded MKV tracks, and manual import from any file; configurable size, color, and sync offset
- **Volume boost** — push volume above 100% (up to 200%) via WebAudio for quiet sources
- **Bookmarks** — automatically saves your position so you can resume where you left off; can be disabled in Settings
- **Auto-watched** — episodes are marked as watched when you reach the last 10%, so skipping the credits still counts
- **Episode tracker** — per-show progress bar with per-season bulk mark watched/unwatched
- **Tags** — genre tags are auto-populated from TMDB; create your own and filter your library by them
- **Set Sail randomizer** — can't decide what to watch? Hit the anchor button and let the app pick something — filter by tag to narrow the pool, choose between a movie or a show, or roll a random episode from a series
- **Playback speed** — presets from 0.5× to 2× plus a free-input custom speed

---

## Supported Video Formats

The player handles most common formats. Files that can't be played natively (HEVC/H.265, DTS audio, AVI, etc.) are automatically transcoded on the fly by the bundled ffmpeg — no manual conversion needed.

`.mp4` `.mkv` `.avi` `.mov` `.m4v` `.wmv` `.ts` `.m2ts` `.webm`

---

## File Naming

The scanner picks up any video file in your configured folders (including subfolders). For TV shows, episodes are grouped by their parent folder. TMDB matching works best when folder and file names are clean:

**Shows:** `Breaking Bad/Season 1/Episode 1.mkv`  
**Movies:** `The Godfather (1972).mkv` or just `The Godfather.mkv`

---

## Building from Source

Requires **Node.js 22**.

```bash
git clone https://github.com/davnor10/archives-of-ohara.git
cd archives-of-ohara/archives-of-ohara
npm install
npm run dev        # development
npm run build      # production build
npm run start      # run the production build
```

---

## About

Created by **David Norman** with the use of Claude Code.
Contact: [archivesofohara@gmail.com](mailto:archivesofohara@gmail.com)

If you enjoy the app, consider supporting development:

[![Ko-Fi](https://img.shields.io/badge/Ko--Fi-Buy%20me%20a%20coffee-ff5e5b?logo=ko-fi&logoColor=white)](https://ko-fi.com/archives_of_ohara)