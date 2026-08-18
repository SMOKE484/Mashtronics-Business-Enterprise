// UI primitives — ported from mashtronics/ui.jsx. Same names minus the SW
// prefix: Dot, Badge, Card, Avatar, SectionTitle, TabBarItem, Header,
// IconButton. CSS keyframes (sw-pulse, sw-blink) become Reanimated loops.

import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing,
} from 'react-native-reanimated';
import Icon from './Icon';
import { T, F } from '../theme/tokens';

// sw-pulse: expanding ring that fades out behind the dot.
export function Dot({ color, pulse = false, size = 8 }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (!pulse) return;
    p.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
  }, [pulse]);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + p.value * 1.6 }],
    opacity: 0.45 * (1 - p.value),
  }));
  return (
    <View style={{ width: size, height: size }}>
      {pulse && (
        <Animated.View style={[{
          position: 'absolute', left: 0, top: 0, width: size, height: size,
          borderRadius: size / 2, backgroundColor: color,
        }, ringStyle]} />
      )}
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

// sw-blink: opacity 1 <-> 0.25 (LIVE indicators).
export function BlinkDot({ color = T.danger, size = 5, style }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(
      withSequence(
        withTiming(0.25, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ), -1, false);
  }, []);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, s, style]} />
  );
}

const BADGE_TONES = {
  neutral: { bg: 'rgba(255,255,255,0.06)', fg: T.textDim, dot: T.textMuted },
  online:  { bg: 'rgba(122,178,60,0.12)',  fg: '#9FCE63',  dot: T.online },
  offline: { bg: 'rgba(245,158,11,0.14)',  fg: '#FCD34D',  dot: T.offline },
  danger:  { bg: 'rgba(255,59,48,0.14)',   fg: '#FF7A72',  dot: T.danger },
  info:    { bg: 'rgba(43,160,198,0.14)',  fg: '#7CC5E0',  dot: T.info },
  success: { bg: 'rgba(122,178,60,0.12)',  fg: '#9FCE63',  dot: T.online },
};

export function Badge({ children, tone = 'neutral' }) {
  const t = BADGE_TONES[tone] || BADGE_TONES.neutral;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
      paddingTop: 4, paddingBottom: 4, paddingLeft: 7, paddingRight: 8,
      borderRadius: 999, backgroundColor: t.bg,
    }}>
      <Dot color={t.dot} size={6} />
      <Text style={{ color: t.fg, fontSize: 11, fontFamily: F.medium, letterSpacing: 0.1 }} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

export function Card({ children, style, onPress, padding = 16 }) {
  const base = {
    backgroundColor: T.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: T.hairline,
    borderRadius: 18,
    padding,
  };
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, style, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

export function Avatar({ name = '', size = 36, source = null }) {
  if (source) {
    return (
      <Image
        source={source}
        accessibilityLabel={name}
        style={{
          width: size, height: size, borderRadius: size / 2,
          borderWidth: 1, borderColor: T.hairline2,
        }}
        resizeMode="cover"
      />
    );
  }
  const initials = name.split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase();
  return (
    <LinearGradient
      colors={['#2A3340', '#1A222D']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{
        width: size, height: size, borderRadius: size / 2,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: T.hairline2,
      }}
    >
      <Text style={{ color: T.text, fontSize: size * 0.36, fontFamily: F.semibold, letterSpacing: 0.3 }}>
        {initials}
      </Text>
    </LinearGradient>
  );
}

export function SectionTitle({ children, action, onAction, style }) {
  return (
    <View style={[{
      flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
      paddingHorizontal: 4, paddingBottom: 10,
    }, style]}>
      <Text style={{
        fontSize: 11, fontFamily: F.semibold, letterSpacing: 1.2,
        textTransform: 'uppercase', color: T.textMuted,
      }}>{children}</Text>
      {action ? (
        <Text onPress={onAction} style={{ fontSize: 13, color: T.info, fontFamily: F.medium }}>{action}</Text>
      ) : null}
    </View>
  );
}

export function TabBarItem({ icon, label, active, onPress, badge }) {
  return (
    <Pressable onPress={onPress} style={{
      flex: 1, alignItems: 'center', gap: 4, paddingTop: 8, paddingBottom: 4,
    }}>
      <View>
        <Icon name={icon} size={24} strokeWidth={active ? 2 : 1.6} color={active ? T.text : T.textMuted} />
        {badge ? (
          <View style={{
            position: 'absolute', top: -2, right: -4, minWidth: 14, height: 14,
            paddingHorizontal: 3, borderRadius: 7, backgroundColor: T.danger,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ color: '#fff', fontSize: 9, fontFamily: F.bold }}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={{
        fontSize: 10, fontFamily: F.medium, letterSpacing: 0.2,
        color: active ? T.text : T.textMuted,
      }}>{label}</Text>
    </Pressable>
  );
}

export function Header({ title, eyebrow, trailing, leading, large = false }) {
  return (
    <View style={{
      paddingTop: large ? 4 : 6,
      paddingBottom: large ? 12 : 10,
      paddingHorizontal: large ? 20 : 16,
      flexDirection: 'row',
      alignItems: large ? 'flex-end' : 'center',
      justifyContent: 'space-between',
      gap: 12, minHeight: large ? 64 : 44,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
        {leading}
        <View style={{ flexShrink: 1 }}>
          {eyebrow ? (
            <Text style={{
              fontSize: 11, color: T.textMuted, fontFamily: F.medium,
              textTransform: 'uppercase', letterSpacing: 1.2,
            }}>{eyebrow}</Text>
          ) : null}
          <Text style={{
            fontSize: large ? 28 : 17,
            fontFamily: large ? F.bold : F.semibold,
            color: T.text,
            letterSpacing: large ? -0.6 : -0.2,
            lineHeight: large ? 31 : 19,
          }}>{title}</Text>
        </View>
      </View>
      {trailing ? <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>{trailing}</View> : null}
    </View>
  );
}

const ICON_BUTTON_TONES = {
  default: { bg: 'rgba(255,255,255,0.06)', fg: T.text },
  glass:   { bg: 'rgba(255,255,255,0.04)', fg: T.text },
  danger:  { bg: 'rgba(255,59,48,0.12)',   fg: T.danger },
};

export function IconButton({ icon, onPress, size = 36, tone = 'default', badge }) {
  const t = ICON_BUTTON_TONES[tone] || ICON_BUTTON_TONES.default;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: t.bg, borderWidth: 1, borderColor: T.hairline,
      alignItems: 'center', justifyContent: 'center',
      opacity: pressed ? 0.7 : 1,
    })}>
      <Icon name={icon} size={size * 0.5} color={t.fg} />
      {badge ? (
        <View style={{
          position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 4,
          backgroundColor: T.danger, borderWidth: 2, borderColor: T.ink,
        }} />
      ) : null}
    </Pressable>
  );
}
