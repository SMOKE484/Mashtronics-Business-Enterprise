// Pseudo camera feed thumbnail — online: dark gradient + blinking LIVE dot;
// offline: diagonal stripes + wifiOff. Ported from the repeated inline
// pattern in screen-home/screen-cameras/screen-complaint.

import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line } from 'react-native-svg';
import Icon from './Icon';
import { BlinkDot } from './index';
import { T, F } from '../theme/tokens';

function Stripes({ width, height }) {
  const lines = [];
  const step = 8;
  for (let x = -height; x < width + height; x += step) {
    lines.push(
      <Line key={x} x1={x} y1={height} x2={x + height} y2={0}
        stroke="#141A22" strokeWidth={step / 2} />
    );
  }
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
      style={{ position: 'absolute' }}>
      {lines}
    </Svg>
  );
}

export default function CameraThumb({ online, width, height, radius = 10, showLive = false, iconSize = 18 }) {
  return (
    <View style={{
      width, height, borderRadius: radius, overflow: 'hidden',
      borderWidth: 1, borderColor: T.hairline,
      backgroundColor: online ? undefined : '#1A222D',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {online ? (
        <LinearGradient colors={['#1B2530', '#0D1218']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      ) : (
        <Stripes width={width} height={height} />
      )}
      {online ? (
        showLive ? (
          <View style={{
            position: 'absolute', top: 6, left: 6,
            flexDirection: 'row', alignItems: 'center', gap: 4,
          }}>
            <BlinkDot color={T.danger} size={5} />
            <Text style={{ fontSize: 8, fontFamily: F.bold, color: T.danger, letterSpacing: 1 }}>LIVE</Text>
          </View>
        ) : (
          <>
            <Icon name="camera" size={iconSize} color={T.textDim} />
            <View style={{ position: 'absolute', top: 4, right: 4 }}>
              <BlinkDot color={T.danger} size={5} />
            </View>
          </>
        )
      ) : (
        <Icon name="wifiOff" size={iconSize + 4} color={T.offline} />
      )}
    </View>
  );
}
