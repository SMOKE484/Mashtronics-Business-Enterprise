// Panic arming — 5s countdown before the alert fires. Cancel aborts;
// countdown end or "Send alert now" POSTs /api/app/panic and moves to the
// active-alert screen. Ported from PanicArmingOverlay (screen-panic.jsx).

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useRealtime } from '../state/RealtimeContext';
import Icon from '../ui/Icon';
import { PLACEHOLDER_CONTACTS } from '../data/placeholders';
import { T, F } from '../theme/tokens';

const COUNTDOWN_S = 5;

export default function PanicArmScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { triggerPanic } = useRealtime();
  const [count, setCount] = useState(COUNTDOWN_S);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const firedRef = useRef(false);

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 500, easing: Easing.inOut(Easing.ease) }),
      ), -1, false);
  }, []);
  const discStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.05 }],
  }));

  const fire = async () => {
    if (firedRef.current) return;
    firedRef.current = true;
    setSending(true);
    setError(null);
    try {
      await triggerPanic();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace('PanicActive');
    } catch (err) {
      firedRef.current = false;
      setSending(false);
      setError('Could not send the alert. Check your connection and try again — or phone 011 765 4148.');
    }
  };

  useEffect(() => {
    if (sending) return;
    if (count <= 0) {
      fire();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const id = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [count, sending]);

  const recipients = [
    { label: 'Mashtronics Response Team', detail: 'Control room · dispatched immediately', icon: 'shield' },
    ...PLACEHOLDER_CONTACTS.slice(0, 2).map(c => ({
      label: c.name, detail: `${c.relation} · SMS`, icon: 'user',
    })),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#1A0806' }}>
      {/* red radial wash */}
      <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
        <Circle cx="50%" cy="35%" r="70%" fill="rgba(184,38,31,0.22)" />
        <Circle cx="50%" cy="35%" r="40%" fill="rgba(255,59,48,0.10)" />
      </Svg>

      {/* Cancel */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, alignItems: 'flex-end' }}>
        <Pressable onPress={() => navigation.goBack()} disabled={sending} style={({ pressed }) => ({
          paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: T.hairline2,
          opacity: pressed ? 0.7 : 1,
        })}>
          <Text style={{ color: T.text, fontSize: 13, fontFamily: F.medium }}>Cancel</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 24 }}>
        <Text style={{ fontSize: 11, fontFamily: F.bold, letterSpacing: 3.5, color: T.danger, textTransform: 'uppercase' }}>
          Emergency triggering
        </Text>

        <Animated.View style={[{
          width: 180, height: 180, borderRadius: 90,
          backgroundColor: 'rgba(184,38,31,0.5)',
          borderWidth: 2, borderColor: 'rgba(255,59,48,0.4)',
          alignItems: 'center', justifyContent: 'center',
        }, discStyle]}>
          {sending
            ? <ActivityIndicator size="large" color="#fff" />
            : <Text style={{ fontSize: 96, fontFamily: F.monoSemibold, color: '#fff', letterSpacing: -2 }}>{count}</Text>}
        </Animated.View>

        <View style={{ alignItems: 'center', maxWidth: 280 }}>
          <Text style={{ fontSize: 22, fontFamily: F.semibold, color: T.text, letterSpacing: -0.3 }}>
            {sending ? 'Sending alert…' : `Sending alert in ${count}s`}
          </Text>
          <Text style={{ fontSize: 14, color: T.textDim, marginTop: 8, lineHeight: 20, textAlign: 'center', fontFamily: F.regular }}>
            Tap cancel if this was triggered by accident. Otherwise your response team and emergency contacts will be notified.
          </Text>
          {error ? (
            <Text style={{ fontSize: 12.5, color: '#FF7A72', marginTop: 10, lineHeight: 18, textAlign: 'center', fontFamily: F.medium }}>
              {error}
            </Text>
          ) : null}
        </View>

        {/* Recipient preview */}
        <View style={{
          backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14,
          borderWidth: 1, borderColor: T.hairline, padding: 14,
          width: '100%', maxWidth: 320, gap: 10,
        }}>
          {recipients.map(r => (
            <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{
                width: 28, height: 28, borderRadius: 8,
                backgroundColor: 'rgba(255,59,48,0.12)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={r.icon} size={15} color={T.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontFamily: F.medium, color: T.text }}>{r.label}</Text>
                <Text style={{ fontSize: 11, color: T.textMuted, fontFamily: F.regular }}>{r.detail}</Text>
              </View>
              <Icon name="check" size={16} color={T.online} />
            </View>
          ))}
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 20) + 20 }}>
        <Pressable onPress={fire} disabled={sending} style={({ pressed }) => ({
          padding: 16, borderRadius: 16, backgroundColor: T.danger,
          alignItems: 'center', opacity: pressed || sending ? 0.8 : 1,
          shadowColor: T.danger, shadowOpacity: 0.4, shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 }, elevation: 10,
        })}>
          <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.semibold, letterSpacing: 0.1 }}>
            Send alert now
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
