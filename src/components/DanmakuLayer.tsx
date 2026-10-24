import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { SongComment } from '../lib/types'

type Fly = {
  id: string
  text: string
  lane: number
  duration: number
  travel: number
  tone: number
}

const LANES = 2
const SPEED = 26
const LANE_GAP = 72

function linesOf(comments: SongComment[]): string[] {
  const seen = new Set<string>()
  const lines: string[] = []
  for (const comment of comments) {
    const text = comment.text.replace(/\s+/g, ' ').trim().slice(0, 36)
    if (text.length < 2 || seen.has(text)) continue
    seen.add(text)
    lines.push(text)
  }
  return lines
}

export function DanmakuLayer({
  comments,
  enabled,
  style,
}: {
  comments: SongComment[]
  enabled: boolean
  style?: CSSProperties
}) {
  const [flying, setFlying] = useState<Fly[]>([])
  const layerRef = useRef<HTMLDivElement>(null)
  const textsRef = useRef<string[]>([])
  const signature = comments.map((item) => item.id).join('|')
  textsRef.current = linesOf(comments)
  const hasText = textsRef.current.length > 0

  useEffect(() => {
    if (!enabled || textsRef.current.length === 0) {
      setFlying([])
      return
    }
    const timers = new Set<number>()
    const laneFreeAt = [0, 0]
    let index = 0
    let alive = true
    const push = () => {
      if (!alive) return
      const texts = textsRef.current
      if (texts.length === 0) return
      const now = performance.now()
      let lane = 0
      for (let i = 1; i < LANES; i += 1) {
        if (laneFreeAt[i] < laneFreeAt[lane]) lane = i
      }
      if (laneFreeAt[lane] > now) return
      const text = texts[index % texts.length] || ''
      index += 1
      const box = layerRef.current?.clientWidth || 320
      const textWidth = Math.max(64, text.length * 17)
      const travel = box + textWidth + 28
      const duration = travel / SPEED
      laneFreeAt[lane] = now + ((textWidth + LANE_GAP) / SPEED) * 1000
      const id = `${index}-${lane}-${text.slice(0, 8)}`
      setFlying((list) => [...list, { id, text, lane, duration, travel, tone: index % 4 }].slice(-8))
      const timer = window.setTimeout(() => {
        timers.delete(timer)
        setFlying((list) => list.filter((item) => item.id !== id))
      }, duration * 1000 + 400)
      timers.add(timer)
    }
    push()
    const interval = window.setInterval(push, 1000)
    return () => {
      alive = false
      window.clearInterval(interval)
      timers.forEach((timer) => window.clearTimeout(timer))
      setFlying([])
    }
  }, [enabled, signature])

  if (!enabled || !hasText) return null

  return (
    <div ref={layerRef} className="danmaku-layer" style={style} aria-hidden="true">
      {flying.map((item) => (
        <span
          key={item.id}
          className={`danmaku-item tone-${item.tone}`}
          style={{
            top: `${2 + item.lane * 26}px`,
            animationDuration: `${item.duration}s`,
            ['--travel' as string]: `${item.travel}px`,
          }}
        >
          {item.text}
        </span>
      ))}
    </div>
  )
}
