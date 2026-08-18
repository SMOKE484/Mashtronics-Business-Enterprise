// Technician's active job queue — GET /api/app/jobs (all active jobs,
// earliest scheduled first, no day-bounds filter), kept live via a Supabase
// Realtime private channel `staff:<staffId>` (server/services/realtime.js
// broadcastToStaff, triggered from routes/jobs.js on admin create/update).
// Same private-channel-then-subscribe pattern as RealtimeContext.js.

import { useState, useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { useAuth } from '../state/AuthContext';

const ACTIVE_STATUSES = ['upcoming', 'in-progress'];

function sortJobs(list) {
  return [...list].sort((a, b) => {
    const dateDiff = new Date(a.scheduledDate) - new Date(b.scheduledDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.time || '').localeCompare(b.time || '');
  });
}

export default function useMyJobs() {
  const { profile } = useAuth();
  const staffId = profile?.staffId;
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      setError(null);
      const list = await api('/api/app/jobs');
      setJobs(Array.isArray(list) ? sortJobs(list) : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  // Live updates while the screen isn't necessarily focused (e.g. app open
  // on another tab) — merges in place rather than waiting for a refocus.
  useEffect(() => {
    if (!staffId) return;
    let channel = null;
    let disposed = false;

    const setup = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token || disposed) return;

      await supabase.realtime.setAuth(token);

      channel = supabase
        .channel(`staff:${staffId}`, { config: { private: true } })
        .on('broadcast', { event: 'job:upsert' }, ({ payload }) => {
          if (!payload?.id) return;
          setJobs((current) => {
            const withoutIt = current.filter((j) => j.id !== payload.id);
            const next = ACTIVE_STATUSES.includes(payload.status) ? [...withoutIt, payload] : withoutIt;
            return sortJobs(next);
          });
        })
        .on('broadcast', { event: 'job:remove' }, ({ payload }) => {
          if (!payload?.id) return;
          setJobs((current) => current.filter((j) => j.id !== payload.id));
        })
        .on('broadcast', { event: 'jobs:refresh' }, () => {
          refetch();
        })
        .subscribe((status, err) => {
          if (status !== 'SUBSCRIBED') {
            console.warn(`[realtime] channel staff:${staffId} status=${status}`, err || '');
          } else {
            // Fresh or recovered connection — reconcile with REST.
            refetch();
          }
        });
    };
    setup();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        supabase.realtime.setAuth(session.access_token);
      }
    });

    return () => {
      disposed = true;
      sub.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [staffId, refetch]);

  return { jobs, loading, error, refetch };
}
