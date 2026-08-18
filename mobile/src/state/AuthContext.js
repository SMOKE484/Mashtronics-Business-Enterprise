// Auth state machine: loading → signedOut | unlinked | ready.
// "unlinked" = signed in to Supabase but no Client/Technician/ResponseOfficer
// record claimed yet — the user must enter the admin-issued invite code
// (POST /api/app/auth/claim, which resolves the code against all three).
// "ready" = /api/app/me or /api/app/staff-me resolved; profile.accountType
// ('client' | 'staff') and, for staff, profile.staffType decide which
// navigator RootNavigator renders.

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { api, ApiError, onUnlinked } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading'); // loading | signedOut | unlinked | ready | error
  const [profile, setProfile] = useState(null);
  const sessionRef = useRef(null);

  // Returns the status it resolved to, so interactive flows (sign-in) can
  // react to the outcome even when the status value didn't change — a
  // same-value setStatus doesn't re-render, so callers can't rely on it.
  //
  // Tries the client profile first, then falls back to the combined staff
  // profile (technician or response officer) before giving up to
  // 'unlinked' — one Supabase identity is always exactly one of the three,
  // never more than one, so this is a strict fallback chain, not a merge.
  const resolveProfile = useCallback(async () => {
    try {
      const me = await api('/api/app/me');
      setProfile({ ...me, accountType: 'client' });
      setStatus('ready');
      return 'ready';
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // "No linked client account" → try staff before assuming unlinked.
        // Other 401s (bad/expired token that Supabase couldn't refresh) →
        // treat as signed out.
        if (err.message === 'No linked client account') {
          try {
            const staffMe = await api('/api/app/staff-me');
            setProfile({ ...staffMe, accountType: 'staff' });
            setStatus('ready');
            return 'ready';
          } catch (staffErr) {
            if (staffErr instanceof ApiError && staffErr.status === 401 && staffErr.message === 'No linked staff account') {
              setStatus('unlinked');
              return 'unlinked';
            }
            setStatus('signedOut');
            return 'signedOut';
          }
        }
        setStatus('signedOut');
        return 'signedOut';
      }
      setStatus('error'); // network / server down — show retry UI
      return 'error';
    }
  }, []);

  useEffect(() => {
    onUnlinked(() => {
      setProfile(null);
      setStatus('unlinked');
    });

    supabase.auth.getSession().then(({ data }) => {
      sessionRef.current = data?.session ?? null;
      if (!data?.session) setStatus('signedOut');
      else resolveProfile();
    }).catch((err) => {
      console.error('[AuthContext] getSession failed:', err);
      setStatus('error');
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      sessionRef.current = session;
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setStatus('signedOut');
      } else if (event === 'SIGNED_IN' && session) {
        // Deferred: awaiting other supabase calls inside this callback can
        // deadlock supabase-js (resolveProfile → api → auth.getSession).
        setTimeout(resolveProfile, 0);
      }
      // TOKEN_REFRESHED is consumed by RealtimeContext via its own listener.
    });
    return () => sub.subscription.unsubscribe();
  }, [resolveProfile]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Resolve the profile here instead of relying only on the SIGNED_IN
    // listener: if the server rejects the token, status is set back to
    // 'signedOut' — the value it already holds — so nothing re-renders and
    // the sign-in screen would hang on its spinner with zero feedback.
    const outcome = await resolveProfile();
    if (outcome === 'signedOut') {
      // Supabase accepted the password but our server rejected the token.
      // Sign out so local state matches, and surface it to the sign-in form.
      await supabase.auth.signOut().catch(() => {});
      throw new Error(
        "Signed in, but the server couldn't verify your account. Please try again — if it keeps happening, contact Mashtronics on 011 765 4148."
      );
    }
    // 'ready' / 'unlinked' swap the navigator; 'error' shows the retry screen.
  }, [resolveProfile]);

  // phone/channel are stashed in Supabase user_metadata at sign-up so they
  // survive the email-confirmation gap and are available later — from
  // whichever device/session first reaches 'unlinked' — with no extra
  // server-side storage needed pre-link.
  const signUp = useCallback(async (email, password, phone, channel) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { phone, channel } },
    });
    if (error) throw error;
    // With email confirmation off, a session comes back immediately.
    // With it on, the user must confirm before signing in.
    return { needsConfirmation: !data.session };
  }, []);

  const claim = useCallback(async (inviteCode) => {
    await api('/api/app/auth/claim', { method: 'POST', body: { inviteCode: inviteCode.trim().toUpperCase() } });
    await resolveProfile();
  }, [resolveProfile]);

  // Self-service invite delivery — sends to whatever contactPhone/contactEmail
  // is already on file for the matching Client, never to the values passed
  // here (those are only a lookup key). Always resolves to the same generic
  // shape on success; throws ApiError on a genuine input/rate-limit problem.
  const requestInvite = useCallback(async (phone, channel) => {
    return api('/api/app/auth/request-invite', { method: 'POST', body: { phone, channel } });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const retry = useCallback(() => {
    setStatus('loading');
    supabase.auth.getSession().then(({ data }) => {
      if (!data?.session) setStatus('signedOut');
      else resolveProfile();
    });
  }, [resolveProfile]);

  const getUserEmail = useCallback(() => sessionRef.current?.user?.email ?? '', []);
  const getUserMetadata = useCallback(() => sessionRef.current?.user?.user_metadata ?? {}, []);

  return (
    <AuthContext.Provider value={{
      status, profile, signIn, signUp, claim, requestInvite, signOut, retry,
      getUserEmail, getUserMetadata,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
