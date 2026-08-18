// Resolves whether/how a camera can be live-viewed right now —
// GET /api/app/cameras/:id/stream. Mirrors useJob.js's fetch-on-mount shape.
//
// "Live view" is a snapshot re-fetched on LIVE_VIEW_POLL_MS, not true
// streaming video — see HANDOFF.md's 2026-08-03 "live-view architecture
// decided" entry (no self-hosted relay for this phase).

import { useState, useEffect, useCallback, useRef } from 'react';
import { Image } from 'react-native';
import { api } from '../lib/api';

const LIVE_VIEW_POLL_MS = 5000;

// Pass a null/undefined cameraId to disable the hook entirely (no fetches,
// no polling) — used by CameraDetailScreen, which only runs the snapshot
// path when the real stream (LiveStreamPlayer) has been fallen back from.
export default function useCameraStream(cameraId) {
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // `initial` distinguishes the first load (shows the spinner, surfaces any
  // error) from a background poll tick (silent — a single missed poll must
  // not flash a spinner or blank out an already-showing frame). A 503 is
  // always applied even on a poll tick since it's a real, meaningful status
  // change Dahua reported, not a transient fetch failure.
  //
  // Generating a fresh Dahua snapshot is a real multi-hop round trip (server
  // -> Dahua's cloud -> the device -> an OSS upload -> back to us) that can
  // take a few seconds — plausibly longer than the poll interval. Swapping
  // `stream` (and therefore the visible <Image>'s uri) the instant a new URL
  // arrives would abort whatever was still downloading and can leave the
  // image permanently broken if that keeps happening every tick (found live
  // on the admin side 2026-08-03, see BUGS_AND_FIXES.md — same root cause
  // applies here). Image.prefetch() downloads into cache first; `stream`
  // only updates once that resolves, so the old frame stays on screen until
  // the new one is actually ready.
  const fetchOnce = useCallback(async ({ initial } = {}) => {
    if (!cameraId) return;
    try {
      if (initial) { setLoading(true); setError(null); }
      const fresh = await api(`/api/app/cameras/${cameraId}/stream`);
      if (fresh?.hasLiveView && fresh.available && fresh.url) {
        try {
          await Image.prefetch(fresh.url);
        } catch {
          // Fetched fine but the image itself failed to download/decode —
          // surface it the same way a 503 would, keeping the last frame.
          if (mounted.current) setStream({ hasLiveView: true, available: false, reason: 'Received a snapshot but the image failed to load.' });
          return;
        }
      }
      if (mounted.current) setStream(fresh);
    } catch (err) {
      if (err.status === 503) {
        if (mounted.current) setStream({ hasLiveView: true, available: false, reason: err.message });
      } else if (initial && mounted.current) {
        setError(err.message);
      }
    } finally {
      if (initial && mounted.current) setLoading(false);
    }
  }, [cameraId]);

  const refetch = useCallback(() => fetchOnce({ initial: true }), [fetchOnce]);

  useEffect(() => { fetchOnce({ initial: true }); }, [fetchOnce]);

  useEffect(() => {
    if (!cameraId) return;
    const interval = setInterval(() => fetchOnce(), LIVE_VIEW_POLL_MS);
    return () => clearInterval(interval);
  }, [cameraId, fetchOnce]);

  return { stream, loading, error, refetch };
}
