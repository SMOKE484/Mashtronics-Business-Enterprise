// Placeholder landing screen for staff accounts (technician / response
// officer). Proves the admin-invite -> claim -> role-routed-login pipeline
// end-to-end; the real Jobs/Alerts UI is a follow-up slice.

import React from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../state/AuthContext';
import { Card, Avatar, Badge, Header } from '../../ui';
import Icon from '../../ui/Icon';
import { T, F } from '../../theme/tokens';

const STAFF_TYPE_LABEL = {
  technician: 'Technician',
  response: 'Armed Response',
};

export default function StaffHomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut, getUserEmail } = useAuth();

  const name = profile?.name || '';
  const email = profile?.email || getUserEmail();
  const typeLabel = STAFF_TYPE_LABEL[profile?.staffType] || 'Staff';

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Sign out of SecureWatch on this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.ink }} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 24 }}>
      <Header large title={name || 'Signed in'} eyebrow="Mashtronics staff" />

      <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={name} size={54} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontFamily: F.semibold, color: T.text }}>{name}</Text>
              <Text style={{ fontSize: 12, color: T.textDim, fontFamily: F.regular }}>{email}</Text>
              <View style={{ marginTop: 8 }}>
                <Badge tone="info">{typeLabel}</Badge>
              </View>
            </View>
          </View>
        </Card>
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
        <Card>
          <Text style={{ fontSize: 13.5, color: T.textDim, fontFamily: F.regular, lineHeight: 19 }}>
            {typeLabel === 'Technician'
              ? "Your job queue isn't set up yet — check back soon."
              : "Your alert queue isn't set up yet — check back soon."}
          </Text>
        </Card>
      </View>

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
