// Technician — Jobs queue (today's schedule + decorative route panel).
// Ported from mashtronics (1)/source-export/screen-tech-jobs.jsx; data from
// GET /api/app/jobs via useMyJobs. The route panel is decorative (real
// geodata is a later milestone — same stance as PanicActiveScreen's FauxMap);
// stop dots reflect real job count/status, the fake "28 km" figure from the
// mockup is deliberately dropped.

import React from 'react';
import { View, Text, ScrollView, RefreshControl, Image, ActivityIndicator, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { useAuth } from '../../state/AuthContext';
import useMyJobs from '../../hooks/useMyJobs';
import { Dot, Badge, Card, SectionTitle, Avatar, IconButton } from '../../ui';
import Icon from '../../ui/Icon';
import { T, F } from '../../theme/tokens';

const STATUS_META = {
  done:          { tone: 'online',  label: 'Completed' },
  'in-progress': { tone: 'info',    label: 'In progress' },
  upcoming:      { tone: 'neutral', label: 'Upcoming' },
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// Decorative route panel: grid + dashed route + one dot per job, colored by
// status (done = green, in-progress = teal glow, upcoming = hollow).
function RoutePanel({ jobs }) {
  const W = 320;
  const H = 152;
  const route = 'M20 120 Q 70 100, 110 80 T 200 55 Q 250 40, 300 30';
  // spread stops along the route's rough diagonal
  const stops = jobs.slice(0, 6).map((job, i) => {
    const f = jobs.length === 1 ? 0.5 : i / Math.min(jobs.length - 1, 5);
    return { x: 20 + f * 280, y: 120 - f * 90, status: job.status };
  });
  return (
    <View style={{
      height: H, borderRadius: 16, overflow: 'hidden',
      backgroundColor: '#0E1620', borderWidth: 1, borderColor: T.hairline,
    }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {Array.from({ length: 7 }, (_, i) => (
          <Line key={`h${i}`} x1={0} y1={i * 22} x2={W} y2={i * 22} stroke="rgba(43,160,198,0.06)" strokeWidth={1} />
        ))}
        {Array.from({ length: 15 }, (_, i) => (
          <Line key={`v${i}`} x1={i * 22} y1={0} x2={i * 22} y2={H} stroke="rgba(43,160,198,0.06)" strokeWidth={1} />
        ))}
        <Path d={route} stroke="rgba(255,255,255,0.1)" strokeWidth={10} fill="none" />
        <Path d={route} stroke={T.info} strokeWidth={1.5} strokeDasharray="5 7" fill="none" />
        {stops.map((s, i) => {
          const done = s.status === 'done';
          const active = s.status === 'in-progress';
          return (
            <React.Fragment key={i}>
              {active && <Circle cx={s.x} cy={s.y} r={13} fill="rgba(43,160,198,0.2)" />}
              <Circle cx={s.x} cy={s.y} r={8}
                fill={done ? T.online : active ? T.info : 'transparent'}
                stroke={done ? T.online : active ? T.info : T.hairline2} strokeWidth={2} />
            </React.Fragment>
          );
        })}
      </Svg>
      <View style={{
        position: 'absolute', bottom: 10, left: 10,
        paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
        backgroundColor: 'rgba(10,14,20,0.7)', borderWidth: 1, borderColor: T.hairline,
        flexDirection: 'row', alignItems: 'center', gap: 6,
      }}>
        <Icon name="navigate" size={12} color={T.info} />
        <Text style={{ fontSize: 11, color: T.text, fontFamily: F.medium }}>
          {jobs.length} stop{jobs.length === 1 ? '' : 's'}
        </Text>
      </View>
    </View>
  );
}

function JobCard({ job, onPress }) {
  const meta = STATUS_META[job.status] || STATUS_META.upcoming;
  const doneTasks = job.checklist.filter((c) => c.done).length;
  const total = job.checklist.length;
  const progress = total === 0 ? 0 : doneTasks / total;
  return (
    <Card padding={0} onPress={onPress}>
      <View style={{ paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', gap: 12 }}>
        <View style={{ width: 44, alignItems: 'center' }}>
          <Text style={{ fontSize: 15, fontFamily: F.monoSemibold, color: T.text }}>{job.time || '—'}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <Text style={{ fontSize: 14, fontFamily: F.semibold, color: T.text, flexShrink: 1 }} numberOfLines={1}>
              {job.client || 'Client'}
            </Text>
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </View>
          <Text style={{ fontSize: 12, color: T.textDim, fontFamily: F.regular }} numberOfLines={1}>{job.task}</Text>
          {job.address ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <Icon name="pin" size={11} color={T.textMuted} />
              <Text style={{ fontSize: 11.5, color: T.textMuted, fontFamily: F.regular, flex: 1 }} numberOfLines={1}>
                {job.address}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ justifyContent: 'center' }}>
          <Icon name="chevR" size={16} color={T.textMuted} />
        </View>
      </View>
      {total > 0 && (
        <View style={{
          paddingTop: 8, paddingBottom: 12, paddingHorizontal: 16,
          borderTopWidth: 1, borderTopColor: T.hairline,
          flexDirection: 'row', alignItems: 'center', gap: 8,
        }}>
          <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: T.elev, overflow: 'hidden' }}>
            <View style={{
              width: `${progress * 100}%`, height: '100%', borderRadius: 2,
              backgroundColor: job.status === 'done' ? T.online : T.info,
            }} />
          </View>
          <Text style={{ fontSize: 10.5, color: T.textMuted, fontFamily: F.mono }}>
            {doneTasks}/{total} tasks
          </Text>
        </View>
      )}
    </Card>
  );
}

export default function TechJobsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { jobs, loading, error, refetch } = useMyJobs();
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
      {/* Brand bar */}
      <View style={{
        paddingHorizontal: 20, paddingBottom: 14,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Image
          source={require('../../../assets/images/mashtronics-wordmark.png')}
          style={{ height: 26, width: 160, resizeMode: 'contain' }}
        />
        <View style={{
          paddingVertical: 4, paddingHorizontal: 9, borderRadius: 6,
          backgroundColor: 'rgba(43,160,198,0.1)', borderWidth: 1, borderColor: 'rgba(43,160,198,0.25)',
        }}>
          <Text style={{ fontSize: 9.5, fontFamily: F.bold, color: T.info, letterSpacing: 1.4, textTransform: 'uppercase' }}>
            Field Tech
          </Text>
        </View>
      </View>

      {/* Greeting */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={profile?.name || ''} size={42} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 12, color: T.textMuted, fontFamily: F.medium, letterSpacing: 0.2 }}>{greeting()}</Text>
          <Text style={{ fontSize: 19, color: T.text, fontFamily: F.semibold, letterSpacing: -0.3 }} numberOfLines={1}>
            {profile?.name || 'Technician'}
          </Text>
        </View>
        <IconButton icon="bell" />
      </View>

      {loading ? (
        <View style={{ paddingVertical: 60, alignItems: 'center' }}>
          <ActivityIndicator color={T.info} />
        </View>
      ) : error ? (
        <View style={{ marginHorizontal: 20 }}>
          <Card>
            <Text style={{ fontSize: 13.5, fontFamily: F.semibold, color: T.text, marginBottom: 6 }}>
              Couldn't load your schedule
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
        </View>
      ) : (
        <>
          {/* Status strip */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14,
              backgroundColor: jobs.length === 0 ? 'rgba(122,178,60,0.06)' : 'rgba(43,160,198,0.06)',
              borderWidth: 1, borderColor: jobs.length === 0 ? 'rgba(122,178,60,0.25)' : 'rgba(43,160,198,0.2)',
            }}>
              <Dot color={jobs.length === 0 ? T.online : T.info} pulse={jobs.length > 0} />
              <Text style={{ flex: 1, fontSize: 13, color: T.text, fontFamily: F.medium }}>
                {jobs.length === 0
                  ? 'All caught up — nothing on your active schedule'
                  : `${jobs.length} job${jobs.length === 1 ? '' : 's'} on your schedule`}
              </Text>
            </View>
          </View>

          {/* Route panel */}
          {jobs.length > 0 && (
            <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
              <RoutePanel jobs={jobs} />
            </View>
          )}

          {/* Job list */}
          <View style={{ paddingHorizontal: 20 }}>
            <SectionTitle>Your schedule</SectionTitle>
            <View style={{ gap: 10 }}>
              {jobs.map((job) => (
                <JobCard key={job.id} job={job}
                  onPress={() => navigation.navigate('JobDetail', { jobId: job.id, initialJob: job })} />
              ))}
              {jobs.length === 0 && (
                <Card>
                  <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
                    <View style={{
                      width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: 'rgba(122,178,60,0.1)',
                    }}>
                      <Icon name="check" size={22} color={T.online} />
                    </View>
                    <Text style={{ fontSize: 13.5, fontFamily: F.semibold, color: T.text }}>All caught up</Text>
                    <Text style={{ fontSize: 12.5, color: T.textDim, fontFamily: F.regular, textAlign: 'center', lineHeight: 18 }}>
                      Nothing on your active schedule right now. New job assignments will appear here instantly.
                    </Text>
                  </View>
                </Card>
              )}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}
