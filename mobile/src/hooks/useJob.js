// One job's detail + the wizard mutations. Renders `initialJob` (passed from
// the Jobs list) instantly, then refetches in the background for signed photo
// URLs and freshness — stale-while-revalidate. Every mutation syncs local
// state from the server's returned job, so the wizard always shows server
// truth after an action.

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { uploadJobPhoto } from '../lib/jobPhotos';

export default function useJob(jobId, initialJob = null) {
  const [job, setJob] = useState(initialJob);
  const [loading, setLoading] = useState(!initialJob);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const refetch = useCallback(async () => {
    try {
      setError(null);
      const fresh = await api(`/api/app/jobs/${jobId}`);
      if (mounted.current) setJob(fresh);
    } catch (err) {
      // Only a whole-screen error when there's nothing cached to show.
      if (mounted.current && !initialJob) setError(err.message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { refetch(); }, [refetch]);

  // Mutations throw on failure (screens surface the message inline) and
  // return the fresh job on success.
  const run = useCallback(async (path, options) => {
    const fresh = await api(path, options);
    if (mounted.current) setJob(fresh);
    return fresh;
  }, []);

  const start = useCallback(
    () => run(`/api/app/jobs/${jobId}/start`, { method: 'PATCH' }),
    [run, jobId]
  );

  // Optimistic with rollback: flips the row instantly, restores the previous
  // job state if the server rejects it.
  const setChecklistItem = useCallback(async (index, done) => {
    let previous;
    setJob((current) => {
      previous = current;
      if (!current) return current;
      const checklist = current.checklist.map((item, i) => (i === index ? { ...item, done } : item));
      return { ...current, checklist };
    });
    try {
      return await run(`/api/app/jobs/${jobId}/checklist/${index}`, { method: 'PATCH', body: { done } });
    } catch (err) {
      if (mounted.current) setJob(previous);
      throw err;
    }
  }, [run, jobId]);

  const addPhoto = useCallback(async (base64) => {
    const path = await uploadJobPhoto({ jobId, base64 });
    return run(`/api/app/jobs/${jobId}/photos`, { method: 'POST', body: { path } });
  }, [run, jobId]);

  const removePhoto = useCallback(
    (index) => run(`/api/app/jobs/${jobId}/photos/${index}`, { method: 'DELETE' }),
    [run, jobId]
  );

  const complete = useCallback(
    (signature) => run(`/api/app/jobs/${jobId}/complete`, { method: 'POST', body: { signature } }),
    [run, jobId]
  );

  return { job, loading, error, refetch, start, setChecklistItem, addPhoto, removePhoto, complete };
}
