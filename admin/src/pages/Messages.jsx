import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../api'
import { LoadingState, LoadErrorState, EmptyState, ActionErrorBanner } from '../components/PageState'
import { useAdminEvent } from '../hooks/useAdminEvents'
import './Messages.css'

function formatTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const SENDER_LABEL = { client: null, admin: null, ai: 'Mashtronics AI', system: null }

export default function Messages() {
  const [threads, setThreads] = useState([])
  const [threadsLoading, setThreadsLoading] = useState(true)
  const [threadsError, setThreadsError] = useState('')

  const [selectedId, setSelectedId] = useState(null)
  const [thread, setThread] = useState([])
  const [chatMode, setChatMode] = useState('ai')
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadError, setThreadError] = useState('')

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState('')

  const selectedIdRef = useRef(null)
  selectedIdRef.current = selectedId

  const loadThreads = useCallback(() => {
    if (!threads.length) setThreadsLoading(true)
    setThreadsError('')
    api.get('/messages/threads')
      .then(setThreads)
      .catch(err => setThreadsError(err.message))
      .finally(() => setThreadsLoading(false))
  }, [threads.length])

  useEffect(loadThreads, [])

  const loadThread = useCallback((clientId) => {
    setThreadLoading(true)
    setThreadError('')
    api.get(`/messages?clientId=${clientId}`)
      .then(messages => {
        setThread(messages)
        const t = threads.find(x => x.clientId === clientId)
        setChatMode(t?.chatMode || 'ai')
        return api.patch(`/messages/threads/${clientId}/read`)
      })
      .then(() => setThreads(prev => prev.map(t => (t.clientId === clientId ? { ...t, unreadCount: 0 } : t))))
      .catch(err => setThreadError(err.message))
      .finally(() => setThreadLoading(false))
  }, [threads])

  function selectThread(clientId) {
    setSelectedId(clientId)
    setSendError('')
    setResolveError('')
    loadThread(clientId)
  }

  async function sendReply(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || !selectedId) return
    setSendError('')
    setSending(true)
    try {
      const message = await api.post('/messages', { clientId: selectedId, text })
      setThread(prev => [...prev, message])
      setDraft('')
      loadThreads()
    } catch (err) {
      setSendError(err.message)
    } finally {
      setSending(false)
    }
  }

  async function resolveThread() {
    if (!selectedId) return
    setResolveError('')
    setResolving(true)
    try {
      const { message } = await api.patch(`/messages/threads/${selectedId}/resolve`)
      setThread(prev => [...prev, message])
      setChatMode('ai')
      loadThreads()
    } catch (err) {
      setResolveError(err.message)
    } finally {
      setResolving(false)
    }
  }

  // Live updates over the shared admin SSE stream.
  useAdminEvent('chat:message', useCallback((payload) => {
    if (payload.clientRef === selectedIdRef.current) {
      setThread(prev => (prev.some(m => m._id === payload._id) ? prev : [...prev, payload]))
    }
    loadThreads()
  }, [loadThreads]))

  return (
    <div className="split-layout">
      <div className="card msg-list-card">
        <div className="card-title-row">
          <div className="card-title">Conversations</div>
        </div>
        {threadsLoading ? (
          <LoadingState />
        ) : threadsError ? (
          <LoadErrorState onRetry={loadThreads}>Couldn't load conversations — {threadsError}.</LoadErrorState>
        ) : threads.length === 0 ? (
          <EmptyState>No client conversations yet. They'll appear here as clients message the SecureWatch app.</EmptyState>
        ) : (
          <ul className="msg-thread-list">
            {threads.map(t => (
              <li
                key={t.clientId}
                className={'msg-thread-row' + (t.clientId === selectedId ? ' msg-thread-row--active' : '')}
                onClick={() => selectThread(t.clientId)}
              >
                <div className="msg-thread-row__top">
                  <span className="msg-thread-row__name">{t.clientName}</span>
                  {t.chatMode === 'human' && <span className="badge badge--warning">Needs a rep</span>}
                  {t.unreadCount > 0 && <span className="msg-unread-dot" aria-label={`${t.unreadCount} unread`} />}
                </div>
                <div className="msg-thread-row__preview">{t.lastText}</div>
                <div className="msg-thread-row__time">{formatTime(t.lastAt)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="drawer msg-thread-panel">
        {!selectedId ? (
          <EmptyState>Select a conversation on the left to view and reply.</EmptyState>
        ) : threadLoading ? (
          <LoadingState />
        ) : threadError ? (
          <LoadErrorState onRetry={() => loadThread(selectedId)}>Couldn't load this conversation — {threadError}.</LoadErrorState>
        ) : (
          <>
            <div className="msg-thread-panel__head">
              <div className="drawer-title">{threads.find(t => t.clientId === selectedId)?.clientName}</div>
              {chatMode === 'human' && (
                <button className="btn btn-ghost" disabled={resolving} onClick={resolveThread}>
                  {resolving ? <><i className="fas fa-spinner fa-spin" /> Resolving…</> : <><i className="fas fa-robot" /> Resolve → back to AI</>}
                </button>
              )}
            </div>
            <ActionErrorBanner onDismiss={() => setResolveError('')}>{resolveError}</ActionErrorBanner>

            <div className="msg-bubbles">
              {thread.map(m => {
                const label = SENDER_LABEL[m.sender]
                if (m.sender === 'system') {
                  return <div key={m._id} className="msg-system">{m.text}</div>
                }
                const isAdminSide = m.sender === 'admin' || m.sender === 'ai'
                return (
                  <div key={m._id} className={'msg-bubble-row' + (isAdminSide ? ' msg-bubble-row--admin' : '')}>
                    {label && <div className="msg-bubble__label">{label}</div>}
                    <div className={'msg-bubble' + (isAdminSide ? ' msg-bubble--admin' : ' msg-bubble--client')}>
                      {m.text}
                    </div>
                    <div className="msg-bubble__time">{formatTime(m.createdAt)}</div>
                  </div>
                )
              })}
            </div>

            <form className="msg-composer" onSubmit={sendReply}>
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Reply to this client…"
                disabled={sending}
              />
              <button className="btn btn-primary" type="submit" disabled={sending || !draft.trim()}>
                {sending ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-paper-plane" />}
              </button>
            </form>
            <ActionErrorBanner onDismiss={() => setSendError('')}>{sendError}</ActionErrorBanner>
          </>
        )}
      </div>
    </div>
  )
}
