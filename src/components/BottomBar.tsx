import type { ReactNode } from 'react'
import type { TabId } from '../lib/types'

const tabs: { id: TabId; label: string; icon: ReactNode }[] = [
  {
    id: 'home',
    label: '首页',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
      </svg>
    ),
  },
  {
    id: 'search',
    label: '搜索',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'favorite',
    label: '收藏',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'download',
    label: '下载',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 4v11" strokeLinecap="round" />
        <path d="m7.5 11.5 4.5 4.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 19h14" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'setting',
    label: '设置',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.5v2.2M12 18.3v2.2M4.9 7.2l1.9 1.1M17.2 15.7l1.9 1.1M3.5 12h2.2M18.3 12h2.2M4.9 16.8l1.9-1.1M17.2 8.3l1.9-1.1" strokeLinecap="round" />
      </svg>
    ),
  },
]

type Props = {
  active: TabId
  onChange: (tab: TabId) => void
}

export function BottomBar({ active, onChange }: Props) {
  return (
    <nav className="bottom-bar" aria-label="主导航">
      <div className="bottom-bar-inner">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`nav-item${active === t.id ? ' active' : ''}`}
            onClick={() => onChange(t.id)}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
