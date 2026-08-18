// Technician — Profile. Real data only: identity from /api/app/staff-me
// (via AuthContext), two real stat tiles from GET /api/app/jobs/stats. The
// mockup's "Rating" / "On time 96%" tiles and dead Settings rows are
// deliberately omitted — no backing data/features exist. Stats degrade
// section-locally: the rest of the profile renders even if they fail.

import React from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../state/AuthContext';
import useTechStats from '../../hooks/useTechStats';
import { Card, Avatar, Header, Badge } from '../../ui';
import Icon from '../../ui/Icon';
import { T, F } from '../../theme/tokens';

function StatTile({ value, label }) {
  return (
    <View style={{
      flex: 1, backgroundColor: T.surface, borderWidth: 1, borderColor: T.hairline,
      borderRadius: 12, padding: 12,
    }}>
      <Text style={{ fontSize: 22, fontFamily: F.monoSemibold, color: T.text, letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ fontSize: 10.5, color: T.textMuted, marginTop: 2, letterSpacing: 0.3, textTransform: 'uppercase', fontFamily: F.semibold }}>
        {label}
      </Text>
    </View>
  );
}

export default function TechProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut, getUserEmail } = useAuth();
  const { stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useTechStats();

  const name = profile?.name || '';
  const email = profile?.email || getUserEmail();

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Sign out of SecureWatch on this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.ink }} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 24 }}>
      <Header large title="Profile" eyebrow="Account" />

      {/* Identity */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={name} size={54} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 17, fontFamily: F.semibold, color: T.text }} numberOfLines={1}>{name}</Text>
              <Text style={{ fontSize: 12, color: T.textDim, fontFamily: F.regular, marginTop: 1 }} numberOfLines={1}>
                {[profile?.role || 'Field Technician', email].filter(Boolean).join(' · ')}
              </Text>
              {profile?.staffId ? (
                <Text style={{ fontSize: 11, color: T.textMuted, fontFamily: F.mono, marginTop: 4 }}>
                  ID {profile.staffId}
                </Text>
              ) : null}
              <View style={{ marginTop: 8 }}>
                <Badge tone="info">Technician</Badge>
              </View>
            </View>
          </View>
          {profile?.phone ? (
            <View style={{
              marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.hairline,
              flexDirection: 'row', alignItems: 'center', gap: 8,
            }}>
              <Icon name="phone" size={14} color={T.textDim} />
              <Text style={{ fontSize: 12.5, color: T.textDim, fontFamily: F.regular }}>{profile.phone}</Text>
            </View>
          ) : null}
        </Card>
      </View>

      {/* Stats — section-local loading/error, never blocks the page */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
        {statsLoading ? (
          <View style={{ paddingVertical: 18, alignItems: 'center' }}>
            <ActivityIndicator color={T.info} />
          </View>
        ) : statsError ? (
          <View style={{
            paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: T.hairline,
            flexDirection: 'row', alignItems: 'center', gap: 10,
          }}>
            <Text style={{ flex: 1, fontSize: 12, color: T.textDim, fontFamily: F.regular }}>
              Couldn't load your job stats.
            </Text>
            <Text onPress={refetchStats} style={{ fontSize: 12.5, color: T.info, fontFamily: F.medium }}>Retry</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatTile value={String(stats?.completedThisWeek ?? 0)} label="Jobs this week" />
            <StatTile value={String(stats?.completedTotal ?? 0)} label="Jobs all time" />
          </View>
        )}
      </View>

      {/* Sign out */}
      <View style={{ paddingHorizontal: 20 }}>
        <Pressable onPress={confirmSignOut} style={({ pressed }) => ({
          padding: 14, borderRadius: 14, borderWidth: 1, borderColor: T.hairline2,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: pressed ? 0.7 : 1,
        })}>
          <Icon name="logout" size={16} color={T.danger} />
          <Text style={{ color: T.danger, fontSize: 13.5, fontFamily: F.medium }}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
