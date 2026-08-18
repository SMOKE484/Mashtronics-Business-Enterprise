'use strict';

// Shapes a Camera document down to exactly what the SecureWatch app needs —
// matches mashtronics/app.jsx's SW_SEED.cameras field-for-field, plus a
// derived hasLiveView flag. streamConfig (opaque, provider-specific, may
// hold credentials) is never touched here and never leaves this function.
function toAppCamera(camera) {
  return {
    id: String(camera._id),
    name: camera.name,
    location: camera.location,
    model: camera.model,
    status: camera.status,
    signal: camera.signal,
    hasLiveView: !!camera.streamProvider,
  };
}

module.exports = { toAppCamera };
