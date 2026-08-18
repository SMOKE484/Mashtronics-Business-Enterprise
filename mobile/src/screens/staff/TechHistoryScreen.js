// Technician — History (completed work). Ported from mashtronics (1)/
// source-export/screen-tech-history.jsx, minus star ratings — no rating
// capture exists in the product, so none are shown (deliberate scope call,
// don't fake them). Data from GET /api/app/jobs/history.

import React from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useJobHistory from '../../hooks/useJobHistory';
import { Card, Header } from '../../ui';
import Icon from '../../ui/Icon';
import { formatDuration, formatHistoryDate } from '../../lib/format';
import { T, F } from '../../theme/tokens';

// Same keyword mapping as the server's checklist templates.
function typeIcon(jobType) {
  const type = String(jobType || '').toLowerCase();
  if (type.includes('install')) return 'wrench';
  if (type.includes('service') || type.includes('maintenance')) return 'checklist';
  if (type.includes('repair') || type.includes('fix') || type.includes('fault')) return 'bolt';
  return 'doc';
}

export default function TechHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { jobs, loading, error, refetch } = useJobHistory();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.ink }}
      contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.textDim} />}
    >
      <Header large title="History" eyebrow="Completed work" />

      <View style={{ paddingHorizontal: 20, gap: 10 }}>
        {loading && (
          <View style={{ paddingVertical: 50, alignItems: 'center' }}>
            <ActivityIndicator color={T.info} />
          </View>
        )}

        {!loading && error && (
          <Card>
            <Text style={{ fontSize: 13.5, fontFamily: F.semibold, color: T.text, marginBottom: 6 }}>
              Couldn't load your history
            </Text>
            <Text style={{ fontSize: 12.5, color: T.textDim, fontFamily: F.regular, lineHeight: 18, marginBottom: 12 }}>
              Check your connection and try again.
            </Text>
            <Pressable onPress={refetch} style={({ pressed }) => ({
              alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10,
              backgroundColor: 'rgba(43,160,198,0.1)', borderWidth: 1, borderColor: 'rgba(43,160,198,0.25)',
              opacity: pressed ? 0.7 : 1,
            })}>
              <Text style={{ fontSize: 12.5, color: T.info, fontFamily: F.semibold }}>Retry</Text>
            </Pressable>
          </Card>
        )}

        {!loading && !error && jobs.length === 0 && (
          <Card>
            <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
              <View style={{
                width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(43,160,198,0.1)',
              }}>
                <Icon name="activity" size={22} color={T.info} />
              </View>
              <Text style={{ fontSize: 13.5, fontFamily: F.semibold, color: T.text }}>No completed jobs yet</Text>
              <Text style={{ fontSize: 12.5, color: T.textDim, fontFamily: F.regular, textAlign: 'center', lineHeight: 18 }}>
                Completed jobs will appear here after your first sign-off.
              </Text>
            </View>
          </Card>
        )}

        {!loading && !error && jobs.map((job) => {
          const duration = formatDuration(job.durationMinutes);
          return (
            <Card key={job.id} padding={14}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View style={{
                  width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'rgba(122,178,60,0.1)',
                }}>
                  <Icon name={typeIcon(job.jobType)} size={17} color={T.online} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 14, fontFamily: F.semibold, color: T.text, flexShrink: 1 }} numberOfLines={1}>
                      {job.client || 'Client'}
                    </Text>
                    <Text style={{ fontSize: 11.5, color: T.textMuted, fontFamily: F.mono }}>
                      {formatHistoryDate(job.completedAt)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: T.textDim, fontFamily: F.regular, marginTop: 2 }} numberOfLines={1}>
                    {[job.jobType, job.address].filter(Boolean).join(' · ')}
                  </Text>
                  {duration && (
                    <Text style={{ fontSize: 11.5, color: T.textMuted, fontFamily: F.mono, marginTop: 4 }}>
                      Duration: {duration}
                    </Text>
                  )}
                </View>
              </View>
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
}
