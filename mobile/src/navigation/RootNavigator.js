import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

import { useAuth } from '../state/AuthContext';
import { RealtimeProvider, useRealtime } from '../state/RealtimeContext';
import { navigationRef } from './navigationRef';
import { registerForPushNotificationsAsync } from '../lib/pushNotifications';
import { api } from '../lib/api';
import { TabBarItem } from '../ui';
import { T, F } from '../theme/tokens';

import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import ClaimInviteScreen from '../screens/auth/ClaimInviteScreen';
import StaffHomeScreen from '../screens/staff/StaffHomeScreen';
import TechJobsScreen from '../screens/staff/TechJobsScreen';
import TechHistoryScreen from '../screens/staff/TechHistoryScreen';
import TechProfileScreen from '../screens/staff/TechProfileScreen';
import JobDetailScreen from '../overlays/JobDetailScreen';
import HomeScreen from '../screens/HomeScreen';
import CamerasScreen from '../screens/CamerasScreen';
import ActivityScreen from '../screens/ActivityScreen';
import ChatScreen from '../screens/ChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PanicArmScreen from '../overlays/PanicArmScreen';
import PanicActiveScreen from '../overlays/PanicActiveScreen';
import ComplaintScreen from '../overlays/ComplaintScreen';
import QuoteRequestScreen from '../overlays/QuoteRequestScreen';
import CameraDetailScreen from '../overlays/CameraDetailScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TABS = [
  { name: 'Home',     icon: 'home',     component: HomeScreen },
  { name: 'Cameras',  icon: 'camera',   component: CamerasScreen },
  { name: 'Activity', icon: 'activity', component: ActivityScreen },
  { name: 'Chat',     icon: 'chat',     component: ChatScreen },
  { name: 'Profile',  icon: 'user',     component: ProfileScreen },
];

const TECH_TABS = [
  { name: 'Jobs',        icon: 'truck',    component: TechJobsScreen },
  { name: 'TechHistory', icon: 'activity', component: TechHistoryScreen, label: 'History' },
  { name: 'TechProfile', icon: 'user',     component: TechProfileScreen, label: 'Profile' },
];

function SwTabBar({ state, navigation, tabs }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: T.hairline }}>
      <BlurView intensity={40} tint="dark" style={{
        flexDirection: 'row',
        backgroundColor: 'rgba(10,14,20,0.85)',
        paddingBottom: Math.max(insets.bottom, 18),
      }}>
        {state.routes.map((route, index) => (
          <TabBarItem
            key={route.key}
            icon={tabs[index].icon}
            label={tabs[index].label || route.name}
            active={state.index === index}
            onPress={() => navigation.navigate(route.name)}
          />
        ))}
      </BlurView>
    </View>
  );
}

function makeTabsNavigator(tabs) {
  return function TabsNavigator() {
    return (
      <Tab.Navigator
        tabBar={(props) => <SwTabBar {...props} tabs={tabs} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: T.ink } }}
      >
        {tabs.map(t => (
          <Tab.Screen key={t.name} name={t.name} component={t.component} />
        ))}
      </Tab.Navigator>
    );
  };
}

const Tabs = makeTabsNavigator(TABS);
const TechTabs = makeTabsNavigator(TECH_TABS);

// A reopened (or backgrounded) app must land back on the active alert.
// Lives outside any screen, so it navigates through the container ref.
function PanicWatcher() {
  const { activePanic } = useRealtime();
  useEffect(() => {
    if (!activePanic || !navigationRef.isReady()) return;
    const current = navigationRef.getCurrentRoute()?.name;
    if (current !== 'PanicActive' && current !== 'PanicArm') {
      navigationRef.navigate('PanicActive');
    }
  }, [activePanic]);
  return null;
}

function ReadyNavigator() {
  return (
    <RealtimeProvider>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.ink } }}>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="PanicArm" component={PanicArmScreen}
          options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="PanicActive" component={PanicActiveScreen}
          options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="Complaint" component={ComplaintScreen}
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="QuoteRequest" component={QuoteRequestScreen}
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="CameraDetail" component={CameraDetailScreen}
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      </Stack.Navigator>
      <PanicWatcher />
    </RealtimeProvider>
  );
}

// Registers this device's Expo push token against the linked staff record
// (once per session) and routes a tapped notification's jobId straight to
// JobDetail. Lives outside any screen, same "invisible watcher" pattern as
// PanicWatcher. Registration failures (no EAS project, permission denied,
// Expo Go on Android — see lib/pushNotifications.js) are swallowed there;
// this component just has nothing to send in that case.
function StaffPushRegistrar() {
  const { profile } = useAuth();
  const registeredForRef = useRef(null);

  useEffect(() => {
    if (!profile?.staffId || registeredForRef.current === profile.staffId) return;
    registeredForRef.current = profile.staffId;
    (async () => {
      const token = await registerForPushNotificationsAsync();
      if (!token) return;
      try {
        await api('/api/app/staff-me/push-token', { method: 'PATCH', body: { token } });
      } catch (err) {
        console.warn('[push] failed to register token with server:', err.message);
      }
    })();
  }, [profile?.staffId]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const jobId = response.notification.request.content.data?.jobId;
      if (jobId && navigationRef.isReady()) {
        navigationRef.navigate('JobDetail', { jobId });
      }
    });
    return () => sub.remove();
  }, []);

  return null;
}

// Staff shell — no RealtimeProvider (client-only), but does get the push
// registrar above. Technicians get the real Jobs/History/Profile tabs plus
// the job-detail wizard overlay; response officers keep the placeholder
// until the armed-response slice is built.
function StaffReadyNavigator() {
  const { profile } = useAuth();

  return (
    <>
      <StaffPushRegistrar />
      {profile?.staffType === 'technician' ? (
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.ink } }}>
          <Stack.Screen name="TechTabs" component={TechTabs} />
          <Stack.Screen name="JobDetail" component={JobDetailScreen}
            options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.ink } }}>
          <Stack.Screen name="StaffHome" component={StaffHomeScreen} />
        </Stack.Navigator>
      )}
    </>
  );
}

function Splash() {
  return (
    <View style={{ flex: 1, backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center' }}>
      <Image
        source={require('../../assets/images/mashtronics-wordmark.png')}
        style={{ height: 30, width: 220, resizeMode: 'contain' }}
      />
    </View>
  );
}

function ErrorRetry() {
  const { retry } = useAuth();
  return (
    <View style={{ flex: 1, backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
      <Text style={{ color: T.text, fontSize: 17, fontFamily: F.semibold }}>Can't reach the server</Text>
      <Text style={{ color: T.textDim, fontSize: 13, fontFamily: F.regular, textAlign: 'center', lineHeight: 19 }}>
        Check your connection and that the Mashtronics service is reachable, then try again.
      </Text>
      <Pressable onPress={retry} style={{
        paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: T.info,
      }}>
        <Text style={{ color: '#fff', fontSize: 14, fontFamily: F.semibold }}>Retry</Text>
      </Pressable>
    </View>
  );
}

export default function RootNavigator() {
  const { status, profile } = useAuth();

  if (status === 'loading') return <Splash />;
  if (status === 'error') return <ErrorRetry />;

  if (status === 'signedOut') {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.ink } }}>
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
      </Stack.Navigator>
    );
  }

  if (status === 'unlinked') {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.ink } }}>
        <Stack.Screen name="ClaimInvite" component={ClaimInviteScreen} />
      </Stack.Navigator>
    );
  }

  if (profile?.accountType === 'staff') return <StaffReadyNavigator />;
  return <ReadyNavigator />;
}
