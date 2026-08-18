import React, { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../state/AuthContext';
import { AuthShell, BrandHeader, Field, PrimaryButton, ErrorNote, SegmentedToggle } from './authUi';
import { looksLikeSAPhone } from '../../lib/phone';
import { T, F } from '../../theme/tokens';

const CHANNEL_OPTIONS = [
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
];

export default function SignUpScreen({ navigation }) {
  const { signUp } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState('sms');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const submit = async () => {
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!looksLikeSAPhone(phone)) {
      setError('Enter a valid South African phone number, e.g. 082 123 4567.');
      return;
    }
    setBusy(true);
    try {
      const result = await signUp(email.trim(), password, phone.trim(), channel);
      if (result.needsConfirmation) setNeedsConfirmation(true);
      // Otherwise a session exists and AuthContext moves to unlinked/ready;
      // ClaimInviteScreen auto-requests the invite code using the phone/
      // channel we just stashed in the Supabase session's user_metadata.
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (needsConfirmation) {
    return (
      <AuthShell>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 40 }}>
          <BrandHeader
            eyebrow="Check your inbox"
            title="Confirm your email"
            subtitle={`We sent a confirmation link to ${email.trim()}. Tap it, then come back and sign in.`}
          />
          <PrimaryButton label="Back to sign in" onPress={() => navigation.navigate('SignIn')} />
        </ScrollView>
      </AuthShell>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AuthShell>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <BrandHeader
            eyebrow="SecureWatch"
            title="Create your account"
            subtitle="We'll match your phone number to your Mashtronics account and send you a linking code automatically — no need to ask us for one."
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
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            autoComplete="tel"
            keyboardType="phone-pad"
            placeholder="082 123 4567"
          />
          <SegmentedToggle
            label="Send my code via"
            options={CHANNEL_OPTIONS}
            value={channel}
            onChange={setChannel}
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
          <Field
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            placeholder="Repeat your password"
            onSubmitEditing={submit}
          />
          <View style={{ marginTop: 8 }}>
            <PrimaryButton label="Create account" onPress={submit} busy={busy}
              disabled={!email.trim() || !phone.trim() || !password || !confirm} />
          </View>
          <Pressable onPress={() => navigation.navigate('SignIn')} style={{ marginTop: 20, alignItems: 'center' }}>
            <Text style={{ color: T.textDim, fontSize: 13, fontFamily: F.regular }}>
              Already have an account? <Text style={{ color: T.info, fontFamily: F.semibold }}>Sign in</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </AuthShell>
    </KeyboardAvoidingView>
  );
}
