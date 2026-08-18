// Proof-of-work photo upload: the phone uploads DIRECTLY to the private
// Supabase Storage bucket `job-photos` with the technician's own session
// (storage RLS pins the top-level folder to their auth.uid()), then the
// screen records the object path via POST /api/app/jobs/:id/photos — the
// server validates the path and that the object really exists.

import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

export const BUCKET = 'job-photos';

// Pure path builder — must match the server's required prefix
// `<uid>/jobs/<jobId>/` and its `^[\w.-]+$` filename rule. Unit tested.
export function jobPhotoPath(uid, jobId, ts = Date.now(), rand = Math.random().toString(36).slice(2, 8)) {
  return `${uid}/jobs/${jobId}/${ts}-${rand}.jpg`;
}

// Uploads a picker asset's base64 JPEG. Returns the object path on success;
// throws an Error with a readable message on failure (screens surface it on
// the photo tile).
export async function uploadJobPhoto({ jobId, base64 }) {
  if (!base64) throw new Error("Couldn't read the photo — try taking it again");

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData?.session?.user?.id;
  if (!uid) throw new Error('Your session expired — sign in again');

  const path = jobPhotoPath(uid, jobId);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(base64), { contentType: 'image/jpeg' });
  if (error) {
    throw new Error("Couldn't upload the photo — check your connection and try again");
  }
  return path;
}
