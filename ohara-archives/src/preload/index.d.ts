export interface MediaItem {
  id: number
  type: 'movie' | 'show'
  title: string
  path: string
  year?: number
  overview?: string
  rating?: number
  poster_base64?: string
  tmdb_id?: number
  scanned_at: string
  duration_seconds?: number
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

export interface Tag {
  id: number
  name: string
  is_default: boolean
}

export interface AppSettings {
  show_paths?: string[]
  movie_paths?: string[]
  tmdb_api_key?: string
  subtitle_size?: 'small' | 'medium' | 'large'
  subtitle_color?: string
  subtitle_bg?: boolean
}

export interface OharaAPI {
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  getSettings: () => Promise<AppSettings>
  saveSettings: (data: Partial<AppSettings>) => Promise<void>
  selectFolder: () => Promise<string | null>
  scanMedia: () => Promise<{ shows: number; movies: number }>
  fetchTmdb: () => Promise<boolean>
  getMedia: (type: 'movie' | 'show') => Promise<MediaItem[]>
  getEpisodes: (showId: number) => Promise<Episode[]>
  saveBookmark: (mediaPath: string, seconds: number) => Promise<void>
  getBookmark: (mediaPath: string) => Promise<Bookmark | null>
  deleteBookmark: (mediaPath: string) => Promise<void>
  markWatched: (mediaPath: string, watched: boolean) => Promise<void>
  getMediaPort: () => Promise<number>
  getSubtitles: (videoPath: string) => Promise<SubtitleFile[]>
  getStreams: (videoPath: string) => Promise<MediaStream[]>
  getDuration: (videoPath: string) => Promise<number>
  needsTranscode: (videoPath: string, audioIdx: number) => Promise<boolean>
  extractSubtitle: (videoPath: string, streamIndex: number) => Promise<string | null>
  getTags: () => Promise<Tag[]>
  addTag: (name: string) => Promise<Tag | null>
  deleteTag: (id: number) => Promise<void>
  getAllMediaTags: () => Promise<Record<number, number[]>>
  setMediaTags: (mediaId: number, tagIds: number[]) => Promise<void>
}

declare global {
  interface Window {
    api: OharaAPI
  }
}
