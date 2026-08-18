import { useEffect, useRef, useState } from 'react'
import { api } from '../api'

// Real streaming live view using Dahua's plugin-free web player
// (admin/src/lib/dahuaPlayer, from General_VideoPlayer_Web_Javascript_V1.3.6).
// Flow: fetch a fresh stream URL from /cameras/:id/live-stream, hand it to
// the player immediately (the URL is only connectable for ~10s), then the
// player opens a websocket to Dahua's cloud proxy and decodes RTSP in-page
// via WASM. The WASM/asset libraries live in admin/public (WasmLib/,
// 360ARTagAsserts/) because videoPlay-js.js loads them from root-absolute
// paths at runtime.
//
// The player container div must exist in the DOM before player.init() runs
// (it draws its canvas inside it), so the div always renders and the
// connecting/error states overlay it.

// From the SDK's documented error codes (see the PDF in the SDK folder) —
// raw codes are never shown to the user.
const STREAM_ERROR_MESSAGES = {
  500: 'The streaming service reported an error.',
  999: 'The stream stopped responding.',
  503: 'The streaming service is unavailable right now.',
  404: 'The stream address has expired or was not found.',
  202: 'Could not connect to the streaming service.',
  408: 'The connection to the streaming service timed out.',
  409: 'The camera did not respond with a stream.',
  205: 'The camera is busy.',
  206: 'The camera disconnected.',
  101: 'The video source reported an error.',
  201: 'This audio format is not supported.',
}

// Changing loading copy buys more patience than static copy (CLAUDE.md UX
// rules) — connecting can genuinely take a few seconds while Dahua's proxy
// reaches the camera.
const CONNECTING_MESSAGES = ['Connecting to the live stream…', 'Still connecting — reaching the camera…']
const CONNECTING_MESSAGE_SWAP_MS = 4000

// How long to wait for the async CapturePic callback before treating the
// screenshot as failed (it normally resolves in well under a second).
const SCREENSHOT_TIMEOUT_MS = 5000
const SCREENSHOT_BADGE_MS = 2000

export default function LivePlayer({ cameraId, onFallbackToSnapshot }) {
  const [phase, setPhase] = useState('connecting') // connecting | playing | notSetUp | error
  const [error, setError] = useState('')
  const [connectingMsgIdx, setConnectingMsgIdx] = useState(0)
  const [muted, setMuted] = useState(false)
  const [screenshotState, setScreenshotState] = useState(null) // null | 'pending' | 'saved' | 'error'
  const playerRef = useRef(null)
  const cancelledRef = useRef({ current: false })
  const screenshotTimerRef = useRef(null)
  const domId = `dahua-live-${cameraId}`

  function closePlayer() {
    if (playerRef.current) {
      try { playerRef.current.close(domId) } catch { /* never played / already closed */ }
      playerRef.current = null
    }
    if (screenshotTimerRef.current) {
      clearTimeout(screenshotTimerRef.current)
      screenshotTimerRef.current = null
    }
  }

  async function start() {
    const cancelled = cancelledRef.current
    setPhase('connecting')
    setError('')
    setConnectingMsgIdx(0)
    setMuted(false)
    setScreenshotState(null)
    closePlayer()
    try {
      const session = await api.get(`/cameras/${cameraId}/live-stream`)
      if (cancelled.current) return
      if (!session.hasLiveView) { setPhase('notSetUp'); return }

      // Loaded lazily so the 40KB player module + its WASM loaders stay out
      // of the main admin bundle until someone actually opens live view.
      const { default: Player } = await import('../lib/dahuaPlayer/videoPlay-js.js')
      if (cancelled.current) return

      const player = new Player([domId], {
        playStart: () => { if (!cancelled.current) setPhase('playing') },
        playError: (_id, msg) => {
          if (cancelled.current) return
          closePlayer()
          setPhase('error')
          setError(STREAM_ERROR_MESSAGES[msg?.errorCode] || 'The live stream stopped unexpectedly.')
        },
        playFileOver: () => { /* live streams don't "end"; recorded playback is roadmap */ },
        captureCallback: (_id, blob) => {
          if (cancelled.current) return
          if (screenshotTimerRef.current) {
            clearTimeout(screenshotTimerRef.current)
            screenshotTimerRef.current = null
          }
          downloadScreenshot(blob, cameraId)
          setScreenshotState('saved')
          setTimeout(() => setScreenshotState(s => (s === 'saved' ? null : s)), SCREENSHOT_BADGE_MS)
        },
      })
      playerRef.current = player
      await player.init()
      if (cancelled.current) { closePlayer(); return }
      player.play(domId, {
        streamURL: session.url,
        deviceId: session.deviceId,
        channelId: session.channelId,
        bitStream: session.streamType,
        isLive: true,
      })
    } catch (err) {
      if (!cancelled.current) {
        setPhase('error')
        setError(err.message)
      }
    }
  }

  function takeScreenshot() {
    if (!playerRef.current || phase !== 'playing') return
    setScreenshotState('pending')
    screenshotTimerRef.current = setTimeout(() => {
      setScreenshotState('error')
      screenshotTimerRef.current = null
    }, SCREENSHOT_TIMEOUT_MS)
    playerRef.current.screenshot(domId)
  }

  function toggleMute() {
    if (!playerRef.current) return
    const next = !muted
    playerRef.current.setAudioVolume(domId, next ? 0 : 1)
    setMuted(next)
  }

  useEffect(() => {
    const cancelled = { current: false }
    cancelledRef.current = cancelled
    start()
    return () => {
      cancelled.current = true
      closePlayer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraId])

  useEffect(() => {
    if (phase !== 'connecting') return
    const timer = setInterval(
      () => setConnectingMsgIdx(i => Math.min(i + 1, CONNECTING_MESSAGES.length - 1)),
      CONNECTING_MESSAGE_SWAP_MS
    )
    return () => clearInterval(timer)
  }, [phase])

  if (phase === 'notSetUp') {
    return (
      <div className="empty-state" style={{ padding: '1rem 0' }}>
        <div>Live view isn't set up for this camera yet.</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
        <div id={domId} style={{ width: '100%', height: '100%' }} />
        {phase === 'connecting' && (
          <div style={overlayStyle}>
            <i className="fas fa-circle-notch fa-spin" style={{ fontSize: '1.5rem' }} />
            <div style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>{CONNECTING_MESSAGES[connectingMsgIdx]}</div>
          </div>
        )}
        {phase === 'error' && (
          <div style={overlayStyle}>
            <i className="fas fa-exclamation-circle" style={{ fontSize: '1.5rem' }} />
            <div style={{ margin: '0.75rem 0', fontSize: '0.85rem', textAlign: 'center', maxWidth: '80%' }}>{error}</div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-primary" onClick={start}>Try again</button>
              {onFallbackToSnapshot && (
                <button type="button" className="btn btn-ghost" style={{ color: '#fff' }} onClick={onFallbackToSnapshot}>
                  Show snapshots instead
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {phase === 'playing' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0 }}>
            <span style={{ color: '#e53935', fontWeight: 700 }}>● LIVE</span> — streaming in real time.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {screenshotState === 'saved' && <span className="badge badge--success">Screenshot saved</span>}
            {screenshotState === 'error' && <span className="badge badge--danger">Screenshot failed</span>}
            <button type="button" className="btn btn-ghost" onClick={takeScreenshot} disabled={screenshotState === 'pending'}>
              {screenshotState === 'pending' ? 'Saving…' : 'Screenshot'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={toggleMute}>
              {muted ? 'Unmute' : 'Mute'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function downloadScreenshot(blob, cameraId) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `live-${cameraId}-${Date.now()}.jpg`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const overlayStyle = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  background: 'rgba(0,0,0,0.65)',
}
