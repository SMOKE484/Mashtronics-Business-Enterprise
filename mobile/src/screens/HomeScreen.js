// Home — brand bar, greeting, status strip, PANIC hero (hold-to-arm),
// quick actions, active service tracker (placeholder), camera glance.
// Ported from mashtronics/screen-home.jsx.

import React, { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps,
  withTiming, withRepeat, withSequence, Easing, runOnJS, cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../state/AuthContext';
import useCameras from '../hooks/useCameras';
import { Dot, Badge, Card, Avatar, SectionTitle, IconButton, BlinkDot } from '../ui';
import Icon from '../ui/Icon';
import CameraThumb from '../ui/CameraThumb';
import { T, F } from '../theme/tokens';

const HOLD_MS = 1500;
const RING_R = 106;
const RING_C = 2 * Math.PI * RING_R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function PanicHero({ onArm }) {
  const progress = useSharedValue(0); // 0..1 hold progress
  const glow = useSharedValue(0);     // ambient pulse

  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ), -1, false);
    return () => {
      cancelAnimation(glow);
      cancelAnimation(progress);
    };
  }, []);

  const fire = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onArm();
  };

  const onPressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    progress.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear }, (finished) => {
      if (finished) {
        progress.value = 0;
        runOnJS(fire)();
      }
    });
  };
  const onPressOut = () => {
    progress.value = withTiming(0, { duration: 200 });
  };

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + glow.value * 0.5,
    transform: [{ scale: 1 + glow.value * 0.08 }],
  }));
  const innerRingStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(255,59,48,${0.25 + progress.value * 0.5})`,
    transform: [{ scale: 1 + progress.value * 0.04 }],
  }));
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - progress.value * 0.03 }],
  }));
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_C * (1 - progress.value),
  }));

  return (
    <View style={{ paddingTop: 4, paddingBottom: 18, alignItems: 'center' }}>
      <View style={{ width: 232, height: 232, alignItems: 'center', justifyContent: 'center' }}>
        {/* outer glow */}
        <Animated.View style={[{ position: 'absolute', width: 232, height: 232, borderRadius: 116 }, glowStyle]}>
          <Svg width={232} height={232}>
            <Circle cx={116} cy={116} r={110} fill="rgba(255,59,48,0.10)" />
            <Circle cx={116} cy={116} r={90} fill="rgba(255,59,48,0.08)" />
          </Svg>
        </Animated.View>
        {/* inner ring that intensifies with hold */}
        <Animated.View style={[{
          position: 'absolute', left: 18, top: 18, right: 18, bottom: 18,
          borderRadius: 98, borderWidth: 1,
        }, innerRingStyle]} />
        {/* progress ring */}
        <Svg width={232} height={232} viewBox="0 0 232 232"
          style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }} pointerEvents="none">
          <Circle cx={116} cy={116} r={RING_R} fill="none" stroke="rgba(255,59,48,0.18)" strokeWidth={2.5} />
          <AnimatedCircle cx={116} cy={116} r={RING_R} fill="none"
            stroke={T.danger} strokeWidth={3} strokeLinecap="round"
            strokeDasharray={`${RING_C}`} animatedProps={ringProps} />
        </Svg>
        {/* button face */}
        <Pressable onPressIn={onPressIn} onPressOut={onPressOut}>
          <Animated.View style={[{
            width: 178, height: 178, borderRadius: 89,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
            alignItems: 'center', justifyContent: 'center', gap: 8,
            overflow: 'hidden',
            shadowColor: T.danger, shadowOpacity: 0.4, shadowRadius: 24,
            shadowOffset: { width: 0, height: 12 }, elevation: 16,
          }, faceStyle]}>
            <LinearGradient
              colors={['#FF5A50', T.danger, T.dangerDeep]}
              locations={[0, 0.45, 1]}
              start={{ x: 0.5, y: 0.1 }} end={{ x: 0.5, y: 1 }}
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            />
            <Icon name="shield" size={36} color="#fff" strokeWidth={1.8} />
            <Text style={{ fontSize: 22, fontFamily: F.bold, color: '#fff', letterSpacing: 2, lineHeight: 24 }}>SOS</Text>
            <Text style={{ fontSize: 10, fontFamily: F.semibold, color: 'rgba(255,255,255,0.85)', letterSpacing: 1.4, textTransform: 'uppercase' }}>
              Emergency
            </Text>
          </Animated.View>
        </Pressable>
      </View>
      <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <BlinkDot color={T.danger} size={5} />
        <Text style={{ fontSize: 12, color: T.textDim, letterSpacing: 0.2, fontFamily: F.regular }}>
          Hold to activate · Live response on standby
        </Text>
      </View>
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { cameras } = useCameras();

  const onlineCount = cameras.filter(c => c.status === 'online').length;
  const allOnline = cameras.length > 0 && onlineCount === cameras.length;
  const offlineCount = cameras.length - onlineCount;
  const displayName = profile?.contactName || profile?.name || '';

  const quickActions = [
    { icon: 'wrench', label: 'Report\nIssue',  onPress: () => navigation.navigate('Complaint') },
    { icon: 'chat',   label: 'Live\nChat',     onPress: () => navigation.navigate('Chat') },
    { icon: 'doc',    label: 'Request\nQuote', onPress: () => navigation.navigate('QuoteRequest') },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.ink }} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 24 }}>
      {/* Brand bar */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Image source={require('../../assets/images/mashtronics-wordmark.png')}
          style={{ height: 26, width: 150, resizeMode: 'contain' }} />
        <View style={{
          paddingVertical: 4, paddingHorizontal: 9, borderRadius: 6,
          backgroundColor: 'rgba(122,178,60,0.1)', borderWidth: 1, borderColor: 'rgba(122,178,60,0.25)',
        }}>
          <Text style={{ fontSize: 9.5, fontFamily: F.bold, color: T.brandGreen, letterSpacing: 1.4, textTransform: 'uppercase' }}>
            SecureWatch
          </Text>
        </View>
      </View>

      {/* Greeting */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={displayName} size={42} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: T.textMuted, fontFamily: F.medium, letterSpacing: 0.2 }}>{greeting()}</Text>
          <Text style={{ fontSize: 19, color: T.text, fontFamily: F.semibold, letterSpacing: -0.3 }}>{displayName}</Text>
        </View>
        <IconButton icon="bell" />
      </View>

      {/* Status strip */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          paddingVertical: 10, paddingHorizontal: 12,
          backgroundColor: allOnline ? 'rgba(122,178,60,0.06)' : 'rgba(245,158,11,0.06)',
          borderWidth: 1, borderColor: allOnline ? 'rgba(122,178,60,0.2)' : 'rgba(245,158,11,0.2)',
          borderRadius: 14,
        }}>
          <Dot color={allOnline ? T.online : T.offline} pulse />
          <Text style={{ flex: 1, fontSize: 13, color: T.text, fontFamily: F.medium }}>
            {cameras.length === 0
              ? 'Loading system status…'
              : allOnline
                ? 'All systems online'
                : `${offlineCount} camera${offlineCount === 1 ? '' : 's'} offline`}
          </Text>
          <Text style={{ fontSize: 12, color: T.textDim, fontFamily: F.mono }}>
            {onlineCount}/{cameras.length} <Text style={{ color: T.textMuted }}>cams</Text>
          </Text>
        </View>
      </View>

      {/* PANIC hero */}
      <PanicHero onArm={() => navigation.navigate('PanicArm')} />

      {/* Quick actions */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 18, flexDirection: 'row', gap: 10 }}>
        {quickActions.map(a => (
          <Pressable key={a.label} onPress={a.onPress} style={({ pressed }) => ({
            flex: 1, backgroundColor: T.surface, borderWidth: 1, borderColor: T.hairline,
            borderRadius: 16, paddingTop: 14, paddingBottom: 12, paddingHorizontal: 8,
            alignItems: 'center', gap: 8, opacity: pressed ? 0.8 : 1,
          })}>
            <View style={{
              width: 32, height: 32, borderRadius: 10,
              backgroundColor: 'rgba(43,160,198,0.1)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={a.icon} size={18} color={T.info} />
            </View>
            <Text style={{ fontSize: 12, fontFamily: F.medium, lineHeight: 14, textAlign: 'center', color: T.textDim }}>
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Active service tracker — placeholder until jobs API reaches the app (SW3) */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
        <SectionTitle action="View all" onAction={() => navigation.navigate('Activity')}>Active service</SectionTitle>
        <Card onPress={() => navigation.navigate('Activity')} padding={0}>
          <View style={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: 'rgba(43,160,198,0.12)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="truck" size={22} color={T.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontFamily: F.semibold, color: T.text }}>Camera upgrade · Backyard</Text>
              <Text style={{ fontSize: 12, color: T.textDim, marginTop: 2, fontFamily: F.regular }}>Technician David · ETA 14 min</Text>
            </View>
            <Badge tone="info">In progress</Badge>
          </View>
          <View style={{
            paddingTop: 10, paddingHorizontal: 16, paddingBottom: 14,
            borderTopWidth: 1, borderTopColor: T.hairline,
            flexDirection: 'row', alignItems: 'center', gap: 6,
          }}>
            {['Scheduled', 'On the way', 'In progress', 'Done'].map((s, i) => (
              <React.Fragment key={s}>
                {i > 0 && <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: i <= 2 ? T.info : T.hairline2 }} />}
                <View style={{
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: i <= 2 ? T.info : 'transparent',
                  borderWidth: 1.5, borderColor: i <= 2 ? T.info : T.hairline2,
                }} />
              </React.Fragment>
            ))}
          </View>
        </Card>
      </View>

      {/* Camera glance */}
      <View style={{ paddingLeft: 20, paddingBottom: 24 }}>
        <SectionTitle action="See all" onAction={() => navigation.navigate('Cameras')} style={{ paddingRight: 20 }}>
          Your cameras
        </SectionTitle>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 20 }}>
          {cameras.slice(0, 4).map(c => (
            <Pressable key={c.id} onPress={() => navigation.navigate('Cameras')} style={({ pressed }) => ({
              width: 132, backgroundColor: T.surface, borderWidth: 1, borderColor: T.hairline,
              borderRadius: 14, padding: 10, opacity: pressed ? 0.8 : 1,
            })}>
              <View style={{ marginBottom: 8 }}>
                <CameraThumb online={c.status === 'online'} width={110} height={82} radius={9} showLive />
              </View>
              <Text style={{ fontSize: 12, fontFamily: F.semibold, color: T.text }}>{c.name}</Text>
              <View style={{ marginTop: 4 }}>
                <Badge tone={c.status === 'online' ? 'online' : 'offline'}>
                  {c.status === 'online' ? 'Online' : 'Offline'}
                </Badge>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}
