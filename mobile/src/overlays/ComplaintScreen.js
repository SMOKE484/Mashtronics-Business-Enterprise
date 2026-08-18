// Report an issue — 4-step wizard (type → camera → details/photo → done).
// Submits as a formatted support chat message so the admin team sees it in
// the existing chat inbox.
// TODO(Track B): swap the submit for POST /api/app/complaints once the
// complaint → job creation endpoint exists (features.md MBMS 5 / SW2).
// Photo is picked and previewed locally only — Supabase Storage upload
// arrives with that endpoint.
// Ported from mashtronics/screen-complaint.jsx.

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { api } from '../lib/api';
import useCameras from '../hooks/useCameras';
import { Badge } from '../ui';
import Icon from '../ui/Icon';
import CameraThumb from '../ui/CameraThumb';
import { COMPLAINT_TYPES } from '../data/placeholders';
import { T, F } from '../theme/tokens';

export default function ComplaintScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { cameras } = useCameras();
  const [step, setStep] = useState(0);
  const [issueType, setIssueType] = useState(COMPLAINT_TYPES[0].label);
  const [camera, setCamera] = useState(null); // camera name or 'General / not camera-specific'
  const [desc, setDesc] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const close = () => navigation.goBack();
  const back = () => (step > 0 && step < 3 ? setStep(step - 1) : close());

  const pickPhoto = async () => {
    if (photoUri) {
      setPhotoUri(null);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) setPhotoUri(result.assets[0].uri);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const lines = [
      `[Complaint] ${issueType}`,
      `Camera: ${camera || 'Not camera-specific'}`,
      desc.trim() ? `Details: ${desc.trim()}` : null,
      photoUri ? '(Photo taken — will share on request)' : null,
    ].filter(Boolean);
    try {
      await api('/api/app/messages', { method: 'POST', body: { text: lines.join('\n') } });
      setStep(3);
    } catch {
      setError("Couldn't submit — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const header = (sub, title) => (
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Pressable onPress={back} style={({ pressed }) => ({
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: T.hairline,
          alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1,
        })}>
          <Icon name={step > 0 && step < 3 ? 'chevL' : 'x'} size={18} color={T.text} />
        </Pressable>
        {step < 3 && (
          <Text style={{ fontSize: 12, color: T.textMuted, fontFamily: F.monoMedium }}>{step + 1} / 3</Text>
        )}
      </View>
      <Text style={{ fontSize: 11, fontFamily: F.bold, letterSpacing: 1.5, color: T.info, textTransform: 'uppercase' }}>{sub}</Text>
      <Text style={{ fontSize: 26, fontFamily: F.bold, color: T.text, letterSpacing: -0.5, marginTop: 4 }}>{title}</Text>
    </View>
  );

  const selectCardStyle = (sel) => ({
    padding: 16, borderRadius: 14,
    backgroundColor: sel ? 'rgba(43,160,198,0.08)' : T.surface,
    borderWidth: 1, borderColor: sel ? 'rgba(43,160,198,0.4)' : T.hairline,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  });

  return (
    <View style={{ flex: 1, backgroundColor: T.ink }}>
      {step === 0 && (
        <>
          {header('Report an issue', "What's wrong?")}
          <ScrollView contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 20, paddingBottom: 20, gap: 10 }}>
            {COMPLAINT_TYPES.map(tp => {
              const sel = issueType === tp.label;
              return (
                <Pressable key={tp.label} onPress={() => setIssueType(tp.label)} style={selectCardStyle(sel)}>
                  <View style={{
                    width: 38, height: 38, borderRadius: 10,
                    backgroundColor: sel ? 'rgba(43,160,198,0.18)' : 'rgba(255,255,255,0.05)',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name={tp.icon} size={18} color={sel ? T.info : T.textDim} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 14.5, fontFamily: F.medium, color: T.text }}>{tp.label}</Text>
                  <View style={{
                    width: 20, height: 20, borderRadius: 10,
                    borderWidth: 1.5, borderColor: sel ? T.info : T.hairline2,
                    backgroundColor: sel ? T.info : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {sel && <Icon name="check" size={11} color="#fff" strokeWidth={3} />}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}

      {step === 1 && (
        <>
          {header('Affected camera', 'Which one?')}
          <ScrollView contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 20, paddingBottom: 20, gap: 10 }}>
            {cameras.map(c => {
              const sel = camera === c.name;
              return (
                <Pressable key={c.id} onPress={() => setCamera(c.name)} style={{ ...selectCardStyle(sel), padding: 12 }}>
                  <CameraThumb online={c.status === 'online'} width={50} height={38} radius={8} iconSize={14} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13.5, fontFamily: F.semibold, color: T.text }}>{c.name}</Text>
                    {c.location ? (
                      <Text style={{ fontSize: 11.5, color: T.textDim, marginTop: 2, fontFamily: F.regular }}>{c.location}</Text>
                    ) : null}
                  </View>
                  <Badge tone={c.status === 'online' ? 'online' : 'offline'}>
                    {c.status === 'online' ? 'Online' : 'Offline'}
                  </Badge>
                </Pressable>
              );
            })}
            {(() => {
              const generalLabel = 'Not camera-specific';
              const sel = camera === generalLabel;
              return (
                <Pressable onPress={() => setCamera(generalLabel)} style={{ ...selectCardStyle(sel), padding: 12 }}>
                  <View style={{
                    width: 50, height: 38, borderRadius: 8,
                    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: T.hairline,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name="info" size={14} color={T.textDim} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 13.5, fontFamily: F.semibold, color: T.text }}>{generalLabel}</Text>
                </Pressable>
              );
            })()}
          </ScrollView>
        </>
      )}

      {step === 2 && (
        <>
          {header('Details', 'Tell us more')}
          <ScrollView contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 20, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
            <TextInput
              value={desc}
              onChangeText={setDesc}
              placeholder={`Describe the issue with ${camera || 'your system'}…`}
              placeholderTextColor={T.textMuted}
              multiline
              style={{
                minHeight: 120, padding: 14, borderRadius: 14,
                backgroundColor: T.surface, borderWidth: 1, borderColor: T.hairline,
                color: T.text, fontSize: 14, fontFamily: F.regular,
                lineHeight: 20, textAlignVertical: 'top',
              }}
            />

            <Text style={{
              fontSize: 11, fontFamily: F.semibold, letterSpacing: 1.2, color: T.textMuted,
              textTransform: 'uppercase', marginTop: 16, marginBottom: 8,
            }}>Attach photo</Text>
            <Pressable onPress={pickPhoto} style={({ pressed }) => ({
              padding: 14, borderRadius: 14,
              backgroundColor: photoUri ? 'rgba(122,178,60,0.08)' : T.surface,
              borderWidth: 1, borderStyle: 'dashed',
              borderColor: photoUri ? 'rgba(122,178,60,0.4)' : T.hairline2,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: pressed ? 0.8 : 1,
            })}>
              {photoUri ? (
                <>
                  <Image source={{ uri: photoUri }} style={{ width: 34, height: 34, borderRadius: 6 }} />
                  <Text style={{ color: T.text, fontSize: 13.5, fontFamily: F.regular }}>1 photo attached</Text>
                  <Text style={{ color: T.textMuted, fontSize: 13.5, fontFamily: F.regular }}>· tap to remove</Text>
                </>
              ) : (
                <>
                  <Icon name="image" size={16} color={T.textDim} />
                  <Text style={{ color: T.textDim, fontSize: 13.5, fontFamily: F.regular }}>Choose from library</Text>
                </>
              )}
            </Pressable>
            {photoUri ? (
              <Text style={{ fontSize: 11, color: T.textMuted, marginTop: 6, paddingHorizontal: 4, fontFamily: F.regular }}>
                Photo upload is coming soon — for now the team will ask for it in chat if needed.
              </Text>
            ) : null}

            <View style={{
              marginTop: 18, padding: 12, borderRadius: 12,
              backgroundColor: 'rgba(43,160,198,0.06)', borderWidth: 1, borderColor: 'rgba(43,160,198,0.18)',
              flexDirection: 'row', gap: 10, alignItems: 'flex-start',
            }}>
              <Icon name="info" size={16} color={T.info} />
              <Text style={{ flex: 1, fontSize: 11.5, color: T.textDim, lineHeight: 17, fontFamily: F.regular }}>
                Your report goes straight to the Mashtronics team. You'll get updates in the Chat tab.
              </Text>
            </View>
            {error ? (
              <Text style={{ fontSize: 12.5, color: '#FF7A72', marginTop: 12, fontFamily: F.medium }}>{error}</Text>
            ) : null}
          </ScrollView>
        </>
      )}

      {step === 3 && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{
            width: 92, height: 92, borderRadius: 46,
            backgroundColor: 'rgba(122,178,60,0.12)',
            borderWidth: 2, borderColor: 'rgba(122,178,60,0.4)',
            alignItems: 'center', justifyContent: 'center', marginBottom: 22,
          }}>
            <Icon name="check" size={42} color={T.online} strokeWidth={2.4} />
          </View>
          <Text style={{ fontSize: 24, fontFamily: F.bold, color: T.text, letterSpacing: -0.5, textAlign: 'center' }}>
            Complaint submitted
          </Text>
          <Text style={{ fontSize: 14, color: T.textDim, marginTop: 10, textAlign: 'center', lineHeight: 21, maxWidth: 280, fontFamily: F.regular }}>
            We've received your report for <Text style={{ color: T.text, fontFamily: F.semibold }}>{camera || 'your system'}</Text>. A team member will be in touch shortly — watch the Chat tab.
          </Text>
        </View>
      )}

      {/* Footer */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 20) + 20 }}>
        {step < 3 ? (
          <Pressable
            onPress={() => (step === 2 ? submit() : setStep(step + 1))}
            disabled={busy || (step === 1 && !camera)}
            style={({ pressed }) => ({
              padding: 15, borderRadius: 14, backgroundColor: T.info, alignItems: 'center',
              opacity: (step === 1 && !camera) ? 0.5 : pressed || busy ? 0.85 : 1,
            })}
          >
            {busy
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontSize: 14.5, fontFamily: F.semibold, letterSpacing: 0.1 }}>
                  {step === 2 ? 'Submit complaint' : 'Continue'}
                </Text>}
          </Pressable>
        ) : (
          <Pressable onPress={close} style={({ pressed }) => ({
            padding: 15, borderRadius: 14, backgroundColor: T.elev2,
            borderWidth: 1, borderColor: T.hairline2, alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
          })}>
            <Text style={{ color: T.text, fontSize: 14.5, fontFamily: F.semibold }}>Done</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
