// Thin wrapper around the admin SSE stream (server/routes/events.js).
// A single shared EventSource is reused across every useAdminEvent() call so
// multiple components on the same page don't open duplicate connections.
import { useEffect, useRef } from 'react'

let sharedSource = null
let refCount = 0
const listeners = new Map() // eventName -> Set<callback>

function dispatch(eventName, payload) {
  listeners.get(eventName)?.forEach(cb => cb(payload))
}

function acquireSource() {
  if (!sharedSource) {
    sharedSource = new EventSource('/api/events', { withCredentials: true })
    sharedSource.addEventListener('chat:message', e => dispatch('chat:message', JSON.parse(e.data)))
    sharedSource.addEventListener('panic:new', e => dispatch('panic:new', JSON.parse(e.data)))
    sharedSource.addEventListener('panic:update', e => dispatch('panic:update', JSON.parse(e.data)))
  }
  refCount++
  return () => {
    refCount--
    if (refCount <= 0 && sharedSource) {
      sharedSource.close()
      sharedSource = null
    }
  }
}

export function useAdminEvent(eventName, callback) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!listeners.has(eventName)) listeners.set(eventName, new Set())
    const wrapped = payload => callbackRef.current(payload)
    listeners.get(eventName).add(wrapped)
    const release = acquireSource()
    return () => {
      listeners.get(eventName)?.delete(wrapped)
      release()
    }
  }, [eventName])
}
