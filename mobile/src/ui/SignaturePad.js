// Customer sign-off pad — draws strokes with a PanResponder onto an SVG
// (react-native-svg is already in the app; no WebView dependency). Strokes
// are downsampled + quantized by lib/signature.js and serialized to SVG path
// strings for the complete endpoint. Ported visually from the mockup's
// SignaturePad (mashtronics (1)/source-export/screen-tech-jobdetail.jsx):
// dashed border, "Customer signs here" placeholder, baseline rule, Clear link.

import React, { useRef, useState, useEffect } from 'react';
import { View, Text, PanResponder } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { appendPoint, pointsToSvgPath } from '../lib/signature';
import { T, F } from '../theme/tokens';

const PAD_HEIGHT = 160;

// onChange receives the current list of SVG path strings (empty = cleared).
export default function SignaturePad({ onChange }) {
  const [strokes, setStrokes] = useState([]); // committed path strings
  const [livePoints, setLivePoints] = useState([]); // stroke being drawn
  const livePointsRef = useRef([]);
  const [size, setSize] = useState({ width: 0, height: PAD_HEIGHT });
  const sizeRef = useRef(size);

  // Notified via effect, not called synchronously from the PanResponder
  // callback — calling a parent's setState directly from a gesture callback
  // triggers React's "Cannot update a component while rendering a different
  // component" warning under the New Architecture. An effect defers the
  // notification to strictly after this component's own commit.
  useEffect(() => {
    if (onChange) onChange(strokes);
  }, [strokes, onChange]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Don't let a parent ScrollView steal vertical strokes mid-signature.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        livePointsRef.current = appendPoint([], locationX, locationY);
        setLivePoints(livePointsRef.current);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const { width, height } = sizeRef.current;
        if (locationX < 0 || locationY < 0 || (width && locationX > width) || locationY > height) return;
        const next = appendPoint(livePointsRef.current, locationX, locationY);
        if (next !== livePointsRef.current) {
          livePointsRef.current = next;
          setLivePoints(next);
        }
      },
      onPanResponderRelease: () => {
        const path = pointsToSvgPath(livePointsRef.current);
        livePointsRef.current = [];
        setLivePoints([]);
        if (path) {
          setStrokes((prev) => [...prev, path]);
        }
      },
      onPanResponderTerminate: () => {
        livePointsRef.current = [];
        setLivePoints([]);
      },
    })
  ).current;

  const clear = () => {
    setStrokes([]);
    livePointsRef.current = [];
    setLivePoints([]);
  };

  const hasInk = strokes.length > 0 || livePoints.length > 0;
  const livePath = pointsToSvgPath(livePoints);

  return (
    <View>
      <View
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          sizeRef.current = { width, height };
          setSize({ width, height });
        }}
        style={{
          height: PAD_HEIGHT, borderRadius: 14, overflow: 'hidden',
          backgroundColor: T.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: T.hairline2,
        }}
        {...panResponder.panHandlers}
      >
        <Svg width="100%" height="100%">
          {strokes.map((d, i) => (
            <Path key={i} d={d} stroke={T.text} strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ))}
          {livePath ? (
            <Path d={livePath} stroke={T.text} strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ) : null}
          {/* baseline rule */}
          <Line x1={16} y1={PAD_HEIGHT - 20} x2={Math.max(size.width - 16, 16)} y2={PAD_HEIGHT - 20}
            stroke={T.hairline2} strokeWidth={1} />
        </Svg>
        {!hasInk && (
          <View pointerEvents="none" style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 12.5, color: T.textMuted, fontFamily: F.regular }}>
              Customer signs here
            </Text>
          </View>
        )}
      </View>
      {strokes.length > 0 && (
        <Text onPress={clear} style={{ marginTop: 8, fontSize: 12.5, color: T.info, fontFamily: F.medium }}>
          Clear signature
        </Text>
      )}
    </View>
  );
}
