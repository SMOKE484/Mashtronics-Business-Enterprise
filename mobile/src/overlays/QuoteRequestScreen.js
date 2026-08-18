// Request a quote — multi-select options + notes. Submits as a formatted
// support chat message so it reaches the team's existing inbox.
// TODO(Track B): swap for the quote-lead endpoint so app requests feed the
// same lead pipeline as the website (features.md SW3).
// Ported from QuoteOverlay (app.jsx).

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { Card } from '../ui';
import Icon from '../ui/Icon';
import { QUOTE_OPTIONS } from '../data/placeholders';
import { T, F } from '../theme/tokens';

export default function QuoteRequestScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(new Set());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const toggle = (label) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const lines = [
      '[Quote request]',
      `Interested in: ${[...selected].join(', ')}`,
      notes.trim() ? `Notes: ${notes.trim()}` : null,
    ].filter(Boolean);
    try {
      await api('/api/app/messages', { method: 'POST', body: { text: lines.join('\n') } });
      setDone(true);
    } catch {
      setError("Couldn't send — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View style={{
          width: 92, height: 92, borderRadius: 46,
          backgroundColor: 'rgba(122,178,60,0.12)',
          borderWidth: 2, borderColor: 'rgba(122,178,60,0.4)',
          alignItems: 'center', justifyContent: 'center', marginBottom: 22,
        }}>
          <Icon name="check" size={42} color={T.online} strokeWidth={2.4} />
        </View>
        <Text style={{ fontSize: 24, fontFamily: F.bold, color: T.text, letterSpacing: -0.5, textAlign: 'center' }}>
          Request sent
        </Text>
        <Text style={{ fontSize: 14, color: T.textDim, marginTop: 10, textAlign: 'center', lineHeight: 21, maxWidth: 280, fontFamily: F.regular }}>
          We'll send you a formal quote within 24 hours. Watch the Chat tab for a reply.
        </Text>
        <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => ({
          marginTop: 28, paddingVertical: 14, paddingHorizontal: 48, borderRadius: 14,
          backgroundColor: T.elev2, borderWidth: 1, borderColor: T.hairline2,
          opacity: pressed ? 0.85 : 1,
        })}>
          <Text style={{ color: T.text, fontSize: 14.5, fontFamily: F.semibold }}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.ink }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 14 }}>
        <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => ({
          width: 36, height: 36, borderRadius: 18, marginBottom: 12,
          backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: T.hairline,
          alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1,
        })}>
          <Icon name="x" size={18} color={T.text} />
        </Pressable>
        <Text style={{ fontSize: 11, fontFamily: F.bold, letterSpacing: 1.5, color: T.info, textTransform: 'uppercase' }}>
          Upgrade your system
        </Text>
        <Text style={{ fontSize: 26, fontFamily: F.bold, color: T.text, letterSpacing: -0.5, marginTop: 4 }}>
          Request a quote
        </Text>
        <Text style={{ fontSize: 13, color: T.textDim, marginTop: 6, lineHeight: 19, fontFamily: F.regular }}>
          Tell us what you'd like to add. We'll send a formal quote within 24h.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: 20, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 11, fontFamily: F.semibold, letterSpacing: 1.2, color: T.textMuted, textTransform: 'uppercase' }}>
          What would you like?
        </Text>
        {QUOTE_OPTIONS.map(o => {
          const sel = selected.has(o.label);
          return (
            <Card key={o.label} padding={14} onPress={() => toggle(o.label)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 18, height: 18, borderRadius: 4,
                  borderWidth: 1.5, borderColor: sel ? T.info : T.hairline2,
                  backgroundColor: sel ? T.info : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {sel && <Icon name="check" size={11} color="#fff" strokeWidth={3} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5, fontFamily: F.semibold, color: T.text }}>{o.label}</Text>
                  <Text style={{ fontSize: 11.5, color: T.textDim, marginTop: 2, fontFamily: F.regular }}>{o.detail}</Text>
                </View>
              </View>
            </Card>
          );
        })}

        <View style={{
          marginTop: 6, padding: 14, borderRadius: 14,
          backgroundColor: T.surface, borderWidth: 1, borderColor: T.hairline,
        }}>
          <Text style={{ fontSize: 11, fontFamily: F.semibold, letterSpacing: 1.2, color: T.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>
            Notes
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Looking to add 2 cameras to the side yard. Prefer wireless if possible…"
            placeholderTextColor={T.textMuted}
            multiline
            style={{ minHeight: 60, color: T.text, fontSize: 13, fontFamily: F.regular, lineHeight: 19, textAlignVertical: 'top' }}
          />
        </View>
        {error ? (
          <Text style={{ fontSize: 12.5, color: '#FF7A72', fontFamily: F.medium }}>{error}</Text>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 20) + 20 }}>
        <Pressable onPress={submit} disabled={busy || selected.size === 0} style={({ pressed }) => ({
          padding: 15, borderRadius: 14, backgroundColor: T.info, alignItems: 'center',
          opacity: selected.size === 0 ? 0.5 : pressed || busy ? 0.85 : 1,
        })}>
          {busy
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontSize: 14.5, fontFamily: F.semibold }}>Send request</Text>}
        </Pressable>
      </View>
    </View>
  );
}
