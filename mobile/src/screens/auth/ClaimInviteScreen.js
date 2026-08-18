// Shown when signed in to Supabase but not yet linked to a Client record.
// An 8-character invite code (valid 7 days) links this login to a Client —
// either self-service (auto-requested below via the phone number captured
// at sign-up, POST /api/app/auth/request-invite) or admin-issued
// (POST /api/clients/:id/app-invite). Claiming (POST /api/app/auth/claim)
// works the same either way.

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../state/AuthContext';
import { ApiError } from '../../lib/api';
import { AuthShell, BrandHeader, Field, PrimaryButton, ErrorNote } from './authUi';
import Icon from '../../ui/Icon';
import { T, F } from '../../theme/tokens';

export default function ClaimInviteScreen() {
  const { claim, signOut, getUserEmail, getUserMetadata, requestInvite } = useAuth();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // 'manual' = no phone on file for this session (e.g. an account created
  // before this feature existed) — skip auto-send, keep the old manual flow.
  const [sendStatus, setSendStatus] = useState('sending');
  const [sendError, setSendError] = useState(null);
  const [resendBusy, setResendBusy] = useState(false);
  const autoSentRef = useRef(false);

  const { phone, channel = 'sms' } = getUserMetadata();
  const channelLabel = channel === 'email' ? 'email' : 'SMS';

  const sendCode = async () => {
    setSendStatus('sending');
    setSendError(null);
    try {
      await requestInvite(phone, channel);
      setSendStatus('sent');
    } catch (err) {
      setSendStatus('error');
      setSendError(err.message);
    }
  };

  useEffect(() => {
    if (autoSentRef.current) return;
    autoSentRef.current = true;
    if (phone) sendCode();
    else setSendStatus('manual');
  }, []);

  const resend = async () => {
    setResendBusy(true);
    await sendCode();
    setResendBusy(false);
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await claim(code);
      // Success flips status to ready.
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError('Invalid or expired invite code. Ask Mashtronics to send you a new one.');
      } else {
        setError(err.message);
      }
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AuthShell>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <BrandHeader
            eyebrow="One last step"
            title="Link your account"
            subtitle={`You're signed in as ${getUserEmail()}. Enter the invite code to connect this login to your SecureWatch account.`}
          />

          {sendStatus !== 'manual' && (
            <View style={{
              marginBottom: 14, padding: 12, borderRadius: 12,
              backgroundColor: sendStatus === 'error' ? 'rgba(255,59,48,0.1)' : 'rgba(43,160,198,0.06)',
              borderWidth: 1,
              borderColor: sendStatus === 'error' ? 'rgba(255,59,48,0.3)' : 'rgba(43,160,198,0.18)',
              flexDirection: 'row', gap: 10, alignItems: 'flex-start',
            }}>
              <Icon name="info" size={16} color={sendStatus === 'error' ? '#FF7A72' : T.info} />
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 12.5, lineHeight: 18, fontFamily: F.medium,
                  color: sendStatus === 'error' ? '#FF7A72' : T.textDim,
                }}>
                  {sendStatus === 'sending' && `Sending your code via ${channelLabel}…`}
                  {sendStatus === 'sent' && `If we found an account matching your number, we've sent a code via ${channelLabel}. Enter it below.`}
                  {sendStatus === 'error' && sendError}
                </Text>
                {sendStatus !== 'sending' && (
                  <Pressable onPress={resend} disabled={resendBusy} style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 12, fontFamily: F.semibold, color: T.info, opacity: resendBusy ? 0.5 : 1 }}>
                      {resendBusy ? 'Resending…' : 'Resend code'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          <ErrorNote>{error}</ErrorNote>
          <Field
            label="Invite code"
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            placeholder="e.g. 3F9A2B1C"
            style={{
              backgroundColor: T.surface, borderWidth: 1, borderColor: T.hairline,
              borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
              color: T.text, fontSize: 18, fontFamily: F.monoMedium,
              letterSpacing: 4, textAlign: 'center',
            }}
            onSubmitEditing={submit}
          />
          <View style={{ marginTop: 8 }}>
            <PrimaryButton label="Link account" onPress={submit} busy={busy} disabled={code.trim().length < 8} />
          </View>

          <View style={{
            marginTop: 20, padding: 12, borderRadius: 12,
            backgroundColor: 'rgba(43,160,198,0.06)', borderWidth: 1, borderColor: 'rgba(43,160,198,0.18)',
            flexDirection: 'row', gap: 10, alignItems: 'flex-start',
          }}>
            <Icon name="info" size={16} color={T.info} />
            <Text style={{ flex: 1, fontSize: 11.5, color: T.textDim, lineHeight: 17, fontFamily: F.regular }}>
              Nothing arriving, or number not recognized? Contact Mashtronics on 011 765 4148 and we'll get you linked. Codes expire after 7 days.
            </Text>
          </View>

          <Pressable onPress={signOut} style={{ marginTop: 24, alignItems: 'center' }}>
            <Text style={{ color: T.textMuted, fontSize: 13, fontFamily: F.medium }}>
              Sign out and use a different account
            </Text>
          </Pressable>
        </ScrollView>
      </AuthShell>
    </KeyboardAvoidingView>
  );
}
