// Cameras — live health from GET /api/app/cameras with pull-to-refresh.
// Ported from mashtronics/screen-cameras.jsx.

import React from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../state/AuthContext';
import useCameras from '../hooks/useCameras';
import { Badge, Card, SectionTitle, Header, IconButton } from '../ui';
import Icon from '../ui/Icon';
import CameraThumb from '../ui/CameraThumb';
import { T, F } from '../theme/tokens';

export default function CamerasScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { cameras, loading, error, refetch } = useCameras();
  const [refreshing, setRefreshing] = React.useState(false);

  const online = cameras.filter(c => c.status === 'online').length;
  const offline = cameras.length - online;

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const stats = [
    { val: String(online), label: 'Online', color: T.online },
    { val: String(offline), label: 'Offline', color: T.offline },
    { val: String(cameras.length), label: 'Total', color: T.text },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.ink }}
      contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.textDim} />}
    >
      <Header large title="Cameras" eyebrow="Live status" trailing={<IconButton icon="search" />} />

      {/* Property card */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
        <View style={{
          paddingVertical: 12, paddingHorizontal: 14, backgroundColor: T.surface,
          borderRadius: 14, borderWidth: 1, borderColor: T.hairline,
          flexDirection: 'row', alignItems: 'center', gap: 12,
        }}>
          <View style={{
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: 'rgba(43,160,198,0.12)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="pin" size={18} color={T.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontFamily: F.semibold, color: T.text }} numberOfLines={1}>
              {profile?.billingAddress || 'Your property'}
            </Text>
            <Text style={{ fontSize: 11, color: T.textDim, fontFamily: F.regular }}>
              {cameras.length} camera{cameras.length === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
      </View>

      {/* Summary stats */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', gap: 10 }}>
        {stats.map(s => (
          <View key={s.label} style={{
            flex: 1, backgroundColor: T.surface, borderWidth: 1, borderColor: T.hairline,
            borderRadius: 12, padding: 12,
          }}>
            <Text style={{ fontSize: 22, fontFamily: F.monoSemibold, color: s.color, letterSpacing: -0.5 }}>{s.val}</Text>
            <Text style={{ fontSize: 10.5, color: T.textMuted, marginTop: 2, letterSpacing: 0.3, textTransform: 'uppercase', fontFamily: F.semibold }}>
              {s.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Camera list */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <SectionTitle action="Refresh" onAction={onRefresh}>All cameras</SectionTitle>
        <View style={{ gap: 10 }}>
          {cameras.map(c => (
            <Card key={c.id} padding={0} onPress={() => navigation.navigate('CameraDetail', { camera: c })}>
              <View style={{ flexDirection: 'row', gap: 12, padding: 12, alignItems: 'center' }}>
                <CameraThumb online={c.status === 'online'} width={64} height={48} radius={10} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14.5, fontFamily: F.semibold, color: T.text }}>{c.name}</Text>
                  <Text style={{ fontSize: 11.5, color: T.textDim, marginTop: 2, fontFamily: F.regular }} numberOfLines={1}>
                    {[c.model, c.location].filter(Boolean).join(' · ')}
                  </Text>
                  <View style={{ marginTop: 6 }}>
                    <Badge tone={c.status === 'online' ? 'online' : 'offline'}>
                      {c.status === 'online' ? `Online${c.signal && c.signal !== '—' ? ` · ${c.signal}` : ''}` : 'Offline'}
                    </Badge>
                  </View>
                </View>
                <Icon name="chevR" size={18} color={T.textMuted} />
              </View>
            </Card>
          ))}
          {!loading && cameras.length === 0 && !error && (
            <Card>
              <Text style={{ color: T.textDim, fontSize: 13, fontFamily: F.regular, textAlign: 'center', lineHeight: 19 }}>
                No cameras on your account yet. They'll appear here once Mashtronics registers your installation.
              </Text>
            </Card>
          )}
        </View>
      </View>

      {/* Offline note */}
      {offline > 0 && (
        <View style={{
          marginTop: 12, marginHorizontal: 20, paddingVertical: 12, paddingHorizontal: 14,
          backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)',
          borderRadius: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start',
        }}>
          <Icon name="info" size={18} color={T.offline} />
          <Text style={{ flex: 1, fontSize: 12, color: T.textDim, lineHeight: 17, fontFamily: F.regular }}>
            {offline === 1 ? 'A camera is' : `${offline} cameras are`} offline. Our team monitors camera health — if it doesn't recover shortly, report it from the Home screen and we'll dispatch a technician.
          </Text>
        </View>
      )}

      {error && (
        <View style={{
          marginTop: 12, marginHorizontal: 20, paddingVertical: 12, paddingHorizontal: 14,
          backgroundColor: 'rgba(255,59,48,0.08)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.25)',
          borderRadius: 12,
        }}>
          <Text style={{ fontSize: 12, color: '#FF7A72', fontFamily: F.medium }}>
            Couldn't refresh cameras — pull down to retry.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
