// Shared bits for the auth screens (no auth UI exists in the prototype —
// these follow its design language: ink background, 26px bold titles,
// uppercase info eyebrows, surface inputs with hairline borders).

import React from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Image } from 'react-native';
import { T, F } from '../../theme/tokens';

export function AuthShell({ children }) {
  return (
    <View style={{ flex: 1, backgroundColor: T.ink, paddingHorizontal: 20 }}>
      {children}
    </View>
  );
}

export function BrandHeader({ eyebrow, title, subtitle }) {
  return (
    <View style={{ paddingTop: 24, paddingBottom: 24 }}>
      <Image
        source={require('../../../assets/images/mashtronics-wordmark.png')}
        style={{ height: 24, width: 180, resizeMode: 'contain', marginBottom: 28 }}
      />
      <Text style={{ fontSize: 11, fontFamily: F.bold, letterSpacing: 1.5, color: T.info, textTransform: 'uppercase' }}>
        {eyebrow}
      </Text>
      <Text style={{ fontSize: 26, fontFamily: F.bold, color: T.text, letterSpacing: -0.5, marginTop: 4 }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ fontSize: 13, color: T.textDim, marginTop: 6, lineHeight: 19, fontFamily: F.regular }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function Field({ label, ...inputProps }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{
        fontSize: 11, fontFamily: F.semibold, letterSpacing: 1.2,
        textTransform: 'uppercase', color: T.textMuted, marginBottom: 8, paddingLeft: 4,
      }}>{label}</Text>
      <TextInput
        placeholderTextColor={T.textMuted}
        style={{
          backgroundColor: T.surface, borderWidth: 1, borderColor: T.hairline,
          borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
          color: T.text, fontSize: 14, fontFamily: F.regular,
        }}
        {...inputProps}
      />
    </View>
  );
}

export function PrimaryButton({ label, onPress, busy, disabled, tone = 'info' }) {
  const bg = tone === 'danger' ? T.danger : T.info;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => ({
        padding: 15, borderRadius: 14, backgroundColor: bg,
        alignItems: 'center', opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {busy
        ? <ActivityIndicator color="#fff" />
        : <Text style={{ color: '#fff', fontSize: 14.5, fontFamily: F.semibold, letterSpacing: 0.1 }}>{label}</Text>}
    </Pressable>
  );
}

export function SegmentedToggle({ options, value, onChange, label }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <Text style={{
          fontSize: 11, fontFamily: F.semibold, letterSpacing: 1.2,
          textTransform: 'uppercase', color: T.textMuted, marginBottom: 8, paddingLeft: 4,
        }}>{label}</Text>
      ) : null}
      <View style={{
        flexDirection: 'row', backgroundColor: T.surface, borderWidth: 1,
        borderColor: T.hairline, borderRadius: 14, padding: 4,
      }}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                backgroundColor: active ? T.info : 'transparent',
              }}
            >
              <Text style={{
                fontSize: 13, fontFamily: F.semibold,
                color: active ? '#fff' : T.textDim,
              }}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <View style={{
      marginBottom: 14, padding: 12, borderRadius: 12,
      backgroundColor: 'rgba(255,59,48,0.1)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)',
    }}>
      <Text style={{ color: '#FF7A72', fontSize: 12.5, fontFamily: F.medium, lineHeight: 18 }}>{children}</Text>
    </View>
  );
}
