// Shared page-level states so every screen handles Loading / Error / Empty
// consistently (see CLAUDE.md "UX Rules"). Success is the content itself.

// 1–5s fetches get a plain spinner, no text.
export function LoadingState() {
  return (
    <div className="state-block state-block--loading" role="status" aria-label="Loading">
      <i className="fas fa-spinner fa-spin" />
    </div>
  )
}

// Load failure where the content would have been: what happened + a way forward.
export function LoadErrorState({ children, onRetry }) {
  return (
    <div className="state-block state-block--error">
      <i className="fas fa-triangle-exclamation" />
      <div>{children}</div>
      {onRetry && (
        <button className="btn btn-ghost" onClick={onRetry}>
          <i className="fas fa-rotate-right" /> Retry
        </button>
      )}
    </div>
  )
}

// Empty state: why it's empty + the action that fills it.
export function EmptyState({ children, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <div>{children}</div>
      {actionLabel && (
        <button className="btn btn-primary" style={{ marginTop: '0.85rem' }} onClick={onAction}>
          <i className="fas fa-plus" /> {actionLabel}
        </button>
      )}
    </div>
  )
}

// Dismissible banner for a failed inline action (status change, mark paid, …),
// rendered as close to the control that failed as the layout allows.
export function ActionErrorBanner({ children, onDismiss }) {
  if (!children) return null
  return (
    <div className="error-banner" style={{ marginBottom: '0.75rem' }}>
      <i className="fas fa-exclamation-circle" />
      <span style={{ flex: 1 }}>{children}</span>
      {onDismiss && (
        <button type="button" className="error-banner__dismiss" aria-label="Dismiss" onClick={onDismiss}>
          <i className="fas fa-times" />
        </button>
      )}
    </div>
  )
}

// Blocking confirm for destructive actions. Always offers a way out, keeps
// its own busy + error state so a failure surfaces inside the dialog.
export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', busy, error, onConfirm, onCancel, children }) {
  return (
    <div className="modal-overlay" onClick={busy ? undefined : onCancel}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>{message}</p>
        {children}
        {error && <div className="error-banner"><i className="fas fa-exclamation-circle" />{error}</div>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onConfirm}>
            {busy ? <><i className="fas fa-spinner fa-spin" /> Working…</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// Submit button that shows save progress and blocks double-submits.
// `disabled` is an optional extra gate (e.g. "nothing selected yet") on top
// of the save-in-progress one.
export function SaveButton({ saving, disabled, label = 'Save', savingLabel = 'Saving…' }) {
  return (
    <button type="submit" className="btn btn-primary" disabled={saving || disabled}>
      {saving ? <><i className="fas fa-spinner fa-spin" /> {savingLabel}</> : label}
    </button>
  )
}
