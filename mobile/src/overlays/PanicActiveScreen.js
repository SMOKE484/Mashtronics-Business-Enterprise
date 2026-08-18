// Active emergency — elapsed timer from the alert's triggeredAt, stage
// timeline rendered from PanicAlert.stages and live-updated via the
// panic:update realtime event. "I'm safe — stand down" PATCHes the alert.
// Ported from PanicActiveOverlay (screen-panic.jsx).

import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';

import { useRealtime } from '../state/RealtimeContext';
import { useAuth } from '../state/AuthContext';
import { Card, SectionTitle } from '../ui';
import Icon from '../ui/Icon';
import { T, F } from '../theme/tokens';

function Pulsing({ children, style }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ), -1, false);
  }, []);
  const s = useAnimatedStyle(() => ({ transform: [{ scale: 1 + v.value * 0.05 }] }));
  return <Animated.View style={[style, s]}>{children}</Animated.View>;
}

// Static faux map — grid + roads + responder route. A real map comes with
// live GPS in a later milestone.
function FauxMap({ address }) {
  const gridLines = [];
  for (let i = 24; i < 320; i += 24) {
    gridLines.push(<Line key={`v${i}`} x1={i} y1={0} x2={i} y2={200} stroke="rgba(43,160,198,0.06)" strokeWidth={1} />);
  }
  for (let i = 24; i < 200; i += 24) {
    gridLines.push(<Line key={`h${i}`} x1={0} y1={i} x2={320} y2={i} stroke="rgba(43,160,198,0.06)" strokeWidth={1} />);
  }
  return (
    <View style={{
      height: 200, borderRadius: 16, overflow: 'hidden',
      backgroundColor: '#0E1620', borderWidth: 1, borderColor: T.hairline,
    }}>
      <Svg width="100%" height="100%" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice">
        {gridLines}
        <Circle cx={192} cy={110} r={90} fill="rgba(43,160,198,0.08)" />
        <Path d="M-10 130 Q 60 110, 110 130 T 230 110 Q 280 100, 340 130"
          stroke="rgba(255,255,255,0.08)" strokeWidth={14} fill="none" />
        <Path d="M-10 130 Q 60 110, 110 130 T 230 110 Q 280 100, 340 130"
          stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} strokeDasharray="6 8" fill="none" />
        <Path d="M40 30 Q 100 60, 130 50 T 240 70"
          stroke="rgba(255,255,255,0.05)" strokeWidth={10} fill="none" />
        <Path d="M50 50 Q 100 80, 160 100 T 200 145"
          stroke={T.info} strokeWidth={2} fill="none" strokeDasharray="4 4" strokeLinecap="round" />
      </Svg>
      {/* responder pin */}
      <View style={{
        position: 'absolute', top: 38, left: 38,
        width: 28, height: 28, borderRadius: 14, backgroundColor: T.info,
        borderWidth: 2, borderColor: '#fff',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="truck" size={14} color="#fff" strokeWidth={2.2} />
      </View>
      {/* user pin */}
      <Pulsing style={{ position: 'absolute', top: 130, left: 188 }}>
        <View style={{
          width: 14, height: 14, borderRadius: 7, backgroundColor: T.danger,
          borderWidth: 3, borderColor: '#fff',
        }} />
      </Pulsing>
      {/* corner badge */}
      {address ? (
        <View style={{
          position: 'absolute', bottom: 10, left: 10,
          paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
          backgroundColor: 'rgba(10,14,20,0.85)',
          borderWidth: 1, borderColor: T.hairline,
          flexDirection: 'row', alignItems: 'center', gap: 6,
        }}>
          <Icon name="pin" size={12} color={T.danger} />
          <Text style={{ fontSize: 11, color: T.text, fontFamily: F.medium }} numberOfLines={1}>{address}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function PanicActiveScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { activePanic, standDown } = useRealtime();
  const { profile } = useAuth();
  const [now, setNow] = useState(Date.now());
  const [standing, setStanding] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Alert resolved (by us or the control room) → leave the emergency screen.
  useEffect(() => {
    if (!activePanic) navigation.navigate('Tabs');
  }, [activePanic, navigation]);

  if (!activePanic) return <View style={{ flex: 1, backgroundColor: T.ink }} />;

  const startedAt = new Date(activePanic.triggeredAt || activePanic.createdAt).getTime();
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const mins = Math.floor(elapsed / 60);
  const secs = String(elapsed % 60).padStart(2, '0');

  const stages = activePanic.stages || [];

  const onStandDown = () => {
    Alert.alert("I'm safe", 'Stand down this emergency? The response team will be notified.', [
      { text: 'Not yet', style: 'cancel' },
      {
        text: 'Stand down',
        onPress: async () => {
          setStanding(true);
          try {
            await standDown();
            // activePanic → null effect navigates away.
          } catch {
            setStanding(false);
            Alert.alert('Failed', "Couldn't reach the server. Try again or phone 011 765 4148.");
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.ink }}>
      {/* Banner */}
      <LinearGradient colors={['rgba(255,59,48,0.18)', 'rgba(255,59,48,0)']}
        style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pulsing>
            <View style={{
              width: 36, height: 36, borderRadius: 18, backgroundColor: T.danger,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="shield" size={18} color="#fff" strokeWidth={2.2} />
            </View>
          </Pulsing>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontFamily: F.bold, letterSpacing: 2, color: T.danger, textTransform: 'uppercase' }}>
              Active emergency
            </Text>
            <Text style={{ fontSize: 18, fontFamily: F.semibold, color: T.text, letterSpacing: -0.3 }}>
              Help is on the way
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 10, color: T.textMuted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: F.medium }}>Elapsed</Text>
            <Text style={{ fontSize: 18, fontFamily: F.monoSemibold, color: T.text }}>{mins}:{secs}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Map */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        <FauxMap address={profile?.billingAddress} />
      </View>

      {/* Stage timeline */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 14 }}>
        <SectionTitle>Status</SectionTitle>
        <Card padding={0}>
          {stages.map((s, i) => {
            const isLast = i === stages.length - 1;
            const at = s.at ? new Date(s.at).getTime() : startedAt;
            const agoS = Math.max(0, Math.floor((now - at) / 1000));
            const ago = agoS < 60 ? `${agoS}s ago` : `${Math.floor(agoS / 60)}m ago`;
            return (
              <View key={`${s.label}-${i}`} style={{
                flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 14,
                borderBottomWidth: isLast ? 0 : 1, borderBottomColor: T.hairline,
              }}>
                <View style={{ width: 18, paddingTop: 2, alignItems: 'center' }}>
                  {isLast ? (
                    <Pulsing>
                      <View style={{
                        width: 14, height: 14, borderRadius: 7,
                        backgroundColor: T.danger, borderWidth: 1.5, borderColor: T.danger,
                      }} />
                    </Pulsing>
                  ) : (
                    <View style={{
                      width: 14, height: 14, borderRadius: 7,
                      backgroundColor: T.online, borderWidth: 1.5, borderColor: T.online,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name="check" size={9} color="#fff" strokeWidth={3} />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5, fontFamily: F.medium, color: T.text }}>{s.label}</Text>
                  {s.detail ? (
                    <Text style={{ fontSize: 11.5, color: T.textDim, marginTop: 2, fontFamily: F.regular }}>{s.detail}</Text>
                  ) : null}
                </View>
                <Text style={{ fontSize: 11, color: T.textMuted, fontFamily: F.mono }}>{ago}</Text>
              </View>
            );
          })}
        </Card>
        <Text style={{ fontSize: 11.5, color: T.textMuted, marginTop: 10, lineHeight: 16, paddingHorizontal: 4, fontFamily: F.regular }}>
          Updates appear here live as the control room responds.
        </Text>
      </ScrollView>

      {/* Actions */}
      <View style={{
        flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12,
        paddingBottom: Math.max(insets.bottom, 20) + 20,
      }}>
        <Pressable style={({ pressed }) => ({
          flex: 1, padding: 14, borderRadius: 14,
          backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: T.hairline2,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
          opacity: pressed ? 0.7 : 1,
        })}>
          <Icon name="phone" size={16} color={T.text} />
          <Text style={{ color: T.text, fontSize: 14, fontFamily: F.medium }}>Call response</Text>
        </Pressable>
        <Pressable onPress={onStandDown} disabled={standing} style={({ pressed }) => ({
          flex: 1, padding: 14, borderRadius: 14, backgroundColor: T.danger,
          alignItems: 'center', justifyContent: 'center',
          opacity: pressed || standing ? 0.8 : 1,
        })}>
          {standing
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontSize: 14, fontFamily: F.semibold }}>I'm safe — stand down</Text>}
        </Pressable>
      </View>
    </View>
  );
}
