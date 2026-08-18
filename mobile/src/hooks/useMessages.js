// Chat — full history on focus (GET /api/app/messages, oldest-first, no
// pagination), live appends from the chat:message realtime event, optimistic
// send. Dedupes by _id because the sender receives its own broadcast.
// chatMode ('ai' | 'human') comes back alongside the message list and
// controls whether the "talk to a real person" escalation link shows.
// chatTopic ('' | 'camera' | 'billing' | 'general' | 'other') gates whether
// the AI gives camera-diagnostic behaviour — '' means the client hasn't
// picked a topic yet and the screen should show the topic picker.

import { useState, useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../lib/api';
import { useRealtime } from '../state/RealtimeContext';

export default function useMessages() {
  const { onChatMessage, reconnectTick } = useRealtime();
  const [messages, setMessages] = useState([]);
  const [chatMode, setChatMode] = useState('ai');
  const [chatTopic, setChatTopic] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [settingTopic, setSettingTopic] = useState(false);
  const focusedRef = useRef(false);

  const mergeMessage = useCallback((msg) => {
    setMessages(prev => {
      if (prev.some(m => m._id === msg._id)) return prev;
      // Replace a matching optimistic message (same sender+text, temp id).
      const optimisticIdx = prev.findIndex(m => m.pending && m.sender === msg.sender && m.text === msg.text);
      if (optimisticIdx >= 0) {
        const next = [...prev];
        next[optimisticIdx] = msg;
        return next;
      }
      return [...prev, msg];
    });
  }, []);

  const refetch = useCallback(async () => {
    try {
      setError(null);
      const data = await api('/api/app/messages');
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
      if (data?.chatMode) setChatMode(data.chatMode);
      if (typeof data?.chatTopic === 'string') setChatTopic(data.chatTopic);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // A 'system' message means chatMode may have just flipped (escalate /
  // resolve) — refetch instead of merging so chatMode stays authoritative.
  const handleIncoming = useCallback((msg) => {
    if (msg.sender === 'system') refetch();
    else mergeMessage(msg);
  }, [refetch, mergeMessage]);

  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    refetch();
    const unsubscribe = onChatMessage(handleIncoming);
    return () => {
      focusedRef.current = false;
      unsubscribe();
    };
  }, [refetch, onChatMessage, handleIncoming]));

  // Realtime channel recovered while this screen is open — reconcile.
  useEffect(() => {
    if (focusedRef.current && reconnectTick > 0) refetch();
  }, [reconnectTick, refetch]);

  const send = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const tempId = `tmp-${Date.now()}`;
    setMessages(prev => [...prev, {
      _id: tempId, sender: 'client', text: trimmed,
      createdAt: new Date().toISOString(), pending: true,
    }]);
    setSending(true);
    try {
      const saved = await api('/api/app/messages', { method: 'POST', body: { text: trimmed } });
      setMessages(prev => prev.map(m => (m._id === tempId ? saved : m)));
    } catch (err) {
      setMessages(prev => prev.filter(m => m._id !== tempId));
      throw err;
    } finally {
      setSending(false);
    }
  }, []);

  const escalate = useCallback(async () => {
    setEscalating(true);
    try {
      await api('/api/app/messages/escalate', { method: 'POST' });
      setChatMode('human');
    } finally {
      setEscalating(false);
    }
  }, []);

  // topic: '' clears (returns to the picker), or one of camera/billing/general/other.
  const setTopic = useCallback(async (topic) => {
    setSettingTopic(true);
    try {
      const data = await api('/api/app/messages/topic', { method: 'PATCH', body: { topic } });
      setChatTopic(data?.chatTopic ?? topic);
    } finally {
      setSettingTopic(false);
    }
  }, []);

  return {
    messages, chatMode, chatTopic, loading, error, sending, send,
    escalating, escalate, setTopic, settingTopic, refetch,
  };
}
