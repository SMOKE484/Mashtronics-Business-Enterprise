// Profile — identity from GET /api/app/me + Supabase email; sign out wired.
// Subscription, SOS contacts, and settings rows are PLACEHOLDER until their
// backends exist (SW3). Ported from mashtronics/screen-profile.jsx.

import React from 'react';
import { View, Text, ScrollView, Pressable, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../state/AuthContext';
import { Badge, Card, Avatar, SectionTitle, Header, IconButton } from '../ui';
import Icon from '../ui/Icon';
import { PLACEHOLDER_CONTACTS, PLACEHOLDER_SUBSCRIPTION } from '../data/placeholders';
import { T, F } from '../theme/tokens';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut, getUserEmail } = useAuth();

  const name = profile?.contactName || profile?.name || '';
  const email = profile?.contactEmail || getUserEmail();
  const phone = profile?.contactPhone || '';
  const sub = PLACEHOLDER_SUBSCRIPTION;

  const settingsRows = [
    { icon: 'pin',    label: 'Property details',    detail: profile?.billingAddress || '' },
    { icon: 'doc',    label: 'Invoices & payments', detail: '' },
    { icon: 'bell',   label: 'Notifications',       detail: 'Push, SMS, Email' },
    { icon: 'shield', label: 'Privacy & security',  detail: '' },
    { icon: 'info',   label: 'Help & support',      detail: '011 765 4148' },
  ];

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Sign out of SecureWatch on this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.ink }} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 24 }}>
      <Header large title="Profile" eyebrow="Account & settings" trailing={<IconButton icon="settings" />} />

      {/* User card */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
        <View style={{
          padding: 16, borderRadius: 18,
          backgroundColor: 'rgba(43,160,198,0.05)',
          borderWidth: 1, borderColor: T.hairline,
          flexDirection: 'row', alignItems: 'center', gap: 12,
        }}>
          <Avatar name={name} size={54} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontFamily: F.semibold, color: T.text }}>{name}</Text>
            <Text style={{ fontSize: 12, color: T.textDim, fontFamily: F.regular }}>{email}</Text>
            {phone ? <Text style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2, fontFamily: F.regular }}>{phone}</Text> : null}
          </View>
          <Icon name="chevR" size={18} color={T.textMuted} />
        </View>
      </View>

      {/* Subscription (placeholder) */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
        <SectionTitle action="Manage">Subscription</SectionTitle>
        <Card padding={0}>
          <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Icon name="star" size={16} color="#FFD27A" />
              <Text style={{ fontSize: 11, fontFamily: F.bold, letterSpacing: 1.5, color: '#FFD27A', textTransform: 'uppercase' }}>
                {sub.plan}
              </Text>
            </View>
            <Text style={{ fontSize: 18, fontFamily: F.semibold, color: T.text }}>
              {sub.price} <Text style={{ fontSize: 12, color: T.textMuted, fontFamily: F.regular }}>/ month</Text>
            </Text>
            <Text style={{ fontSize: 11.5, color: T.textDim, marginTop: 4, fontFamily: F.regular }}>{sub.summary}</Text>
          </View>
          {[['Contract', sub.contract], ['Next payment', sub.nextPayment]].map(([k, v]) => (
            <View key={k} style={{
              paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: T.hairline,
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <Text style={{ fontSize: 12, color: T.textMuted, fontFamily: F.regular }}>{k}</Text>
              <Text style={{ fontSize: 12, color: T.text, fontFamily: F.mono }}>{v}</Text>
            </View>
          ))}
        </Card>
      </View>

      {/* SOS contacts (placeholder) */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
        <SectionTitle action="+ Add">SOS emergency contacts</SectionTitle>
        <View style={{ gap: 8 }}>
          {PLACEHOLDER_CONTACTS.map(c => (
            <Card key={c.name} padding={12}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={c.name} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5, fontFamily: F.semibold, color: T.text }}>{c.name}</Text>
                  <Text style={{ fontSize: 11.5, color: T.textDim, fontFamily: F.regular }}>{c.relation} · {c.phone}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {c.channels.map(ch => (
                    <View key={ch} style={{
                      paddingVertical: 3, paddingHorizontal: 7, borderRadius: 6,
                      backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: T.hairline,
                    }}>
                      <Text style={{ fontSize: 10, color: T.textDim, fontFamily: F.medium, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {ch}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </Card>
          ))}
        </View>
      </View>

      {/* Settings */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
        <SectionTitle>Account</SectionTitle>
        <Card padding={0}>
          {settingsRows.map((row, i, arr) => (
            <View key={row.label} style={{
              paddingVertical: 12, paddingHorizontal: 16,
              flexDirection: 'row', alignItems: 'center', gap: 12,
              borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: T.hairline,
            }}>
              <View style={{
                width: 30, height: 30, borderRadius: 8,
                backgroundColor: 'rgba(255,255,255,0.05)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={row.icon} size={15} color={T.textDim} />
              </View>
              <Text style={{ flex: 1, fontSize: 13.5, color: T.text, fontFamily: F.medium }}>{row.label}</Text>
              {row.detail ? <Text style={{ fontSize: 12, color: T.textMuted, fontFamily: F.regular }} numberOfLines={1}>{row.detail}</Text> : null}
              <Icon name="chevR" size={16} color={T.textMuted} />
            </View>
          ))}
        </Card>
      </View>

      {/* Sign out + footer */}
      <View style={{ paddingHorizontal: 20 }}>
        <Pressable onPress={confirmSignOut} style={({ pressed }) => ({
          padding: 14, borderRadius: 14, borderWidth: 1, borderColor: T.hairline2,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: pressed ? 0.7 : 1,
        })}>
          <Icon name="logout" size={16} color={T.danger} />
          <Text style={{ color: T.danger, fontSize: 13.5, fontFamily: F.medium }}>Sign out</Text>
        </Pressable>
        <View style={{ alignItems: 'center', gap: 8, paddingTop: 20 }}>
          <Image source={require('../../assets/images/mashtronics-wordmark.png')}
            style={{ height: 22, width: 140, resizeMode: 'contain', opacity: 0.6 }} />
          <Text style={{ fontSize: 10.5, color: T.textMuted, textAlign: 'center', letterSpacing: 0.4, fontFamily: F.regular }}>
            SecureWatch · v1.0.0
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
