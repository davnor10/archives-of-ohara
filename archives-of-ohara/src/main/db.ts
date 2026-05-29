import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'

const userDataPath = app.getPath('userData')
mkdirSync(userDataPath, { recursive: true })

const db = new Database(join(userDataPath, 'ohara.db'))

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS media_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    type         TEXT NOT NULL CHECK(type IN ('movie','show')),
    title        TEXT NOT NULL,
    path         TEXT NOT NULL UNIQUE,
    year         INTEGER,
    overview     TEXT,
    rating       REAL,
    poster_base64 TEXT,
    tmdb_id      INTEGER,
    scanned_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS episodes (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    show_id        INTEGER NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
    season         INTEGER NOT NULL DEFAULT 1,
    episode_number INTEGER,
    title          TEXT,
    path           TEXT NOT NULL UNIQUE,
    scanned_at     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    media_path        TEXT NOT NULL UNIQUE,
    timestamp_seconds REAL NOT NULL,
    updated_at        TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    is_default INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS media_tags (
    media_id INTEGER NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
    tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (media_id, tag_id)
  );
`)

// Migrations
try { db.exec('ALTER TABLE episodes ADD COLUMN watched INTEGER NOT NULL DEFAULT 0') } catch { /* column exists */ }
try { db.exec('ALTER TABLE episodes ADD COLUMN duration_seconds REAL') } catch { /* column exists */ }
try { db.exec('ALTER TABLE media_items ADD COLUMN duration_seconds REAL') } catch { /* column exists */ }
try { db.exec('ALTER TABLE media_items ADD COLUMN last_watched_at TEXT') } catch { /* column exists */ }
try { db.exec('ALTER TABLE media_items ADD COLUMN pinned_tmdb_id INTEGER') } catch { /* column exists */ }
try { db.exec('ALTER TABLE media_items ADD COLUMN favorite INTEGER DEFAULT 0') } catch { /* column exists */ }

// Seed default tags once
const DEFAULT_TAGS = [
  'Action', 'Adventure', 'Animation', 'Anime', 'Biography', 'Comedy', 'Crime',
  'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Musical',
  'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sport', 'Superhero',
  'Thriller', 'War', 'Western'
]
try {
  const ins = db.prepare('INSERT OR IGNORE INTO tags (name, is_default) VALUES (?, 1)')
  db.transaction(() => DEFAULT_TAGS.forEach((n) => ins.run(n)))()
} catch { /* ignore */ }

export default db
