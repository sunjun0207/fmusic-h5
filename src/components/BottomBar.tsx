import type { ReactNode } from 'react'
import type { TabId } from '../lib/types'
import { ChartIcon, ChatIcon, CompassIcon, HomeIcon, UserIcon } from './Icons'

const tabs: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: 'home', label: '首页', icon: <HomeIcon /> },
  { id: 'discover', label: '发现', icon: <CompassIcon /> },
  { id: 'charts', label: '排行榜', icon: <ChartIcon size={22} /> },
  { id: 'community', label: '社区', icon: <ChatIcon size={22} /> },
  { id: 'mine', label: '我的', icon: <UserIcon /> },
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
            aria-current={active === t.id ? 'page' : undefined}
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
