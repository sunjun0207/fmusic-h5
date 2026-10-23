import { useLayoutEffect, useRef } from 'react'
import type { LyricLine } from '../lib/types'

type Props = {
  lines: LyricLine[]
  status: 'loading' | 'ready' | 'empty'
  current: number
  onSeek: (time: number) => void
}

function scrollLine(root: HTMLElement, index: number, smooth: boolean) {
  const el = root.querySelector<HTMLElement>(`[data-i="${index}"]`)
  if (!el) return
  const top = el.offsetTop - root.clientHeight / 2 + el.offsetHeight / 2
  root.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' })
}

export function LyricView({ lines, status, current, onSeek }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const userLockRef = useRef(false)
  const programmaticRef = useRef(false)
  const timerRef = useRef(0)
  const alignKeyRef = useRef('')
  const activeRef = useRef(-1)

  let activeIndex = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i]!.time <= current + 0.05) activeIndex = i
    else break
  }
  activeRef.current = activeIndex

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const next = `${Math.max(0, root.clientHeight / 2 - 22)}px`
    if (root.style.getPropertyValue('--lyric-pad') !== next) root.style.setProperty('--lyric-pad', next)
  }, [status, lines.length])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || userLockRef.current || activeIndex < 0) return
    const signature = `${lines.length}:${lines[0]?.time ?? ''}`
    const smooth = alignKeyRef.current === signature
    alignKeyRef.current = signature
    programmaticRef.current = true
    scrollLine(root, activeIndex, smooth)
    const timer = window.setTimeout(() => {
      programmaticRef.current = false
    }, smooth ? 520 : 0)
    return () => window.clearTimeout(timer)
  }, [activeIndex, lines])

  useLayoutEffect(() => {
    return () => window.clearTimeout(timerRef.current)
  }, [])

  return (
    <div className="lyric-view">
      <div
        className="lyric-list"
        ref={rootRef}
        onScroll={() => {
          if (programmaticRef.current) return
          userLockRef.current = true
          window.clearTimeout(timerRef.current)
          timerRef.current = window.setTimeout(() => {
            userLockRef.current = false
            const root = rootRef.current
            const index = activeRef.current
            if (!root || index < 0) return
            programmaticRef.current = true
            scrollLine(root, index, true)
            window.setTimeout(() => {
              programmaticRef.current = false
            }, 520)
          }, 2500)
        }}
      >
        <div className="lyric-pad" aria-hidden="true" />
        {status === 'loading' ? <p className="lyric-empty">正在加载歌词…</p> : null}
        {status === 'empty' ? <p className="lyric-empty">暂无歌词</p> : null}
        {status === 'ready'
          ? lines.map((line, index) => {
              const distance = activeIndex < 0 ? 3 : Math.abs(index - activeIndex)
              const role = distance === 0 ? ' active' : distance === 1 ? ' closer' : distance === 2 ? ' near' : ''
              return (
                <button
                  key={`${line.time}-${index}`}
                  type="button"
                  data-i={index}
                  className={`lyric-line${role}`}
                  onClick={() => onSeek(line.time)}
                >
                  {line.lineLyric}
                </button>
              )
            })
          : null}
        <div className="lyric-pad" aria-hidden="true" />
      </div>
    </div>
  )
}
