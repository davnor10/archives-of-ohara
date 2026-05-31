export interface MediaItem {
  id: number
  type: 'movie' | 'show'
  title: string
  title_override?: string | null
  path: string
  year?: number
  overview?: string
  rating?: number
  poster_base64?: string
  tmdb_id?: number
  scanned_at: string
  duration_seconds?: number
  last_watched_at?: string
  favorite?: number // 1 if favorited, 0 or absent otherwise
  auto_subtitle?: number | null // NULL = use global, 0 = off, 1 = on
}

export interface Episode {
  id: number
  show_id: number
  season: number
  episode_number?: number
  title?: string
  path: string
  scanned_at: string
  watched: boolean
  duration_seconds?: number
  watched_count?: number  // populated by get-next-episodes only
  total_count?: number    // populated by get-next-episodes only
}

export interface Bookmark {
  id: number
  media_path: string
  timestamp_seconds: number
  updated_at: string
}

export interface SubtitleFile {
  path: string
  label: string
  vttContent?: string
  streamIndex?: number  // for embedded MKV subtitle tracks
}

export interface MediaStream {
  index: number
  codecType: 'video' | 'audio' | 'subtitle'
  codecName: string
  lang?: string
}

export interface TmdbResult {
  tmdbId: number
  title: string
  year?: number
  posterPath?: string
  overview?: string
}

export interface Tag {
  id: number
  name: string
  is_default: boolean
}

export interface AppSettings {
  show_paths?: string[]
  movie_paths?: string[]
  tmdb_api_key?: string
  theme?: string
  auto_bookmark?: boolean
  auto_subtitle?: boolean
  subtitle_size?: 'small' | 'medium' | 'large' | 'xl' | 'xxl'
  subtitle_color?: string
  subtitle_bg?: boolean
  subtitle_sync_step?: number
  ui_scale?: number
}

export interface OharaAPI {
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  setZoom: (factor: number) => void
  getSettings: () => Promise<AppSettings>
  saveSettings: (data: Partial<AppSettings>) => Promise<void>
  selectFolder: () => Promise<string | null>
  scanMedia: () => Promise<{ shows: number; movies: number }>
  fetchTmdb: () => Promise<boolean>
  getMedia: (type: 'movie' | 'show') => Promise<MediaItem[]>
  getEpisodes: (showId: number) => Promise<Episode[]>
  getNextEpisodes: () => Promise<Record<number, Episode>>
  saveBookmark: (mediaPath: string, seconds: number) => Promise<void>
  getBookmark: (mediaPath: string) => Promise<Bookmark | null>
  deleteBookmark: (mediaPath: string) => Promise<void>
  markWatched: (mediaPath: string, watched: boolean) => Promise<void>
  updateLastWatched: (mediaPath: string) => Promise<{ mediaId: number; type: string; last_watched_at: string } | null>
  getAllBookmarks: () => Promise<Array<{ media_path: string; timestamp_seconds: number }>>
  getMediaPort: () => Promise<number>
  getSubtitles: (videoPath: string) => Promise<SubtitleFile[]>
  getStreams: (videoPath: string) => Promise<MediaStream[]>
  getDuration: (videoPath: string) => Promise<number>
  needsTranscode: (videoPath: string, audioIdx: number) => Promise<boolean>
  extractSubtitle: (videoPath: string, streamIndex: number) => Promise<string | null>
  importSubtitle: () => Promise<SubtitleFile | null>
  getTags: () => Promise<Tag[]>
  addTag: (name: string) => Promise<Tag | null>
  deleteTag: (id: number) => Promise<void>
  getAllMediaTags: () => Promise<Record<number, number[]>>
  setMediaTags: (mediaId: number, tagIds: number[]) => Promise<void>
  fileExists: (filePath: string) => Promise<boolean>
  setFavorite: (mediaId: number, fav: boolean) => Promise<void>
  searchTmdb: (title: string, type: 'movie' | 'show') => Promise<TmdbResult[]>
  setTmdb: (mediaId: number, tmdbId: number, type: 'movie' | 'show') => Promise<string | null>
  setTitleOverride: (mediaId: number, override: string | null) => Promise<void>
  setSeriesSubtitle: (mediaId: number, value: number | null) => Promise<void>
  getAppVersion: () => Promise<string>
  checkForUpdates: () => Promise<{ status: string; message?: string }>
  installUpdate: () => void
  onUpdateAvailable: (cb: (info: unknown) => void) => void
  onUpdateNotAvailable: (cb: () => void) => void
  onUpdateDownloaded: (cb: () => void) => void
  onUpdateError: (cb: (message: string) => void) => void
}

declare global {
  interface Window {
    api: OharaAPI
  }
}
