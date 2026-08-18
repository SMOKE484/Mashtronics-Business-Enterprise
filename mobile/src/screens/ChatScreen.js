// Chat — live support thread. History via GET /api/app/messages, new
// messages via the chat:message realtime event, optimistic sends.
// AI-first: chatMode 'ai' means the assistant auto-replies (with the
// client's real camera status as context); a client can escalate to a real
// person any time, which flips chatMode server-side to 'human'.
// Ported from mashtronics/screen-chat.jsx.

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useMessages from '../hooks/useMessages';
import { Avatar, IconButton } from '../ui';
import Icon from '../ui/Icon';
import { T, F } from '../theme/tokens';

const AI_WAIT_TIMEOUT_MS = 20000;

const TOPICS = [
  { key: 'camera', label: 'Camera / technical issue', sub: 'Offline camera, weak signal, NVR issues', icon: 'camera' },
  { key: 'billing', label: 'Billing', sub: 'Invoices, payments, account charges', icon: 'doc' },
  { key: 'general', label: 'General question', sub: 'Services, pricing, how things work', icon: 'chat' },
  { key: 'other', label: 'Something else', sub: 'Anything not covered above', icon: 'info' },
];

function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function senderLabel(m) {
  if (m.sender === 'ai') return 'Mashtronics AI';
  return m.senderName ? `${m.senderName} · Mashtronics` : 'Mashtronics Support';
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const {
    messages, chatMode, chatTopic, loading, send, sending, escalate, escalating,
    setTopic, settingTopic,
  } = useMessages();
  const [draft, setDraft] = useState('');
  const [escalateError, setEscalateError] = useState('');
  const [topicError, setTopicError] = useState('');
  const [awaitingAi, setAwaitingAi] = useState(false);
  const aiWaitTimer = useRef(null);
  // Gate the camera-diagnostic AI behaviour behind an explicit topic pick.
  // Wait for the initial fetch so returning clients who already picked a
  // topic don't see the picker flash before their real chatTopic loads.
  const needsTopic = !loading && chatMode === 'ai' && !chatTopic;

  // Clear the "AI is checking…" indicator as soon as the AI (or a fallback
  // system message) actually answers, otherwise after a timeout.
  useEffect(() => {
    if (!awaitingAi) return;
    const last = messages[messages.length - 1];
    if (last && (last.sender === 'ai' || last.sender === 'system')) {
      setAwaitingAi(false);
    }
  }, [messages, awaitingAi]);

  useEffect(() => () => clearTimeout(aiWaitTimer.current), []);

  // Build a render list (bubbles + day dividers) in chronological order,
  // then reverse it for the inverted FlatList.
  const items = useMemo(() => {
    const out = [];
    let lastDay = null;
    messages.forEach((m, i) => {
      const day = dayLabel(m.createdAt);
      if (day !== lastDay) {
        out.push({ type: 'day', key: `day-${day}-${i}`, label: day });
        lastDay = day;
      }
      const prev = messages[i - 1];
      out.push({
        type: m.sender === 'system' ? 'system' : 'msg',
        key: m._id,
        msg: m,
        showName: (m.sender === 'admin' || m.sender === 'ai') && (!prev || prev.sender !== m.sender),
      });
    });
    if (awaitingAi) {
      out.push({ type: 'typing', key: 'ai-typing' });
    }
    return out.reverse();
  }, [messages, awaitingAi]);

  const onSend = async () => {
    const text = draft;
    setDraft('');
    try {
      await send(text);
      if (chatMode === 'ai') {
        setAwaitingAi(true);
        clearTimeout(aiWaitTimer.current);
        aiWaitTimer.current = setTimeout(() => setAwaitingAi(false), AI_WAIT_TIMEOUT_MS);
      }
    } catch {
      setDraft(text); // restore so the user can retry
    }
  };

  const onEscalate = async () => {
    setEscalateError('');
    try {
      await escalate();
    } catch (err) {
      setEscalateError(err.message || "Couldn't connect you to a rep — please try again.");
    }
  };

  const onPickTopic = async (topic) => {
    setTopicError('');
    try {
      await setTopic(topic);
    } catch (err) {
      setTopicError(err.message || "Couldn't save that — please try again.");
    }
  };

  const onChangeTopic = () => {
    setTopicError('');
    setTopic('').catch(err => setTopicError(err.message || "Couldn't change topic — please try again."));
  };

  const renderItem = ({ item }) => {
    if (item.type === 'day') {
      return (
        <Text style={{
          textAlign: 'center', fontSize: 10.5, color: T.textMuted,
          letterSpacing: 1, textTransform: 'uppercase',
          paddingTop: 4, paddingBottom: 8, fontFamily: F.medium,
        }}>{item.label}</Text>
      );
    }
    if (item.type === 'typing') {
      return (
        <View style={{ alignItems: 'flex-start', maxWidth: '85%', marginBottom: 10 }}>
          <View style={{
            backgroundColor: T.elev, paddingVertical: 9, paddingHorizontal: 13,
            borderRadius: 18, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: T.hairline,
          }}>
            <Text style={{ color: T.textDim, fontSize: 13, fontFamily: F.regular, fontStyle: 'italic' }}>
              Mashtronics AI is checking your account…
            </Text>
          </View>
        </View>
      );
    }
    if (item.type === 'system') {
      return (
        <Text style={{
          textAlign: 'center', fontSize: 11.5, color: T.textMuted,
          paddingVertical: 8, paddingHorizontal: 24, fontFamily: F.regular, lineHeight: 16,
        }}>{item.msg.text}</Text>
      );
    }
    const m = item.msg;
    const isMe = m.sender === 'client';
    return (
      <View style={{
        alignItems: isMe ? 'flex-end' : 'flex-start',
        alignSelf: isMe ? 'flex-end' : 'flex-start',
        maxWidth: '85%', gap: 2, marginBottom: 10,
      }}>
        {item.showName && (
          <Text style={{ fontSize: 10.5, color: T.textMuted, paddingHorizontal: 4, paddingBottom: 2, fontFamily: F.regular }}>
            {senderLabel(m)}
          </Text>
        )}
        <View style={{
          backgroundColor: isMe ? T.info : T.elev,
          paddingVertical: 9, paddingHorizontal: 13,
          borderRadius: 18,
          borderBottomRightRadius: isMe ? 6 : 18,
          borderBottomLeftRadius: isMe ? 18 : 6,
          borderWidth: isMe ? 0 : 1, borderColor: T.hairline,
          opacity: m.pending ? 0.6 : 1,
        }}>
          <Text style={{ color: isMe ? '#fff' : T.text, fontSize: 13.5, lineHeight: 19, fontFamily: F.regular }}>
            {m.text}
          </Text>
        </View>
        <Text style={{ fontSize: 10, color: T.textMuted, paddingHorizontal: 6, fontFamily: F.regular }}>
          {m.pending ? 'sending…' : formatTime(m.createdAt)}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: T.ink }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 6, paddingBottom: 12, paddingHorizontal: 16,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        borderBottomWidth: 1, borderBottomColor: T.hairline,
      }}>
        <View>
          <Avatar name="Mashtronics Support" source={require('../../assets/images/support-avatar.png')} size={40} />
          <View style={{
            position: 'absolute', bottom: 0, right: 0, width: 11, height: 11,
            borderRadius: 6, backgroundColor: T.online, borderWidth: 2, borderColor: T.ink,
          }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14.5, fontFamily: F.semibold, color: T.text }}>Mashtronics Support</Text>
          <Text style={{ fontSize: 11.5, color: T.online, fontFamily: F.regular }}>
            {chatMode === 'ai' ? '● Online · AI-assisted, replies in seconds' : '● Online · typically replies in minutes'}
          </Text>
        </View>
        <IconButton icon="phone" />
      </View>

      {/* Messages */}
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={item => item.key}
        inverted
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14 }}
        ListEmptyComponent={!loading ? (
          <View style={{ transform: [{ scaleY: -1 }], padding: 24, alignItems: 'center' }}>
            <Text style={{ color: T.textDim, fontSize: 13, fontFamily: F.regular, textAlign: 'center', lineHeight: 19 }}>
              {needsTopic
                ? "No messages yet. Pick what you'd like help with below to get started."
                : 'No messages yet. Say hello — our AI assistant can help right away, and you can ask for a real person any time.'}
            </Text>
          </View>
        ) : null}
      />

      {needsTopic ? (
        /* Topic picker — gates camera-diagnostic AI behaviour until the
           client tells us what this conversation is actually about. */
        <View style={{
          paddingHorizontal: 16, paddingTop: 4, paddingBottom: Math.max(insets.bottom, 14),
          borderTopWidth: 1, borderTopColor: T.hairline, backgroundColor: T.ink,
        }}>
          <Text style={{ fontSize: 12.5, color: T.textDim, fontFamily: F.medium, textAlign: 'center', marginBottom: 10 }}>
            What would you like help with?
          </Text>
          <View style={{ gap: 8 }}>
            {TOPICS.map(t => (
              <Pressable
                key={t.key}
                onPress={() => onPickTopic(t.key)}
                disabled={settingTopic}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  padding: 12, borderRadius: 14,
                  backgroundColor: T.surface, borderWidth: 1, borderColor: T.hairline,
                  opacity: pressed || settingTopic ? 0.7 : 1,
                })}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 10, backgroundColor: T.elev,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name={t.icon} size={16} color={T.info} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5, fontFamily: F.semibold, color: T.text }}>{t.label}</Text>
                  <Text style={{ fontSize: 11, color: T.textMuted, fontFamily: F.regular, marginTop: 1 }}>{t.sub}</Text>
                </View>
                <Icon name="chevR" size={16} color={T.textMuted} />
              </Pressable>
            ))}
          </View>
          {!!topicError && (
            <Text style={{ fontSize: 11.5, color: T.danger, fontFamily: F.regular, marginTop: 8, textAlign: 'center' }}>
              {topicError}
            </Text>
          )}
          <Pressable onPress={onEscalate} disabled={escalating} style={{ marginTop: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: escalating ? T.textMuted : T.info, fontFamily: F.medium }}>
              {escalating ? 'Connecting you to a rep…' : 'Prefer a person? Talk to a real person →'}
            </Text>
          </Pressable>
          {!!escalateError && (
            <Text style={{ fontSize: 11.5, color: T.danger, fontFamily: F.regular, marginTop: 4, textAlign: 'center' }}>
              {escalateError}
            </Text>
          )}
        </View>
      ) : (
        <>
          {/* Escalation / change-topic links */}
          {chatMode === 'ai' && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 6, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 }}>
                <Pressable onPress={onChangeTopic} disabled={settingTopic}>
                  <Text style={{ fontSize: 12, color: T.textDim, fontFamily: F.medium }}>
                    Change topic
                  </Text>
                </Pressable>
                <Pressable onPress={onEscalate} disabled={escalating}>
                  <Text style={{ fontSize: 12, color: escalating ? T.textMuted : T.info, fontFamily: F.medium }}>
                    {escalating ? 'Connecting you to a rep…' : 'Not what you needed? Talk to a real person →'}
                  </Text>
                </Pressable>
              </View>
              {!!escalateError && (
                <Text style={{ fontSize: 11.5, color: T.danger, fontFamily: F.regular, marginTop: 4, textAlign: 'center' }}>
                  {escalateError}
                </Text>
              )}
              {!!topicError && (
                <Text style={{ fontSize: 11.5, color: T.danger, fontFamily: F.regular, marginTop: 4, textAlign: 'center' }}>
                  {topicError}
                </Text>
              )}
            </View>
          )}

          {/* Composer */}
          <View style={{
            paddingTop: 10, paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 14),
            borderTopWidth: 1, borderTopColor: T.hairline, backgroundColor: T.ink,
            flexDirection: 'row', gap: 8, alignItems: 'center',
          }}>
            <IconButton icon="paperclip" tone="glass" />
            <View style={{
              flex: 1, backgroundColor: T.surface, borderRadius: 20,
              borderWidth: 1, borderColor: T.hairline,
              paddingVertical: 4, paddingLeft: 14, paddingRight: 4,
              flexDirection: 'row', alignItems: 'center', gap: 4,
            }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Message support…"
                placeholderTextColor={T.textMuted}
                style={{ flex: 1, color: T.text, fontSize: 13.5, fontFamily: F.regular, paddingVertical: 8 }}
                multiline
              />
              <Pressable onPress={onSend} disabled={!draft.trim() || sending} style={{
                width: 32, height: 32, borderRadius: 16, alignSelf: 'flex-end',
                backgroundColor: draft.trim() ? T.info : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="arrowUp" size={16} color={draft.trim() ? '#fff' : T.textMuted} strokeWidth={2.4} />
              </Pressable>
            </View>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}
