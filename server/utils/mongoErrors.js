'use strict';

// Translates a Mongoose/MongoDB error into a message safe to show a user.
// Logs the real error server-side so the technical detail isn't lost.
function friendlySaveError(err, label = 'record') {
  console.error(err);

  if (err && err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    return field
      ? `A ${label} with that ${field} already exists.`
      : `That ${label} already exists.`;
  }

  if (err && err.name === 'ValidationError') {
    const firstError = Object.values(err.errors || {})[0];
    return firstError ? firstError.message : `Couldn't save that ${label} — please check the form.`;
  }

  return `Couldn't save that ${label}. Please try again.`;
}

module.exports = { friendlySaveError };
