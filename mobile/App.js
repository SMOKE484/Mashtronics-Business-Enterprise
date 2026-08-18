import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { AuthProvider } from './src/state/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { configureNotificationHandler } from './src/lib/pushNotifications';
import { T } from './src/theme/tokens';

configureNotificationHandler();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: T.ink,
    card: T.ink,
    text: T.text,
    border: T.hairline,
    primary: T.info,
  },
};

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    'Geist-Regular': require('./assets/fonts/Geist-Regular.ttf'),
    'Geist-Medium': require('./assets/fonts/Geist-Medium.ttf'),
    'Geist-SemiBold': require('./assets/fonts/Geist-SemiBold.ttf'),
    'Geist-Bold': require('./assets/fonts/Geist-Bold.ttf'),
    'GeistMono-Regular': require('./assets/fonts/GeistMono-Regular.ttf'),
    'GeistMono-Medium': require('./assets/fonts/GeistMono-Medium.ttf'),
    'GeistMono-SemiBold': require('./assets/fonts/GeistMono-SemiBold.ttf'),
  });

  if (fontError) console.error('[App] font load error:', fontError);

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: T.ink }} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <NavigationContainer ref={navigationRef} theme={navTheme}>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
