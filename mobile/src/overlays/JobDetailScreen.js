// Technician — Job detail overlay: a 4-step wizard (Overview → Checklist →
// Photos → Sign-off), ported from mashtronics (1)/source-export/
// screen-tech-jobdetail.jsx. Server is authoritative on every gate
// (server/routes/appJobs.js); lib/jobGating.js mirrors them so CTAs disable
// instantly. Renders the job passed from the list immediately and refetches
// in the background (stale-while-revalidate).

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import useJob from '../hooks/useJob';
import { Card, SectionTitle } from '../ui';
import Icon from '../ui/Icon';
import SignaturePad from '../ui/SignaturePad';
import { openMaps, callPhone } from '../lib/nav';
import { checklistProgress, canContinueChecklist, hasProofPhoto } from '../lib/jobGating';
import { signatureSize, SIGNATURE_MAX_CHARS } from '../lib/signature';
import { T, F } from '../theme/tokens';

const STEPS = ['Overview', 'Checklist', 'Photos', 'Sign-off'];

function InlineError({ children }) {
  if (!children) return null;
  return (
    <View style={{
      marginTop: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
      backgroundColor: 'rgba(255,59,48,0.08)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.25)',
    }}>
      <Text style={{ fontSize: 12, color: '#FF7A72', fontFamily: F.medium, lineHeight: 17 }}>{children}</Text>
    </View>
  );
}

// Full-width bottom CTA, mockup style: teal when enabled, elevated-muted when
// not; green variant for the final Complete action.
function BottomCta({ label, disabled, busy, onPress, green = false, bottomInset }) {
  const enabled = !disabled && !busy;
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(bottomInset, 18) + 8 }}>
      <Pressable
        disabled={!enabled}
        onPress={onPress}
        style={({ pressed }) => ({
          width: '100%', padding: 15, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
          backgroundColor: enabled ? (green ? T.online : T.info) : T.elev,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{
            fontSize: 14.5, fontFamily: green ? F.bold : F.semibold,
            color: enabled ? (green ? '#08150a' : '#fff') : T.textMuted,
          }}>{label}</Text>
        )}
      </Pressable>
    </View>
  );
}

export default function JobDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { jobId, initialJob } = route.params || {};
  const { job, loading, error, refetch, start, setChecklistItem, addPhoto, removePhoto, complete } = useJob(jobId, initialJob);

  const [step, setStep] = useState(() => (initialJob && initialJob.status !== 'upcoming' ? 1 : 0));
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(null);
  const [linkError, setLinkError] = useState(null);
  const [checklistError, setChecklistError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const [signatureStrokes, setSignatureStrokes] = useState([]);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState(null);
  const [completed, setCompleted] = useState(false);

  const close = () => navigation.goBack();
  const back = () => (step > 0 ? setStep(step - 1) : close());

  // ── shared header ─────────────────────────────────────────────
  const header = (eyebrow, title) => (
    <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Pressable onPress={back} style={({ pressed }) => ({
          width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: T.hairline,
          opacity: pressed ? 0.7 : 1,
        })}>
          <Icon name={step > 0 ? 'chevL' : 'x'} size={18} color={T.text} />
        </Pressable>
        <Text style={{ fontSize: 12, color: T.textMuted, fontFamily: F.mono }}>
          {STEPS[step]} · {step + 1}/4
        </Text>
      </View>
      <Text style={{ fontSize: 11, fontFamily: F.bold, letterSpacing: 1.5, color: T.info, textTransform: 'uppercase' }}>
        {eyebrow}
      </Text>
      <Text style={{ fontSize: 24, fontFamily: F.bold, color: T.text, letterSpacing: -0.5, marginTop: 4 }}>
        {title}
      </Text>
    </View>
  );

  // ── loading / error shell (nothing cached to show) ───────────
  if (!job) {
    return (
      <View style={{ flex: 1, backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
        {loading ? (
          <ActivityIndicator color={T.info} />
        ) : (
          <>
            <Text style={{ color: T.text, fontSize: 16, fontFamily: F.semibold }}>Couldn't load this job</Text>
            <Text style={{ color: T.textDim, fontSize: 13, fontFamily: F.regular, textAlign: 'center' }}>
              {error || 'Check your connection and try again.'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={refetch} style={{ paddingVertical: 10, paddingHorizontal: 22, borderRadius: 12, backgroundColor: T.info }}>
                <Text style={{ color: '#fff', fontSize: 13.5, fontFamily: F.semibold }}>Retry</Text>
              </Pressable>
              <Pressable onPress={close} style={{ paddingVertical: 10, paddingHorizontal: 22, borderRadius: 12, borderWidth: 1, borderColor: T.hairline2 }}>
                <Text style={{ color: T.textDim, fontSize: 13.5, fontFamily: F.medium }}>Close</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    );
  }

  // ── success beat after completing (high-stakes confirmation) ──
  if (completed) {
    return (
      <View style={{ flex: 1, backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
        <View style={{
          width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(122,178,60,0.12)', borderWidth: 1, borderColor: 'rgba(122,178,60,0.4)',
        }}>
          <Icon name="check" size={34} color={T.online} strokeWidth={2.5} />
        </View>
        <Text style={{ color: T.text, fontSize: 20, fontFamily: F.bold, letterSpacing: -0.4 }}>Job completed</Text>
        <Text style={{ color: T.textDim, fontSize: 13.5, fontFamily: F.regular, textAlign: 'center', lineHeight: 19 }}>
          {job.client ? `${job.client}'s sign-off is saved.` : 'The sign-off is saved.'} Nice work.
        </Text>
        <Pressable onPress={close} style={{ marginTop: 8, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12, backgroundColor: T.online }}>
          <Text style={{ color: '#08150a', fontSize: 14, fontFamily: F.bold }}>Back to jobs</Text>
        </Pressable>
      </View>
    );
  }

  const progress = checklistProgress(job);
  const readOnly = job.status === 'done' || job.status === 'cancelled';

  // ── actions ───────────────────────────────────────────────────
  const onStart = async () => {
    if (job.status !== 'upcoming') { setStep(1); return; }
    setStarting(true);
    setStartError(null);
    try {
      await start();
      setStep(1);
    } catch (err) {
      setStartError(err.message || "Couldn't start the job — try again.");
    } finally {
      setStarting(false);
    }
  };

  const onToggleTask = async (index, done) => {
    setChecklistError(null);
    try {
      await setChecklistItem(index, done);
    } catch (err) {
      setChecklistError(err.message || "Couldn't save that task — try again.");
    }
  };

  const pickAndUpload = async (fromCamera) => {
    setPhotoError(null);
    try {
      let result;
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setPhotoError('Camera access is off for SecureWatch — enable it in your phone settings.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: true, exif: false });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
      }
      if (result.canceled || !result.assets?.[0]?.base64) return;
      setUploading(true);
      await addPhoto(result.assets[0].base64);
    } catch (err) {
      setPhotoError(err.message || "Couldn't add the photo — try again.");
    } finally {
      setUploading(false);
    }
  };

  const onAddPhoto = () => {
    Alert.alert('Add a photo', 'Proof of the finished work for the customer record.', [
      { text: 'Take photo', onPress: () => pickAndUpload(true) },
      { text: 'Choose from library', onPress: () => pickAndUpload(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const onRemovePhoto = (index) => {
    Alert.alert('Remove photo', 'Remove this photo from the job record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          setPhotoError(null);
          try { await removePhoto(index); }
          catch (err) { setPhotoError(err.message || "Couldn't remove the photo — try again."); }
        },
      },
    ]);
  };

  const onComplete = async () => {
    setCompleteError(null);
    if (signatureSize(signatureStrokes) > SIGNATURE_MAX_CHARS) {
      setCompleteError('That signature is too detailed to save — clear it and sign again more simply.');
      return;
    }
    setCompleting(true);
    try {
      await complete({ svgPaths: signatureStrokes, viewWidth: 320, viewHeight: 160 });
      setCompleted(true);
    } catch (err) {
      setCompleteError(err.message || "Couldn't complete the job — try again.");
    } finally {
      setCompleting(false);
    }
  };

  // ── steps ─────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: T.ink }}>
      {step === 0 && (
        <>
          {header(job.jobType, job.client || 'Job')}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 20, paddingBottom: 20 }}>
            <Card padding={14} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <Icon name="pin" size={16} color={T.textDim} />
                <Text style={{ flex: 1, fontSize: 13, color: T.text, fontFamily: F.regular, lineHeight: 18 }}>
                  {job.address || 'No address on file — check with the office.'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Pressable
                  disabled={!job.address}
                  onPress={async () => setLinkError(await openMaps(job.address))}
                  style={({ pressed }) => ({
                    flex: 1, padding: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                    backgroundColor: 'rgba(43,160,198,0.1)', borderWidth: 1, borderColor: 'rgba(43,160,198,0.25)',
                    opacity: !job.address ? 0.4 : pressed ? 0.7 : 1,
                  })}
                >
                  <Icon name="navigate" size={14} color={T.info} />
                  <Text style={{ fontSize: 12.5, color: T.info, fontFamily: F.semibold }}>Navigate</Text>
                </Pressable>
                <Pressable
                  disabled={!job.clientPhone}
                  onPress={async () => setLinkError(await callPhone(job.clientPhone))}
                  style={({ pressed }) => ({
                    flex: 1, padding: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: T.hairline,
                    opacity: !job.clientPhone ? 0.4 : pressed ? 0.7 : 1,
                  })}
                >
                  <Icon name="phone" size={14} color={T.text} />
                  <Text style={{ fontSize: 12.5, color: T.text, fontFamily: F.semibold }}>Call client</Text>
                </Pressable>
              </View>
              <InlineError>{linkError}</InlineError>
            </Card>

            <SectionTitle>Task</SectionTitle>
            <Card padding={14} style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 13.5, color: T.text, fontFamily: F.regular, lineHeight: 19 }}>{job.task}</Text>
            </Card>

            <SectionTitle>Parts & equipment</SectionTitle>
            <Card padding={0}>
              {job.parts.length === 0 ? (
                <Text style={{ padding: 14, fontSize: 13, color: T.textDim, fontFamily: F.regular }}>
                  No parts listed for this job.
                </Text>
              ) : (
                job.parts.map((part, i) => (
                  <View key={`${part}-${i}`} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14,
                    borderBottomWidth: i < job.parts.length - 1 ? 1 : 0, borderBottomColor: T.hairline,
                  }}>
                    <Icon name="wrench" size={14} color={T.textDim} />
                    <Text style={{ flex: 1, fontSize: 13, color: T.text, fontFamily: F.regular }}>{part}</Text>
                  </View>
                ))
              )}
            </Card>
            <InlineError>{startError}</InlineError>
          </ScrollView>
          {readOnly ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 18) + 8 }}>
              <View style={{
                padding: 13, borderRadius: 14, alignItems: 'center',
                backgroundColor: job.status === 'done' ? 'rgba(122,178,60,0.08)' : 'rgba(255,255,255,0.04)',
                borderWidth: 1, borderColor: job.status === 'done' ? 'rgba(122,178,60,0.3)' : T.hairline,
              }}>
                <Text style={{ fontSize: 13.5, fontFamily: F.semibold, color: job.status === 'done' ? T.online : T.textDim }}>
                  {job.status === 'done' ? 'Completed and signed off' : 'This job was cancelled'}
                </Text>
              </View>
            </View>
          ) : (
            <BottomCta
              label={job.status === 'upcoming' ? 'Start job' : 'Continue job'}
              busy={starting}
              onPress={onStart}
              bottomInset={insets.bottom}
            />
          )}
        </>
      )}

      {step === 1 && (
        <>
          {header('On-site checklist', 'Complete tasks')}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 20, paddingBottom: 20 }}>
            <View style={{ gap: 10 }}>
              {job.checklist.map((item, i) => (
                <Pressable
                  key={i}
                  disabled={readOnly}
                  onPress={() => onToggleTask(i, !item.done)}
                  style={({ pressed }) => ({
                    padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
                    backgroundColor: item.done ? 'rgba(122,178,60,0.06)' : T.surface,
                    borderWidth: 1, borderColor: item.done ? 'rgba(122,178,60,0.3)' : T.hairline,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <View style={{
                    width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1.5, borderColor: item.done ? T.online : T.hairline2,
                    backgroundColor: item.done ? T.online : 'transparent',
                  }}>
                    {item.done && <Icon name="check" size={13} color="#fff" strokeWidth={3} />}
                  </View>
                  <Text style={{
                    flex: 1, fontSize: 13.5, fontFamily: F.medium,
                    textDecorationLine: item.done ? 'line-through' : 'none',
                    color: item.done ? T.textDim : T.text,
                  }}>{item.label}</Text>
                </Pressable>
              ))}
              {job.checklist.length === 0 && (
                <Card>
                  <Text style={{ fontSize: 13, color: T.textDim, fontFamily: F.regular, lineHeight: 18 }}>
                    No checklist for this job — continue straight to photos.
                  </Text>
                </Card>
              )}
            </View>
            <InlineError>{checklistError}</InlineError>
          </ScrollView>
          <BottomCta
            label={canContinueChecklist(job) ? 'Continue to photos' : `${progress.done}/${progress.total} tasks complete`}
            disabled={!canContinueChecklist(job)}
            onPress={() => setStep(2)}
            bottomInset={insets.bottom}
          />
        </>
      )}

      {step === 2 && (
        <>
          {header('Proof of work', 'Add photos')}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 20, paddingBottom: 20 }}>
            <Text style={{ fontSize: 12.5, color: T.textDim, fontFamily: F.regular, marginBottom: 14, lineHeight: 18 }}>
              Capture the finished install/repair for the customer record.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {job.photos.map((photo, i) => (
                <Pressable
                  key={photo.path}
                  onLongPress={() => !readOnly && onRemovePhoto(i)}
                  style={{
                    width: '48%', aspectRatio: 4 / 3, borderRadius: 14, overflow: 'hidden',
                    backgroundColor: 'rgba(122,178,60,0.08)',
                    borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(122,178,60,0.4)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {photo.url ? (
                    <Image source={{ uri: photo.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View style={{ alignItems: 'center', gap: 6 }}>
                      <Icon name="check" size={22} color={T.online} />
                      <Text style={{ fontSize: 11, color: T.textDim, fontFamily: F.regular }}>Captured</Text>
                      <Text onPress={refetch} style={{ fontSize: 11, color: T.info, fontFamily: F.medium }}>
                        Load preview
                      </Text>
                    </View>
                  )}
                  {!readOnly && (
                    <Pressable onPress={() => onRemovePhoto(i)} style={{
                      position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12,
                      backgroundColor: 'rgba(10,14,20,0.75)', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name="x" size={13} color={T.text} />
                    </Pressable>
                  )}
                </Pressable>
              ))}
              {uploading && (
                <View style={{
                  width: '48%', aspectRatio: 4 / 3, borderRadius: 14,
                  backgroundColor: T.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: T.hairline2,
                  alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <ActivityIndicator color={T.info} />
                  <Text style={{ fontSize: 11, color: T.textMuted, fontFamily: F.regular }}>Uploading…</Text>
                </View>
              )}
              {!readOnly && !uploading && (
                <Pressable onPress={onAddPhoto} style={({ pressed }) => ({
                  width: '48%', aspectRatio: 4 / 3, borderRadius: 14,
                  backgroundColor: T.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: T.hairline2,
                  alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: pressed ? 0.7 : 1,
                })}>
                  <Icon name="cameraPlus" size={22} color={T.textMuted} />
                  <Text style={{ fontSize: 11, color: T.textMuted, fontFamily: F.regular }}>Tap to add</Text>
                </Pressable>
              )}
            </View>
            <InlineError>{photoError}</InlineError>
            {job.photos.length > 0 && !readOnly && (
              <Text style={{ marginTop: 12, fontSize: 11, color: T.textMuted, fontFamily: F.regular }}>
                Long-press a photo (or tap ×) to remove it.
              </Text>
            )}
          </ScrollView>
          <BottomCta
            label={hasProofPhoto(job)
              ? `Continue with ${job.photos.length} photo${job.photos.length === 1 ? '' : 's'}`
              : 'Add at least 1 photo'}
            disabled={!hasProofPhoto(job)}
            onPress={() => setStep(3)}
            bottomInset={insets.bottom}
          />
        </>
      )}

      {step === 3 && (
        <>
          {header('Customer sign-off', 'Confirm & submit')}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 20, paddingBottom: 20 }} scrollEnabled={false}>
            <View style={{
              padding: 12, borderRadius: 12, marginBottom: 16, flexDirection: 'row', gap: 10, alignItems: 'flex-start',
              backgroundColor: 'rgba(43,160,198,0.06)', borderWidth: 1, borderColor: 'rgba(43,160,198,0.18)',
            }}>
              <Icon name="info" size={16} color={T.info} />
              <Text style={{ flex: 1, fontSize: 11.5, color: T.textDim, fontFamily: F.regular, lineHeight: 17 }}>
                Have <Text style={{ color: T.text, fontFamily: F.semibold }}>{job.client || 'the customer'}</Text> sign
                below to confirm the work was completed satisfactorily.
              </Text>
            </View>
            <SignaturePad onChange={setSignatureStrokes} />
            <InlineError>{completeError}</InlineError>
            {completeError && (
              <Pressable onPress={() => setStep(1)} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                <Text style={{ fontSize: 12.5, color: T.info, fontFamily: F.medium }}>← Back to checklist</Text>
              </Pressable>
            )}
          </ScrollView>
          <BottomCta
            label="Complete job"
            green
            disabled={signatureStrokes.length === 0}
            busy={completing}
            onPress={onComplete}
            bottomInset={insets.bottom}
          />
        </>
      )}
    </View>
  );
}
