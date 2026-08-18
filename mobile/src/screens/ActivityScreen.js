// Activity — jobs & complaints history. PLACEHOLDER DATA until the jobs API
// is exposed to the app (features.md SW3 / Track B integration).
// Ported from mashtronics/screen-activity.jsx.

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Card, SectionTitle, Header, IconButton } from '../ui';
import Icon from '../ui/Icon';
import { PLACEHOLDER_ACTIVITY } from '../data/placeholders';
import { T, F } from '../theme/tokens';

const TRACKER_STEPS = [
  { label: 'Scheduled', time: 'Mon 22 May', done: true },
  { label: 'Technician on the way', time: '13:48', done: true },
  { label: 'Installation in progress', time: '14:12', done: true, active: true },
  { label: 'Completed', time: 'ETA 14:35', done: false },
];

export default function ActivityScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('all');

  const items = PLACEHOLDER_ACTIVITY;
  const filtered = tab === 'all' ? items
    : tab === 'jobs' ? items.filter(i => i.kind === 'job')
    : items.filter(i => i.kind === 'complaint');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.ink }} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 24 }}>
      <Header large title="Activity" eyebrow="Jobs & complaints" trailing={
        <IconButton icon="plus" onPress={() => navigation.navigate('Complaint')} />
      } />

      {/* Active tracker (placeholder) */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
        <SectionTitle>Active</SectionTitle>
        <Card padding={0} style={{ borderColor: 'rgba(43,160,198,0.25)', backgroundColor: 'rgba(43,160,198,0.04)' }}>
          <View style={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: 'rgba(43,160,198,0.18)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="truck" size={18} color={T.info} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: F.semibold, color: T.text }}>Camera upgrade · Backyard</Text>
                <Text style={{ fontSize: 11.5, color: T.textDim, fontFamily: F.regular }}>Job #SW-2284 · Today 14:00</Text>
              </View>
              <Badge tone="info">In progress</Badge>
            </View>
          </View>

          {/* Stepper */}
          <View style={{ paddingTop: 8, paddingHorizontal: 18, paddingBottom: 16 }}>
            {TRACKER_STEPS.map((s, i, arr) => (
              <View key={s.label} style={{ flexDirection: 'row', gap: 12, minHeight: 36 }}>
                <View style={{ width: 14, alignItems: 'center' }}>
                  <View style={{
                    width: 12, height: 12, borderRadius: 6, marginTop: 4,
                    backgroundColor: s.done ? (s.active ? T.info : T.online) : 'transparent',
                    borderWidth: 1.5, borderColor: s.done ? (s.active ? T.info : T.online) : T.hairline2,
                  }} />
                  {i < arr.length - 1 && (
                    <View style={{
                      flex: 1, width: 2, borderRadius: 1, marginTop: 2, marginBottom: 2,
                      backgroundColor: s.done ? T.info : T.hairline2,
                    }} />
                  )}
                </View>
                <View style={{ flex: 1, paddingBottom: 6 }}>
                  <Text style={{
                    fontSize: 13, fontFamily: s.active ? F.semibold : F.medium,
                    color: s.done ? T.text : T.textMuted,
                  }}>{s.label}</Text>
                  <Text style={{ fontSize: 11, color: T.textMuted, marginTop: 1, fontFamily: F.regular }}>{s.time}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 8, paddingTop: 10, paddingHorizontal: 16, paddingBottom: 14, borderTopWidth: 1, borderTopColor: T.hairline }}>
            {[{ icon: 'phone', label: 'Call technician' }, { icon: 'map', label: 'Live track' }].map(b => (
              <Pressable key={b.label} style={({ pressed }) => ({
                flex: 1, padding: 10, borderRadius: 10,
                backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: T.hairline,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                opacity: pressed ? 0.7 : 1,
              })}>
                <Icon name={b.icon} size={14} color={T.text} />
                <Text style={{ color: T.text, fontSize: 12.5, fontFamily: F.medium }}>{b.label}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      </View>

      {/* Segmented tabs */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
        <View style={{
          flexDirection: 'row', backgroundColor: T.surface, borderRadius: 10, padding: 3,
          borderWidth: 1, borderColor: T.hairline,
        }}>
          {[{ id: 'all', label: 'All' }, { id: 'jobs', label: 'Jobs' }, { id: 'complaints', label: 'Complaints' }].map(x => (
            <Pressable key={x.id} onPress={() => setTab(x.id)} style={{
              flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
              backgroundColor: tab === x.id ? T.elev2 : 'transparent',
            }}>
              <Text style={{
                fontSize: 12.5, fontFamily: tab === x.id ? F.semibold : F.medium,
                color: tab === x.id ? T.text : T.textDim,
              }}>{x.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* History */}
      <View style={{ paddingHorizontal: 20 }}>
        <SectionTitle>History</SectionTitle>
        <View style={{ gap: 10 }}>
          {filtered.map(item => (
            <Card key={item.id} padding={14}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View style={{
                  width: 34, height: 34, borderRadius: 10,
                  backgroundColor: item.kind === 'job' ? 'rgba(43,160,198,0.12)' : 'rgba(245,158,11,0.12)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name={item.kind === 'job' ? 'wrench' : 'bolt'} size={16}
                    color={item.kind === 'job' ? T.info : T.offline} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, justifyContent: 'space-between' }}>
                    <Text style={{ flex: 1, fontSize: 13.5, fontFamily: F.semibold, color: T.text }}>{item.title}</Text>
                    <Text style={{ fontSize: 11, color: T.textMuted, fontFamily: F.mono }}>{item.date}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: T.textDim, marginTop: 3, lineHeight: 17, fontFamily: F.regular }}>{item.detail}</Text>
                  <View style={{ marginTop: 8 }}>
                    <Badge tone={item.status === 'Resolved' || item.status === 'Completed' ? 'success' : item.status === 'In progress' ? 'info' : 'offline'}>
                      {item.status}
                    </Badge>
                  </View>
                </View>
              </View>
            </Card>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
