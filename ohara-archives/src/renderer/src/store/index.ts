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

  loadShows: () => Promise<void>
  loadMovies: () => Promise<void>
  loadEpisodes: (showId: number) => Promise<void>
  scanMedia: () => Promise<void>
  fetchTmdb: () => Promise<void>
  loadSettings: () => Promise<void>
  saveSettings: (data: Partial<AppSettings>) => Promise<void>
  loadTags: () => Promise<void>
  loadMediaTags: () => Promise<void>
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

  loadShows: async () => {
    const shows = await window.api.getMedia('show')
    set({ shows })
  },

  loadMovies: async () => {
    const movies = await window.api.getMedia('movie')
    set({ movies })
  },

  loadEpisodes: async (showId: number) => {
    const eps = await window.api.getEpisodes(showId)
    set((s) => ({ episodes: { ...s.episodes, [showId]: eps } }))
  },

  scanMedia: async () => {
    set({ isScanning: true })
    try {
      const result = await window.api.scanMedia()
      set({ lastScanResult: result })
      await Promise.all([get().loadShows(), get().loadMovies()])
    } finally {
      set({ isScanning: false })
    }
  },

  fetchTmdb: async () => {
    set({ isFetchingTmdb: true })
    try {
      await window.api.fetchTmdb()
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
    set({ tags })
  },

  loadMediaTags: async () => {
    const mediaTags = await window.api.getAllMediaTags()
    set({ mediaTags })
  },

  addTag: async (name: string) => {
    const tag = await window.api.addTag(name)
    if (tag) set((s) => ({ tags: [...s.tags, tag] }))
    return tag
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
