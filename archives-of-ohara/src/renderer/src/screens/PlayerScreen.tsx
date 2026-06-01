import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { SubtitleFile, MediaStream } from '../../../preload/index.d'
import { useStore } from '../store'

interface PlayerState {
  path: string
  title: string
  year?: number
  isEpisode?: boolean
  durationSeconds?: number
  showId?: number
  seasonNumber?: number
  autoSubtitleOverride?: number | null
}

interface VttCue {
  start: number
  end: number
  text: string
}

const PRESET_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const HIDE_DELAY = 3000

function formatTime(sec: number): string {
  if (!isFinite(sec) || isNaN(sec)) return '0:00'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function mediaUrl(filePath: string, audioIdx = 0, startSec = 0): string {
  if (!filePath) return ''
  const params = new URLSearchParams({ path: filePath, audioIdx: String(audioIdx) })
  if (startSec > 0) params.set('startSec', String(startSec))
  return `media://local/?${params.toString()}`
}

function parseVttTime(raw: string): number {
  const s = raw.split(' ')[0] // strip cue settings
  const parts = s.split(':')
  if (parts.length === 3) return +parts[0] * 3600 + +parts[1] * 60 + parseFloat(parts[2])
  return +parts[0] * 60 + parseFloat(parts[1])
}

function parseVttCues(vtt: string): VttCue[] {
  const cues: VttCue[] = []
  const blocks = vtt.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split(/\n\n+/)
  for (const block of blocks) {
    const lines = block.trim().split('\n')
    const arrowIdx = lines.findIndex(l => l.includes('-->'))
    if (arrowIdx < 0) continue
    const [rawStart, rawEnd] = lines[arrowIdx].split('-->')
    const text = lines
      .slice(arrowIdx + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '') // strip VTT tags
      .trim()
    if (text) cues.push({ start: parseVttTime(rawStart.trim()), end: parseVttTime(rawEnd.trim()), text })
  }
  return cues
}

export default function PlayerScreen() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as PlayerState | null
  const { path, title, isEpisode, durationSeconds, showId, seasonNumber, autoSubtitleOverride } = state ?? { path: '', title: '' }
  const { settings, saveSettings, updateLastWatched, loadBookmarks } = useStore()
  const lastWatchedCalledRef = useRef(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const frameCanvasRef = useRef<HTMLCanvasElement>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [playing, setPlaying] = useState(false)
  const [played, setPlayed] = useState(0)
  const [duration, setDuration] = useState(durationSeconds ?? 0)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [customSpeedInput, setCustomSpeedInput] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)

  const [bookmark, setBookmark] = useState<number | null>(null)
  const [showResumePrompt, setShowResumePrompt] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)

  const [subtitles, setSubtitles] = useState<SubtitleFile[]>([])
  const [activeSubIdx, setActiveSubIdx] = useState(-1) // -1 = off
  const [showSubMenu, setShowSubMenu] = useState(false)
  const [activeCues, setActiveCues] = useState<VttCue[]>([])
  const [currentCueText, setCurrentCueText] = useState<string | null>(null)
  const [subOffset, setSubOffset] = useState(0) // seconds; positive = delay, negative = advance
  const [syncStepInput, setSyncStepInput] = useState('')

  const [audioStreams, setAudioStreams] = useState<MediaStream[]>([])
  const [activeAudioIdx, setActiveAudioIdx] = useState(0)
  const [showAudioMenu, setShowAudioMenu] = useState(false)

  const [videoError, setVideoError] = useState<string | null>(null)
  const [bookmarkToast, setBookmarkToast] = useState(false)
  const [isTranscoded, setIsTranscoded] = useState(false)
  const [seekOffset, setSeekOffset] = useState(0)
  const [showFrozenFrame, setShowFrozenFrame] = useState(false)
  const endedRef = useRef(false)
  const seekingRef = useRef(false)
  const lastSeekTimeRef = useRef(0)
  const lockControlsRef = useRef(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  // Refs that shadow state so the unmount cleanup always reads current values
  const playedRef = useRef(0)
  const durationRef = useRef(durationSeconds ?? 0)
  const seekOffsetRef = useRef(0)
  const autoBookmarkRef = useRef(settings.auto_bookmark)
  const autoSubDoneRef = useRef(false)

  const src = mediaUrl(path, activeAudioIdx, isTranscoded ? seekOffset : 0)

  // ── Sync play/pause/volume/speed to the video element ─────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video || !src || !hasStarted) return
    if (playing && !showResumePrompt) {
      video.play().catch(console.error)
    } else {
      video.pause()
    }
  }, [playing, showResumePrompt])

  // ── WebAudio gain node — allows volume above 100% (lazy init on first use) ─

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = muted ? 0 : volume
    } else {
      // Fallback when WebAudio is unavailable (native volume capped at 1.0)
      video.volume = Math.min(volume, 1)
    }
    video.muted = muted
  }, [volume, muted])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = speed
  }, [speed])

  // Keep shadow refs in sync so the unmount cleanup always has current values
  useEffect(() => { playedRef.current = played }, [played])
  useEffect(() => { durationRef.current = duration }, [duration])
  useEffect(() => { seekOffsetRef.current = seekOffset }, [seekOffset])
  useEffect(() => { autoBookmarkRef.current = settings.auto_bookmark }, [settings.auto_bookmark])

  // ── Load bookmark ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!path) return
    window.api.getBookmark(path).then((bm) => {
      if (bm && bm.timestamp_seconds > 5) {
        setBookmark(bm.timestamp_seconds)
        setShowResumePrompt(true)
      }
    })
  }, [path])

  // ── Probe duration + transcode flag on load ────────────────────────────────
  useEffect(() => {
    if (!path) return
    endedRef.current = false
    seekingRef.current = false
    setSeekOffset(0)
    window.api.getDuration(path).then((dur) => { if (dur > 0) setDuration(dur) })
    window.api.needsTranscode(path, 0).then(setIsTranscoded)
  }, [path])

  // ── Listen for ffmpeg transcode errors from the main process ──────────────
  useEffect(() => {
    return window.api.onTranscodeError((errMsg) => {
      setVideoError(`Playback failed - transcode error:\n${errMsg}`)
    })
  }, [])

  // ── Load streams (audio tracks + subtitle tracks) ──────────────────────────
  useEffect(() => {
    if (!path) return
    window.api.getStreams(path).then((streams) => {
      setAudioStreams(streams.filter((s) => s.codecType === 'audio'))
    })
    window.api.getSubtitles(path).then((subs) => {
      setSubtitles(subs)
    })
  }, [path])

  // ── Parse VTT cues when active subtitle changes ────────────────────────────
  useEffect(() => {
    if (activeSubIdx === -1) {
      setActiveCues([])
      setCurrentCueText(null)
      return
    }
    const sub = subtitles[activeSubIdx]
    setActiveCues(sub?.vttContent ? parseVttCues(sub.vttContent) : [])
    setCurrentCueText(null)
  }, [activeSubIdx, subtitles])

  // ── Embedded subtitle: extract and inject on first activation ──────────────
  const activateEmbeddedSub = useCallback(async (subIdx: number) => {
    const sub = subtitles[subIdx]
    if (!sub || sub.streamIndex == null) return
    if (sub.vttContent) {
      setActiveSubIdx(subIdx)
      return
    }
    const vtt = await window.api.extractSubtitle(path, sub.streamIndex)
    if (!vtt) return
    setSubtitles((prev) => {
      const copy = [...prev]
      copy[subIdx] = { ...copy[subIdx], vttContent: vtt }
      return copy
    })
    setActiveSubIdx(subIdx)
  }, [subtitles, path])

  // ── Auto-select first subtitle on load ────────────────────────────────────
  // Per-series override takes priority: 1 = on, 0 = off, null/undefined = use global
  const effectiveAutoSub = autoSubtitleOverride != null ? Boolean(autoSubtitleOverride) : settings.auto_subtitle
  useEffect(() => {
    if (autoSubDoneRef.current || !effectiveAutoSub || subtitles.length === 0) return
    autoSubDoneRef.current = true
    if (subtitles[0].streamIndex != null) {
      activateEmbeddedSub(0)
    } else {
      setActiveSubIdx(0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitles.length, effectiveAutoSub])

  // ── Auto-save bookmark every 10s ──────────────────────────────────────────
  useEffect(() => {
    if (!path || settings.auto_bookmark === false) return
    const interval = setInterval(() => {
      if (playing && duration > 0) {
        const sec = seekOffset + (videoRef.current?.currentTime ?? played * duration)
        // Skip first 10% to avoid spamming bookmarks at the start of an episode
        if (sec > 5 && sec / duration >= 0.1) window.api.saveBookmark(path, sec)
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [playing, played, duration, path, settings.auto_bookmark])

  // ── Save bookmark on exit ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      const video = videoRef.current
      const dur = durationRef.current
      const sec = seekOffsetRef.current + (video?.currentTime ?? playedRef.current * dur)
      if (autoBookmarkRef.current !== false && path) {
        // Skip first 10%; manual 🔖 still saves anywhere
        if (dur > 0 && sec > 5 && sec / dur >= 0.1) window.api.saveBookmark(path, sec)
      }
      // Mark as watched if exiting in the last 10% (skipping credits counts)
      if (isEpisode && path && !endedRef.current && dur > 0 && sec / dur >= 0.9) {
        window.api.markWatched(path, true)
      }
      loadBookmarks()
      // Clean up WebAudio context if it was lazily created
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close() } catch { /* ignore */ }
        audioCtxRef.current = null
        gainNodeRef.current = null
      }
    }
  }, [])

  // ── Controls visibility ────────────────────────────────────────────────────
  const showControls = useCallback(() => {
    lockControlsRef.current = false   // mouse moved — unlock skip-lock
    setControlsVisible(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      if (playing && !lockControlsRef.current) setControlsVisible(false)
    }, HIDE_DELAY)
  }, [playing])

  useEffect(() => {
    if (!playing) {
      setControlsVisible(true)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    } else {
      hideTimerRef.current = setTimeout(() => {
        if (!lockControlsRef.current) setControlsVisible(false)
      }, HIDE_DELAY)
    }
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current) }
  }, [playing])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setFullscreen(true)
    } else {
      document.exitFullscreen()
      setFullscreen(false)
    }
  }

  const seekTo = useCallback((targetSec: number) => {
    const clamped = Math.max(0, Math.min(duration, targetSec))
    if (duration > 0) setPlayed(clamped / duration)
    lastSeekTimeRef.current = Date.now()
    if (isTranscoded) {
      // Capture current frame before the stream restarts so the screen doesn't go black
      const video = videoRef.current
      const canvas = frameCanvasRef.current
      if (video && canvas && video.videoWidth > 0 && video.readyState >= 2) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        try {
          canvas.getContext('2d')?.drawImage(video, 0, 0)
          setShowFrozenFrame(true)
        } catch { /* cross-origin restriction — skip freeze */ }
      }
      seekingRef.current = true
      setSeekOffset(Math.floor(clamped))
    } else {
      if (videoRef.current) videoRef.current.currentTime = clamped
    }
  }, [duration, isTranscoded])

  const skip = useCallback((delta: number) => {
    const currentAbs = isTranscoded
      ? seekOffset + (videoRef.current?.currentTime ?? 0)
      : (videoRef.current?.currentTime ?? 0)
    seekTo(currentAbs + delta)
    lockControlsRef.current = true     // prevent any pending or future timer from hiding
    setControlsVisible(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
  }, [isTranscoded, seekOffset, seekTo])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showResumePrompt) return
      switch (e.code) {
        case 'Space': e.preventDefault(); setPlaying((p) => !p); break
        case 'ArrowRight':
          e.preventDefault()
          skip(10)
          break
        case 'ArrowLeft':
          e.preventDefault()
          skip(-10)
          break
        case 'KeyF': toggleFullscreen(); break
        case 'KeyM': setMuted((m) => !m); break
        case 'Escape':
          if (showSpeedMenu || showSubMenu || showAudioMenu) {
            setShowSpeedMenu(false); setShowSubMenu(false); setShowAudioMenu(false)
          } else if (document.fullscreenElement) {
            document.exitFullscreen()
          } else if (isEpisode && showId) {
            navigate('/shows', { state: { selectedShow: showId, selectedSeason: seasonNumber } })
          } else {
            navigate(-1)
          }
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showResumePrompt, skip, showSpeedMenu, showSubMenu, showAudioMenu])

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seekTo(frac * duration)
  }

  const handleResumeYes = () => {
    if (bookmark !== null) seekTo(bookmark)
    setShowResumePrompt(false)
    setPlaying(true)
    setHasStarted(true)
  }
  const handleResumeNo = () => {
    setShowResumePrompt(false)
    setPlaying(true)
    setHasStarted(true)
    setBookmark(null)
  }

  const handleEnded = () => {
    endedRef.current = true
    setPlaying(false)
    if (path) window.api.deleteBookmark(path)
    if (isEpisode && path) window.api.markWatched(path, true)
  }

  const selectSubtitle = (idx: number) => {
    setShowSubMenu(false)
    if (subtitles[idx]?.streamIndex != null) {
      activateEmbeddedSub(idx)
    } else {
      setActiveSubIdx(idx)
    }
  }

  const handleImportSubtitle = async () => {
    const sub = await window.api.importSubtitle() as SubtitleFile | null
    if (!sub) return
    setSubtitles((prev) => {
      setActiveSubIdx(prev.length)
      return [...prev, sub]
    })
    setShowSubMenu(false)
  }

  const selectAudio = (idx: number) => {
    setShowAudioMenu(false)
    if (idx === activeAudioIdx) return
    const actualSec = seekOffset + (videoRef.current?.currentTime ?? 0)
    setHasStarted(false)
    setPlaying(false)
    seekingRef.current = true
    setSeekOffset(Math.floor(actualSec))
    setActiveAudioIdx(idx)
    window.api.needsTranscode(path, idx).then(setIsTranscoded)
  }

  if (!path) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-dim)' }}>
        No media selected.
      </div>
    )
  }

  const bookmarkFrac = bookmark != null && duration > 0 ? bookmark / duration : null
  const activeSubLabel = activeSubIdx === -1 ? 'CC' : (subtitles[activeSubIdx]?.label ?? 'CC')
  const activeAudioLabel = audioStreams[activeAudioIdx]?.lang?.toUpperCase() ?? 'Audio'

  return (
    <div
      className="player-screen"
      ref={containerRef}
      onMouseMove={showControls}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('.player-controls')) return
        if ((e.target as HTMLElement).closest('.player-back-btn')) return
        if ((e.target as HTMLElement).closest('.resume-prompt')) return
        if (showSubMenu || showAudioMenu) { setShowSubMenu(false); setShowAudioMenu(false); return }
        setPlaying((p) => !p)
      }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('.player-controls')) return
        if ((e.target as HTMLElement).closest('.player-back-btn')) return
        if ((e.target as HTMLElement).closest('.resume-prompt')) return
        toggleFullscreen()
      }}
    >
      <div className={`player-video-wrap ${controlsVisible ? 'controls-visible' : ''}`}>
        <video
          ref={videoRef}
          src={src || undefined}
          crossOrigin="anonymous"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
          onCanPlay={(e) => {
            setVideoError(null)
            setShowFrozenFrame(false)
            const isSeeking = seekingRef.current
            if (hasStarted && !isSeeking && !playing) return
            seekingRef.current = false
            const firstLoad = !hasStarted
            if (firstLoad) {
              setHasStarted(true)
              if (!lastWatchedCalledRef.current) {
                lastWatchedCalledRef.current = true
                updateLastWatched(path)
              }
            }
            if (!showResumePrompt && (firstLoad || playing)) {
              e.currentTarget.play().catch(console.error)
              if (firstLoad) setPlaying(true)
            }
          }}
          onError={(e) => {
            const el = e.currentTarget
            const code = el.error?.code ?? 0
            const msg = el.error?.message ?? 'unknown'
            if (code === 1) return

            const duringSeeking = seekingRef.current || Date.now() - lastSeekTimeRef.current < 3000

            // Suppress NETWORK errors during/after a seek (dying old FFmpeg stream) or after natural end
            if (code === 2 && (endedRef.current || duringSeeking)) return
            // Suppress SRC_NOT_SUPPORTED during/after a seek — when src changes to include startSec,
            // Chromium can fire a transient code-4 error before the new FFmpeg stream is ready.
            // Letting it through clears seekingRef, which causes onCanPlay to return early and
            // the video never plays.
            if (code === 4 && duringSeeking) return

            seekingRef.current = false
            setShowFrozenFrame(false)
            if (code === 2) {
              // Fire-and-forget: check if file is missing and update the message
              window.api.fileExists(path).then((exists) => {
                setVideoError(exists
                  ? `NETWORK: ${msg}`
                  : `File not found - it may have been moved or deleted.\n\n${path}`)
              })
              return
            }
            const labels: Record<number, string> = { 2: 'NETWORK', 3: 'DECODE', 4: 'SRC_NOT_SUPPORTED' }
            setVideoError(`${labels[code] ?? `Error ${code}`}: ${msg}`)
          }}
          onTimeUpdate={(e) => {
            const t = seekOffset + e.currentTarget.currentTime
            if (duration > 0) setPlayed(t / duration)
            if (activeCues.length > 0) {
              const adjusted = t - subOffset
              const cue = activeCues.find(c => adjusted >= c.start && adjusted < c.end) ?? null
              const text = cue?.text ?? null
              setCurrentCueText(prev => prev !== text ? text : prev)
            } else if (currentCueText !== null) {
              setCurrentCueText(null)
            }
          }}
          onDurationChange={(e) => {
            const d = e.currentTarget.duration
            if (isFinite(d) && d > 0) setDuration((prev) => (prev > 0 ? prev : d))
          }}
          onEnded={handleEnded}
        />

        {/* Frozen frame shown during transcoded seek */}
        <canvas
          ref={frameCanvasRef}
          style={{
            display: showFrozenFrame ? 'block' : 'none',
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            background: '#000',
            zIndex: 5,
          }}
        />

        {/* Subtitle overlay */}
        {currentCueText && !showFrozenFrame && (
          <div
            className="subtitle-overlay"
            style={{
              fontSize: settings.subtitle_size === 'small' ? 16 : settings.subtitle_size === 'large' ? 30 : settings.subtitle_size === 'xl' ? 42 : settings.subtitle_size === 'xxl' ? 56 : 22,
              color: settings.subtitle_color ?? '#ffffff',
              background: settings.subtitle_bg ? 'rgba(0,0,0,0.7)' : undefined,
              padding: settings.subtitle_bg ? '2px 12px' : undefined,
              borderRadius: settings.subtitle_bg ? 4 : undefined,
            }}
          >
            {currentCueText}
          </div>
        )}

        {videoError && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(180,20,20,0.92)', color: '#fff', padding: '20px 28px', borderRadius: 8, zIndex: 20, maxWidth: '80%', textAlign: 'center', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Video Error</div>
            {videoError}
          </div>
        )}

        <button
          className="player-back-btn"
          style={{ opacity: controlsVisible ? 1 : 0, transition: 'opacity 0.3s' }}
          onClick={(e) => {
            e.stopPropagation()
            if (isEpisode && showId) navigate('/shows', { state: { selectedShow: showId, selectedSeason: seasonNumber } })
            else navigate(-1)
          }}
        >
          ← Back
        </button>

        {showResumePrompt && (
          <div className="resume-prompt" onClick={(e) => e.stopPropagation()}>
            <h3>Resume Voyage?</h3>
            <p>Continue from {formatTime(bookmark ?? 0)}?</p>
            <div className="resume-actions">
              <button className="btn btn-ghost" onClick={handleResumeNo}>Start Over</button>
              <button className="btn btn-primary" onClick={handleResumeYes}>▶ Resume</button>
            </div>
          </div>
        )}

        {bookmarkToast && (
          <div className="bookmark-toast">
            🔖 Bookmarked
          </div>
        )}

        <div
          className={`player-controls ${controlsVisible ? '' : 'hidden'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="seek-bar-wrap" onClick={handleSeekClick}>
            <div className="seek-bar-track">
              <div className="seek-bar-fill" style={{ width: `${played * 100}%` }} />
              {bookmarkFrac != null && (
                <div className="seek-bookmark-marker" style={{ left: `${bookmarkFrac * 100}%` }} />
              )}
            </div>
          </div>

          <div className="player-row">
            <button className="player-btn" onClick={() => setPlaying((p) => !p)}>
              {playing ? '⏸' : '▶'}
            </button>
            <button className="player-btn" style={{ fontSize: 16 }} onClick={() => skip(-10)}>⏪</button>
            <button className="player-btn" style={{ fontSize: 16 }} onClick={() => skip(10)}>⏩</button>

            <span className="player-time">
              {formatTime(played * duration)} / {formatTime(duration)}
            </span>

            <div className="player-title">{title}</div>

            <div className="volume-wrap">
              <button className="player-btn" style={{ fontSize: 16 }} onClick={() => setMuted((m) => !m)}>
                {muted ? '🔇' : volume > 0.5 ? '🔊' : '🔉'}
              </button>
              {!muted && volume > 1 && (
                <span style={{ fontSize: 11, color: 'var(--gold)', minWidth: 34, textAlign: 'right' }}>
                  {Math.round(volume * 100)}%
                </span>
              )}
              <input
                type="range" className="volume-slider"
                min={0} max={2} step={0.01}
                value={muted ? 0 : volume}
                onChange={async (e) => {
                  const v = parseFloat(e.target.value)
                  if (v > 1) {
                    // Lazy-init WebAudio gain node on first above-100% use.
                    // Await ctx.resume() so the context is running before audio flows through it —
                    // a fire-and-forget resume leaves the context suspended, silencing the hijacked audio.
                    if (!audioCtxRef.current) {
                      const video = videoRef.current
                      if (video) {
                        try {
                          const ctx = new AudioContext()
                          await ctx.resume()
                          const source = ctx.createMediaElementSource(video)
                          const gain = ctx.createGain()
                          gain.gain.value = v
                          source.connect(gain)
                          gain.connect(ctx.destination)
                          audioCtxRef.current = ctx
                          gainNodeRef.current = gain
                          video.volume = 1
                        } catch { /* WebAudio unavailable */ }
                      }
                    }
                    if (gainNodeRef.current) gainNodeRef.current.gain.value = v
                  } else {
                    if (gainNodeRef.current) gainNodeRef.current.gain.value = v
                    if (videoRef.current && !audioCtxRef.current) videoRef.current.volume = v
                  }
                  setVolume(v)
                  setMuted(false)
                }}
              />
            </div>

            <div className="player-menu-wrap" style={{ position: 'relative' }}>
              <button
                className="speed-btn"
                onClick={() => { setShowSpeedMenu((v) => !v); setShowSubMenu(false); setShowAudioMenu(false) }}
              >
                {Number.isInteger(speed) ? speed : parseFloat(speed.toFixed(2))}×
              </button>
              {showSpeedMenu && (
                <div className="player-track-menu" style={{ minWidth: 110 }}>
                  {PRESET_SPEEDS.map((s) => (
                    <button
                      key={s}
                      className={`track-menu-item ${speed === s ? 'active' : ''}`}
                      onClick={() => { setSpeed(s); setShowSpeedMenu(false); setCustomSpeedInput('') }}
                    >
                      {s}×
                    </button>
                  ))}
                  <div style={{ padding: '6px 10px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                      type="number"
                      min={0.1}
                      max={10}
                      step={0.1}
                      placeholder="custom"
                      value={customSpeedInput}
                      onChange={(e) => setCustomSpeedInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const v = parseFloat(customSpeedInput)
                          if (v >= 0.1 && v <= 10) { setSpeed(v); setShowSpeedMenu(false) }
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: 60, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 3, color: '#fff', fontSize: 12, padding: '3px 6px', outline: 'none' }}
                    />
                    <button
                      className="track-menu-item"
                      style={{ padding: '3px 8px', flex: 'none', minWidth: 'unset' }}
                      onClick={() => {
                        const v = parseFloat(customSpeedInput)
                        if (v >= 0.1 && v <= 10) { setSpeed(v); setShowSpeedMenu(false) }
                      }}
                    >
                      Set
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Audio track selector */}
            {audioStreams.length > 1 && (
              <div className="player-menu-wrap" style={{ position: 'relative' }}>
                <button
                  className={`player-btn sub-btn ${activeAudioIdx > 0 ? 'active' : ''}`}
                  onClick={() => { setShowAudioMenu((v) => !v); setShowSubMenu(false); setShowSpeedMenu(false) }}
                  title="Select audio track"
                >
                  {activeAudioLabel}
                </button>
                {showAudioMenu && (
                  <div className="player-track-menu">
                    {audioStreams.map((s, i) => (
                      <button
                        key={i}
                        className={`track-menu-item ${i === activeAudioIdx ? 'active' : ''}`}
                        onClick={() => selectAudio(i)}
                      >
                        {s.lang ? s.lang.toUpperCase() : `Track ${i + 1}`}
                        <span className="track-codec">{s.codecName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Subtitle selector */}
            {(
              <div className="player-menu-wrap" style={{ position: 'relative' }}>
                <button
                  className={`player-btn sub-btn ${activeSubIdx !== -1 ? 'active' : ''}`}
                  onClick={() => { setShowSubMenu((v) => !v); setShowAudioMenu(false); setShowSpeedMenu(false) }}
                  title="Select subtitles"
                >
                  {activeSubLabel}
                </button>
                {showSubMenu && (
                  <div className="player-track-menu">
                    <button
                      className={`track-menu-item ${activeSubIdx === -1 ? 'active' : ''}`}
                      onClick={() => { setActiveSubIdx(-1); setShowSubMenu(false) }}
                    >
                      Off
                    </button>
                    {subtitles.map((s, i) => (
                      <button
                        key={i}
                        className={`track-menu-item ${i === activeSubIdx ? 'active' : ''}`}
                        onClick={() => selectSubtitle(i)}
                      >
                        {s.label}
                        {s.streamIndex != null && <span className="track-codec">embedded</span>}
                      </button>
                    ))}
                    <button
                      className="track-menu-item"
                      style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}
                      onClick={handleImportSubtitle}
                    >
                      + Import from file…
                    </button>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '6px 10px 4px', display: 'flex', flexDirection: 'column', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', flex: 1 }}>Sync</span>
                        <button
                          className="track-menu-item"
                          style={{ padding: '2px 8px', minWidth: 'unset', flex: 'none' }}
                          onClick={() => { const step = parseFloat(syncStepInput) || settings.subtitle_sync_step || 0.5; setSubOffset((o) => Math.round((o - step) * 100) / 100) }}
                          title="Earlier (−step)"
                        >←</button>
                        <span
                          style={{ fontSize: 12, minWidth: 48, textAlign: 'center', cursor: 'pointer', color: subOffset !== 0 ? '#f0c040' : 'rgba(255,255,255,0.7)' }}
                          title="Click to reset"
                          onClick={() => setSubOffset(0)}
                        >
                          {subOffset > 0 ? '+' : ''}{subOffset.toFixed(1)}s
                        </span>
                        <button
                          className="track-menu-item"
                          style={{ padding: '2px 8px', minWidth: 'unset', flex: 'none' }}
                          onClick={() => { const step = parseFloat(syncStepInput) || settings.subtitle_sync_step || 0.5; setSubOffset((o) => Math.round((o + step) * 100) / 100) }}
                          title="Later (+step)"
                        >→</button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', flex: 1 }}>Step</span>
                        <input
                          type="number"
                          min={0.1}
                          max={30}
                          step={0.1}
                          placeholder={String(settings.subtitle_sync_step ?? 0.5)}
                          value={syncStepInput}
                          onChange={(e) => setSyncStepInput(e.target.value)}
                          onBlur={(e) => {
                            const v = parseFloat(e.target.value)
                            if (v >= 0.1 && v <= 30) { saveSettings({ subtitle_sync_step: v }); setSyncStepInput('') }
                            else setSyncStepInput('')
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const v = parseFloat(syncStepInput)
                              if (v >= 0.1 && v <= 30) { saveSettings({ subtitle_sync_step: v }); setSyncStepInput('') }
                              else setSyncStepInput('')
                            }
                            e.stopPropagation()
                          }}
                          style={{ width: 56, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 3, color: '#fff', fontSize: 12, padding: '3px 6px', outline: 'none' }}
                        />
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>s</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              className={`player-btn${bookmarkToast ? ' bookmark-btn-glow' : ''}`}
              onClick={() => {
                if (path) {
                  window.api.saveBookmark(path, played * duration)
                  setBookmarkToast(true)
                  setTimeout(() => setBookmarkToast(false), 1800)
                }
              }}
              title="Save bookmark"
            >
              🔖
            </button>

            <button className="player-btn" onClick={toggleFullscreen}>
              {fullscreen ? '⊡' : '⛶'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
