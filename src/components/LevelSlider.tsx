import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { getLevels, LEVELS_EVENT, saveLevels, type LevelScope, type PlaybackLevels } from '../lib/levels'

function clamp(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)))
}

export function usePlaybackLevels(scope: LevelScope) {
  const [levels, setLevels] = useState<PlaybackLevels>(() => getLevels(scope))

  useEffect(() => {
    const sync = (event: Event) => {
      const changed = event instanceof CustomEvent ? event.detail : undefined
      if (changed && changed !== scope) return
      setLevels(getLevels(scope))
    }
    window.addEventListener(LEVELS_EVENT, sync)
    return () => window.removeEventListener(LEVELS_EVENT, sync)
  }, [scope])

  return {
    volume: levels.volume,
    brightness: levels.brightness,
    setVolume: (volume: number) => saveLevels(scope, { volume }),
    setBrightness: (brightness: number) => saveLevels(scope, { brightness }),
  }
}

function VolumeIcon({ value }: { value: number }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4.5 10v4h3.1L12 18.2V5.8L7.6 10H4.5Z" strokeLinejoin="round" />
      {value === 0 ? <path d="M16 10.2 20 14.2M20 10.2 16 14.2" strokeLinecap="round" /> : null}
      {value > 0 ? <path d="M15.4 9.3a3.4 3.4 0 0 1 0 5.4" strokeLinecap="round" /> : null}
      {value > 45 ? <path d="M17.7 7.2a6.2 6.2 0 0 1 0 9.6" strokeLinecap="round" /> : null}
    </svg>
  )
}

function BrightnessIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="3.1" />
      <path
        d="M12 3.6v2.1M12 18.3v2.1M3.6 12h2.1M18.3 12h2.1M6.1 6.1l1.5 1.5M16.4 16.4l1.5 1.5M17.9 6.1l-1.5 1.5M7.6 16.4l-1.5 1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LevelSlider({
  label,
  value,
  icon,
  onChange,
}: {
  label: string
  value: number
  icon: ReactNode
  onChange: (value: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)

  const valueFromX = (clientX: number) => {
    const box = trackRef.current?.getBoundingClientRect()
    if (!box || box.width <= 18) return value
    const width = box.width - 18
    return clamp(((clientX - box.left - 9) / width) * 100)
  }

  const drag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    onChange(valueFromX(event.clientX))
  }

  return (
    <div className="level-slider">
      <span className="level-slider-icon">{icon}</span>
      <div
        ref={trackRef}
        className="level-slider-track"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        onPointerDown={(event) => {
          event.stopPropagation()
          event.currentTarget.setPointerCapture(event.pointerId)
          onChange(valueFromX(event.clientX))
        }}
        onPointerMove={drag}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault()
            onChange(clamp(value + 5))
          } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            event.preventDefault()
            onChange(clamp(value - 5))
          } else if (event.key === 'Home') {
            event.preventDefault()
            onChange(0)
          } else if (event.key === 'End') {
            event.preventDefault()
            onChange(100)
          }
        }}
      >
        <span className="level-slider-fill" style={{ width: `calc((100% - 18px) * ${value / 100})` }} />
        <span className="level-slider-thumb" style={{ left: `calc(9px + (100% - 18px) * ${value / 100})` }} />
      </div>
    </div>
  )
}

export function PlaybackLevels({ scope, tone = 'light' }: { scope: LevelScope; tone?: 'light' | 'dark' }) {
  const { volume, brightness, setVolume, setBrightness } = usePlaybackLevels(scope)
  return (
    <div className={`level-row${tone === 'dark' ? ' is-dark' : ''}`}>
      <LevelSlider label="音量" value={volume} icon={<VolumeIcon value={volume} />} onChange={setVolume} />
      <LevelSlider label="亮度" value={brightness} icon={<BrightnessIcon />} onChange={setBrightness} />
    </div>
  )
}
