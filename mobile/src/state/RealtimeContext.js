// Supabase Realtime subscription — private Broadcast channel `client:<id>`
// (must match server/services/realtime.js). Mounted only inside the `ready`
// auth tree so profile.clientId is always available.
//
// Events (payload = the same Mongo doc the REST call returns):
//   panic:new     → PanicAlert
//   panic:update  → PanicAlert
//   chat:message  → Message

import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

const RealtimeContext = createContext(null);

export function RealtimeProvider({ children }) {
  const { profile } = useAuth();
  const [activePanic, setActivePanic] = useState(null);
  const [panicLoaded, setPanicLoaded] = useState(false);
  // Bumps every time the channel (re)subscribes — screens refetch on it so a
  // connection drop can't leave stale data behind.
  const [reconnectTick, setReconnectTick] = useState(0);
  const chatSubscribers = useRef(new Set());

  const refetchActivePanic = useCallback(async () => {
    try {
      const alert = await api('/api/app/panic/active'); // PanicAlert or null
      setActivePanic(alert && alert.status === 'active' ? alert : null);
    } catch {
      // Leave current state; next reconnect or action will retry.
    } finally {
      setPanicLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!profile?.clientId) return;
    let channel = null;
    let disposed = false;

    refetchActivePanic();

    const setup = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token || disposed) return;

      // Private channels require realtime auth BEFORE subscribe.
      await supabase.realtime.setAuth(token);

      channel = supabase
        .channel(`client:${profile.clientId}`, { config: { private: true } })
        .on('broadcast', { event: 'panic:new' }, ({ payload }) => {
          if (payload?.status === 'active') setActivePanic(payload);
        })
        .on('broadcast', { event: 'panic:update' }, ({ payload }) => {
          if (!payload) return;
          setActivePanic(payload.status === 'active' ? payload : null);
        })
        .on('broadcast', { event: 'chat:message' }, ({ payload }) => {
          if (!payload) return;
          chatSubscribers.current.forEach(cb => cb(payload));
        })
        .subscribe((status, err) => {
          // A non-SUBSCRIBED status means live updates are silently broken
          // (e.g. a Realtime Authorization rejection) — always log it.
          if (status !== 'SUBSCRIBED') {
            console.warn(`[realtime] channel client:${profile.clientId} status=${status}`, err || '');
          }
          if (status === 'SUBSCRIBED') {
            // Fresh or recovered connection — reconcile with REST.
            refetchActivePanic();
            setReconnectTick(t => t + 1);
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
  }, [profile?.clientId, refetchActivePanic]);

  // ChatScreen registers on focus, unregisters on blur.
  const onChatMessage = useCallback((cb) => {
    chatSubscribers.current.add(cb);
    return () => chatSubscribers.current.delete(cb);
  }, []);

  const triggerPanic = useCallback(async () => {
    const alert = await api('/api/app/panic', { method: 'POST' });
    setActivePanic(alert);
    return alert;
  }, []);

  const standDown = useCallback(async () => {
    if (!activePanic?._id) return;
    await api(`/api/app/panic/${activePanic._id}/stand-down`, { method: 'PATCH' });
    setActivePanic(null);
  }, [activePanic]);

  return (
    <RealtimeContext.Provider value={{
      activePanic, panicLoaded, reconnectTick,
      onChatMessage, triggerPanic, standDown, refetchActivePanic,
    }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
