import { useEffect, useState } from 'react'
import { getSettings, saveSettings } from '../lib/storage'

const DANMAKU_EVENT = 'fmusic-danmaku'

export function useDanmakuSetting() {
  const [on, setOn] = useState(() => getSettings().showDanmaku)

  useEffect(() => {
    const sync = () => setOn(getSettings().showDanmaku)
    window.addEventListener(DANMAKU_EVENT, sync)
    return () => window.removeEventListener(DANMAKU_EVENT, sync)
  }, [])

  const set = (next: boolean) => {
    saveSettings({ showDanmaku: next })
    setOn(next)
    window.dispatchEvent(new Event(DANMAKU_EVENT))
  }

  return [on, set] as const
}

export function DanmakuSwitch({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  const [on, setOn] = useDanmakuSetting()
  return (
    <button
      type="button"
      className={`danmaku-switch${on ? ' is-on' : ''}${light ? ' is-light' : ''}${compact ? ' is-compact' : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={on ? '关闭弹幕' : '打开弹幕'}
      onClick={(event) => {
        event.stopPropagation()
        setOn(!on)
      }}
    >
      {compact ? null : <span>弹幕</span>}
      <span className="danmaku-switch-track" aria-hidden="true">
        <span className="danmaku-switch-thumb" />
      </span>
    </button>
  )
}
