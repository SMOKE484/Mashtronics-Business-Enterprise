import React, { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../state/AuthContext';
import { AuthShell, BrandHeader, Field, PrimaryButton, ErrorNote } from './authUi';
import { T, F } from '../../theme/tokens';

export default function SignInScreen({ navigation }) {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      // AuthContext status change swaps the navigator.
    } catch (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'Incorrect email or password.'
        : err.message);
    } finally {
      // Always reset, even on paths where the navigator doesn't swap —
      // a spinner that never stops reads as a broken app.
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AuthShell>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <BrandHeader
            eyebrow="SecureWatch"
            title="Welcome back"
            subtitle="Sign in to monitor your cameras, chat with support, and stay protected."
          />
          <ErrorNote>{error}</ErrorNote>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="Your password"
            onSubmitEditing={submit}
          />
          <View style={{ marginTop: 8 }}>
            <PrimaryButton label="Sign in" onPress={submit} busy={busy} disabled={!email.trim() || !password} />
          </View>
          <Pressable onPress={() => navigation.navigate('SignUp')} style={{ marginTop: 20, alignItems: 'center' }}>
            <Text style={{ color: T.textDim, fontSize: 13, fontFamily: F.regular }}>
              New client? <Text style={{ color: T.info, fontFamily: F.semibold }}>Create an account</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </AuthShell>
    </KeyboardAvoidingView>
  );
}
