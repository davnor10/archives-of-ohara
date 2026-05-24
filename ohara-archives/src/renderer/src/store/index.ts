import { create } from 'zustand'
import type { MediaItem, Episode, AppSettings, Tag } from '../../../preload/index.d'

interface AppStore {
  shows: MediaItem[]
  movies: MediaItem[]
  episodes: Record<number, Episode[]>
  settings: AppSettings
  isScanning: boolean
  isFetchingTmdb: boolean
  lastScanResult: { shows: number; movies: number } | null
  tags: Tag[]
  mediaTags: Record<number, number[]>
  bookmarks: Record<string, number> // path → timestamp_seconds

  loadShows: () => Promise<void>
  loadMovies: () => Promise<void>
  loadEpisodes: (showId: number) => Promise<void>
  scanMedia: () => Promise<void>
  fetchTmdb: () => Promise<void>
  loadSettings: () => Promise<void>
  saveSettings: (data: Partial<AppSettings>) => Promise<void>
  loadTags: () => Promise<void>
  loadMediaTags: () => Promise<void>
  loadBookmarks: () => Promise<void>
  removeBookmark: (path: string) => Promise<void>
  updateLastWatched: (mediaPath: string) => Promise<void>
  addTag: (name: string) => Promise<Tag | null>
  deleteTag: (id: number) => Promise<void>
  setMediaTags: (mediaId: number, tagIds: number[]) => Promise<void>
}

export const useStore = create<AppStore>((set, get) => ({
  shows: [],
  movies: [],
  episodes: {},
  settings: {},
  isScanning: false,
  isFetchingTmdb: false,
  lastScanResult: null,
  tags: [],
  mediaTags: {},
  bookmarks: {},

  loadShows: async () => {
    if (get().shows.length > 0) return
    const shows = await window.api.getMedia('show')
    set({ shows: shows as MediaItem[] })
  },

  loadMovies: async () => {
    if (get().movies.length > 0) return
    const movies = await window.api.getMedia('movie')
    set({ movies: movies as MediaItem[] })
  },

  loadEpisodes: async (showId: number) => {
    if (get().episodes[showId]) return
    const eps = await window.api.getEpisodes(showId)
    set((s) => ({ episodes: { ...s.episodes, [showId]: eps as Episode[] } }))
  },

  scanMedia: async () => {
    set({ isScanning: true })
    try {
      const result = await window.api.scanMedia()
      set({ lastScanResult: result, shows: [], movies: [], episodes: {} })
      await Promise.all([get().loadShows(), get().loadMovies()])
    } finally {
      set({ isScanning: false })
    }
  },

  fetchTmdb: async () => {
    set({ isFetchingTmdb: true })
    try {
      await window.api.fetchTmdb()
      set({ shows: [], movies: [] })
      await Promise.all([get().loadShows(), get().loadMovies()])
    } finally {
      set({ isFetchingTmdb: false })
    }
  },

  loadSettings: async () => {
    const settings = await window.api.getSettings()
    set({ settings: settings as AppSettings })
  },

  saveSettings: async (data: Partial<AppSettings>) => {
    const merged = { ...get().settings, ...data }
    await window.api.saveSettings(merged as Record<string, unknown>)
    set({ settings: merged })
  },

  loadTags: async () => {
    const tags = await window.api.getTags()
    set({ tags: tags as Tag[] })
  },

  loadMediaTags: async () => {
    const mediaTags = await window.api.getAllMediaTags()
    set({ mediaTags })
  },

  loadBookmarks: async () => {
    const rows = await window.api.getAllBookmarks()
    const bookmarks: Record<string, number> = {}
    for (const r of rows) bookmarks[r.media_path] = r.timestamp_seconds
    set({ bookmarks })
  },

  removeBookmark: async (path: string) => {
    await window.api.deleteBookmark(path)
    set((s) => {
      const bookmarks = { ...s.bookmarks }
      delete bookmarks[path]
      return { bookmarks }
    })
  },

  updateLastWatched: async (mediaPath: string) => {
    const result = await window.api.updateLastWatched(mediaPath)
    if (!result) return
    const { mediaId, type, last_watched_at } = result
    if (type === 'movie') {
      set((s) => ({ movies: s.movies.map((m) => m.id === mediaId ? { ...m, last_watched_at } : m) }))
    } else {
      set((s) => ({ shows: s.shows.map((sh) => sh.id === mediaId ? { ...sh, last_watched_at } : sh) }))
    }
  },

  addTag: async (name: string) => {
    const tag = await window.api.addTag(name)
    if (tag) set((s) => ({ tags: [...s.tags, tag as Tag] }))
    return tag as Tag | null
  },

  deleteTag: async (id: number) => {
    await window.api.deleteTag(id)
    set((s) => ({ tags: s.tags.filter((t) => t.id !== id) }))
  },

  setMediaTags: async (mediaId: number, tagIds: number[]) => {
    await window.api.setMediaTags(mediaId, tagIds)
    set((s) => ({ mediaTags: { ...s.mediaTags, [mediaId]: tagIds } }))
  }
}))
