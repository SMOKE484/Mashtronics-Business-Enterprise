// Camera detail + live view. Real streaming video by default
// (LiveStreamPlayer — the Dahua plugin-free player in a WebView); the
// snapshot-polling path below is the explicit fallback when the stream
// won't start.

import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useCameraStream from '../hooks/useCameraStream';
import { Badge } from '../ui';
import Icon from '../ui/Icon';
import CameraThumb from '../ui/CameraThumb';
import LiveStreamPlayer from '../ui/LiveStreamPlayer';
import { T, F } from '../theme/tokens';

export default function CameraDetailScreen({ route, navigation }) {
  const { camera } = route.params;
  const insets = useSafeAreaInsets();
  // 'stream' (default) or 'snapshot' — the snapshot hook only runs (fetches
  // + polls) once the user has fallen back to it.
  const [viewMode, setViewMode] = useState('stream');
  const { stream, loading, error, refetch } = useCameraStream(viewMode === 'snapshot' ? camera.id : null);

  const close = () => navigation.goBack();

  return (
    <View style={{ flex: 1, backgroundColor: T.ink }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Pressable onPress={close} style={({ pressed }) => ({
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: T.hairline,
            alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1,
          })}>
            <Icon name="x" size={18} color={T.text} />
          </Pressable>
        </View>
        <Text style={{ fontSize: 26, fontFamily: F.bold, color: T.text, letterSpacing: -0.5 }}>{camera.name}</Text>
        <Text style={{ fontSize: 13, color: T.textDim, marginTop: 4, fontFamily: F.regular }}>
          {[camera.model, camera.location].filter(Boolean).join(' · ') || 'No details on file'}
        </Text>
        <View style={{ marginTop: 10 }}>
          <Badge tone={camera.status === 'online' ? 'online' : 'offline'}>
            {camera.status === 'online' ? `Online${camera.signal && camera.signal !== '—' ? ` · ${camera.signal}` : ''}` : 'Offline'}
          </Badge>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, alignItems: 'center' }}>
        <View style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16, backgroundColor: T.surface, borderWidth: 1, borderColor: T.hairline, alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'hidden' }}>
          {viewMode === 'stream' ? (
            <LiveStreamPlayer
              cameraId={camera.id}
              cameraOnline={camera.status === 'online'}
              onFallbackToSnapshot={() => setViewMode('snapshot')}
            />
          ) : loading ? (
            <ActivityIndicator color={T.textDim} />
          ) : error ? (
            <>
              <Icon name="info" size={22} color={T.offline} />
              <Text style={{ color: T.textDim, fontSize: 13, fontFamily: F.regular, textAlign: 'center', marginTop: 10, lineHeight: 19 }}>
                Couldn't check live view for this camera.
              </Text>
              <Pressable onPress={refetch} style={({ pressed }) => ({ marginTop: 14, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, backgroundColor: T.elev2, opacity: pressed ? 0.8 : 1 })}>
                <Text style={{ color: T.text, fontSize: 12.5, fontFamily: F.semibold }}>Try again</Text>
              </Pressable>
            </>
          ) : !stream?.hasLiveView ? (
            <>
              <CameraThumb online={camera.status === 'online'} width={64} height={48} radius={10} />
              <Text style={{ color: T.textDim, fontSize: 13, fontFamily: F.regular, textAlign: 'center', marginTop: 14, lineHeight: 19 }}>
                Live view isn't set up for this camera yet.
              </Text>
            </>
          ) : !stream.available ? (
            <>
              <Icon name="info" size={22} color={T.offline} />
              <Text style={{ color: T.textDim, fontSize: 13, fontFamily: F.regular, textAlign: 'center', marginTop: 10, lineHeight: 19 }}>
                {stream.reason || 'Live view is temporarily unavailable.'}
              </Text>
              <Pressable onPress={refetch} style={({ pressed }) => ({ marginTop: 14, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, backgroundColor: T.elev2, opacity: pressed ? 0.8 : 1 })}>
                <Text style={{ color: T.text, fontSize: 12.5, fontFamily: F.semibold }}>Try again</Text>
              </Pressable>
            </>
          ) : (
            <Image
              source={{ uri: stream.url }}
              style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
              resizeMode="cover"
            />
          )}
        </View>
        {viewMode === 'snapshot' && !loading && !error && stream?.hasLiveView && stream.available && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <Text style={{ color: T.textDim, fontSize: 12, fontFamily: F.regular }}>
              Refreshes every 5s — this is a snapshot, not live video.
            </Text>
            <Pressable onPress={() => setViewMode('stream')}>
              <Text style={{ color: T.text, fontSize: 12, fontFamily: F.semibold, textDecorationLine: 'underline' }}>Try live</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
