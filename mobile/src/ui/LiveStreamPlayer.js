// Real streaming live view for the mobile app: a WebView loading the
// Dahua plugin-free player page the Express server hosts at /player/
// (server/public/player). The RTSP-over-websocket stream URL is only
// connectable for ~10s after issue, so the flow is deliberately
// page-first: load the WebView, wait for its 'ready' message (WASM player
// initialized), and only THEN fetch /live-stream and postMessage the
// session in — fetching earlier risks the URL expiring while the WASM
// libraries are still downloading on a slow connection.
//
// Phases: connecting (spinner) -> playing (screenshot + mute controls), or
// notSetUp / error (with Try again + optional snapshot fallback the parent
// provides). Screenshot capture and mute round-trip through the WebView via
// postMessage — see server/public/player/index.html for the page side.

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { api } from '../lib/api';
import Icon from './Icon';
import { IconButton } from './index';
import CameraThumb from './CameraThumb';
import { T, F } from '../theme/tokens';

const PLAYER_URL = `${process.env.EXPO_PUBLIC_API_URL}/player/`;
// The WASM CapturePic call normally resolves in well under a second; this
// guards against it never firing (e.g. the page's WASM runtime wedged).
const SCREENSHOT_TIMEOUT_MS = 5000;

async function saveAndShareScreenshot(dataUrl, cameraId) {
  const base64 = dataUrl.split(',')[1] || '';
  const file = new File(Paths.cache, `live-${cameraId}-${Date.now()}.jpg`);
  file.create();
  file.write(base64, { encoding: 'base64' });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'image/jpeg' });
}

export default function LiveStreamPlayer({ cameraId, cameraOnline, onFallbackToSnapshot }) {
  const webviewRef = useRef(null);
  const [phase, setPhase] = useState('connecting'); // connecting | playing | notSetUp | error
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [screenshotState, setScreenshotState] = useState(null); // null | 'pending' | 'error'
  const screenshotTimerRef = useRef(null);
  // Bumping the key remounts the WebView — a full clean restart of the
  // player page, which also makes "Try again" fetch a fresh stream URL.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => () => {
    if (screenshotTimerRef.current) clearTimeout(screenshotTimerRef.current);
  }, []);

  const retry = () => {
    setPhase('connecting');
    setError('');
    setMuted(false);
    setScreenshotState(null);
    if (screenshotTimerRef.current) {
      clearTimeout(screenshotTimerRef.current);
      screenshotTimerRef.current = null;
    }
    setAttempt(a => a + 1);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    webviewRef.current?.postMessage(JSON.stringify({ type: 'mute', muted: next }));
  };

  const takeScreenshot = () => {
    if (phase !== 'playing' || screenshotState === 'pending') return;
    setScreenshotState('pending');
    screenshotTimerRef.current = setTimeout(() => {
      setScreenshotState('error');
      screenshotTimerRef.current = null;
    }, SCREENSHOT_TIMEOUT_MS);
    webviewRef.current?.postMessage(JSON.stringify({ type: 'screenshot' }));
  };

  const handleMessage = useCallback(async event => {
    let msg;
    try { msg = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (msg.type === 'ready') {
      try {
        const session = await api(`/api/app/cameras/${cameraId}/live-stream`);
        if (!session?.hasLiveView) { setPhase('notSetUp'); return; }
        webviewRef.current?.postMessage(JSON.stringify({ type: 'play', session }));
      } catch (err) {
        setPhase('error');
        setError(err.message);
      }
    } else if (msg.type === 'playing') {
      setPhase('playing');
    } else if (msg.type === 'error') {
      setPhase('error');
      setError(msg.message || 'The live stream stopped unexpectedly.');
    } else if (msg.type === 'screenshot-result') {
      if (screenshotTimerRef.current) {
        clearTimeout(screenshotTimerRef.current);
        screenshotTimerRef.current = null;
      }
      if (msg.dataUrl) {
        try {
          await saveAndShareScreenshot(msg.dataUrl, cameraId);
          setScreenshotState(null);
        } catch {
          setScreenshotState('error');
        }
      } else {
        setScreenshotState('error');
      }
    }
  }, [cameraId]);

  useEffect(() => {
    if (screenshotState !== 'error') return;
    const t = setTimeout(() => setScreenshotState(s => (s === 'error' ? null : s)), 3000);
    return () => clearTimeout(t);
  }, [screenshotState]);

  if (phase === 'notSetUp') {
    return (
      <View style={[overlayStyle, { backgroundColor: 'transparent', padding: 24 }]}>
        <CameraThumb online={cameraOnline} width={64} height={48} radius={10} />
        <Text style={{ color: T.textDim, fontSize: 13, fontFamily: F.regular, textAlign: 'center', marginTop: 14, lineHeight: 19 }}>
          Live view isn't set up for this camera yet.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
      <WebView
        key={attempt}
        ref={webviewRef}
        source={{ uri: PLAYER_URL }}
        onMessage={handleMessage}
        onError={() => { setPhase('error'); setError("Couldn't reach the streaming page. Check your connection."); }}
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        style={{ flex: 1, backgroundColor: '#000' }}
      />
      {phase === 'connecting' && (
        <View style={overlayStyle}>
          <ActivityIndicator color={T.textDim} />
          <Text style={{ color: T.textDim, fontSize: 13, fontFamily: F.regular, marginTop: 10 }}>
            Connecting to the live stream…
          </Text>
        </View>
      )}
      {phase === 'error' && (
        <View style={overlayStyle}>
          <Icon name="info" size={22} color={T.offline} />
          <Text style={{ color: T.textDim, fontSize: 13, fontFamily: F.regular, textAlign: 'center', marginTop: 10, lineHeight: 19, paddingHorizontal: 24 }}>
            {error}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Pressable onPress={retry} style={({ pressed }) => ({ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, backgroundColor: T.elev2, opacity: pressed ? 0.8 : 1 })}>
              <Text style={{ color: T.text, fontSize: 12.5, fontFamily: F.semibold }}>Try again</Text>
            </Pressable>
            {onFallbackToSnapshot && (
              <Pressable onPress={onFallbackToSnapshot} style={({ pressed }) => ({ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, backgroundColor: T.elev2, opacity: pressed ? 0.8 : 1 })}>
                <Text style={{ color: T.text, fontSize: 12.5, fontFamily: F.semibold }}>Snapshot view</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
      {phase === 'playing' && (
        <View style={{ position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {screenshotState === 'error' && (
            <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8 }}>
              <Text style={{ color: T.text, fontSize: 11.5, fontFamily: F.medium }}>Couldn't save screenshot</Text>
            </View>
          )}
          <View style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20 }}>
            {screenshotState === 'pending' ? (
              <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={T.text} size="small" />
              </View>
            ) : (
              <IconButton icon="camera" tone="glass" onPress={takeScreenshot} />
            )}
          </View>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20 }}>
            <IconButton icon={muted ? 'volumeOff' : 'volumeOn'} tone="glass" onPress={toggleMute} />
          </View>
        </View>
      )}
    </View>
  );
}

const overlayStyle = {
  position: 'absolute',
  top: 0, right: 0, bottom: 0, left: 0,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.65)',
};
