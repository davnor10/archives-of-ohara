import { contextBridge, ipcRenderer } from 'electron'

const api = {
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),

  getSettings: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('get-settings'),
  saveSettings: (data: Record<string, unknown>): Promise<void> =>
    ipcRenderer.invoke('save-settings', data),

  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('select-folder'),

  scanMedia: (): Promise<{ shows: number; movies: number }> => ipcRenderer.invoke('scan-media'),
  fetchTmdb: (): Promise<boolean> => ipcRenderer.invoke('fetch-tmdb'),

  getMedia: (type: 'movie' | 'show'): Promise<unknown[]> => ipcRenderer.invoke('get-media', type),
  getEpisodes: (showId: number): Promise<unknown[]> => ipcRenderer.invoke('get-episodes', showId),

  saveBookmark: (mediaPath: string, seconds: number): Promise<void> =>
    ipcRenderer.invoke('save-bookmark', mediaPath, seconds),
  getBookmark: (mediaPath: string): Promise<unknown | null> =>
    ipcRenderer.invoke('get-bookmark', mediaPath),
  deleteBookmark: (mediaPath: string): Promise<void> =>
    ipcRenderer.invoke('delete-bookmark', mediaPath),

  markWatched: (mediaPath: string, watched: boolean): Promise<void> =>
    ipcRenderer.invoke('mark-watched', mediaPath, watched),

  getMediaPort: (): Promise<number> => ipcRenderer.invoke('get-media-port'),

  getSubtitles: (videoPath: string): Promise<unknown[]> =>
    ipcRenderer.invoke('get-subtitles', videoPath),

  getStreams: (videoPath: string): Promise<unknown[]> =>
    ipcRenderer.invoke('get-streams', videoPath),

  getDuration: (videoPath: string): Promise<number> =>
    ipcRenderer.invoke('get-duration', videoPath),

  needsTranscode: (videoPath: string, audioIdx: number): Promise<boolean> =>
    ipcRenderer.invoke('needs-transcode', videoPath, audioIdx),

  extractSubtitle: (videoPath: string, streamIndex: number): Promise<string | null> =>
    ipcRenderer.invoke('extract-subtitle', videoPath, streamIndex),

  getTags: (): Promise<unknown[]> => ipcRenderer.invoke('get-tags'),
  addTag: (name: string): Promise<unknown | null> => ipcRenderer.invoke('add-tag', name),
  deleteTag: (id: number): Promise<void> => ipcRenderer.invoke('delete-tag', id),
  getAllMediaTags: (): Promise<Record<number, number[]>> => ipcRenderer.invoke('get-all-media-tags'),
  setMediaTags: (mediaId: number, tagIds: number[]): Promise<void> =>
    ipcRenderer.invoke('set-media-tags', mediaId, tagIds)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.api = api
}
