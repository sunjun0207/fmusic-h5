import type { ReactNode } from 'react'

type Props = {
  title?: string
  subtitle?: string
  showBack?: boolean
  onBack?: () => void
  right?: ReactNode
}

export function TopBar({ title = '聆听jun.sun', subtitle, showBack, onBack, right }: Props) {
  return (
    <header className="top-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {showBack && (
          <button type="button" className="icon-btn" onClick={onBack} aria-label="返回">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 5 8 12l7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <div style={{ minWidth: 0 }}>
          <div className="brand">{title}</div>
          {subtitle ? <div className="brand-sub">{subtitle}</div> : null}
        </div>
      </div>
      {right}
    </header>
  )
}
