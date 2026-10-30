import type { ReactNode } from 'react'
import { TEXT } from '../lib/brand'
import { BackIcon, ChevronIcon } from './Icons'
import { WaveMark } from './Logo'

type SectionProps = {
  title: string
  en?: string
  desc?: string
  more?: string
  onMore?: () => void
}

export function SectionHead({ title, en, desc, more = '更多', onMore }: SectionProps) {
  return (
    <div className="sec-head">
      <div className="sec-copy">
        <h2>
          {title}
          {en ? <em>{en}</em> : null}
        </h2>
        {desc ? <p>{desc}</p> : null}
      </div>
      {onMore ? (
        <button type="button" className="sec-more" onClick={onMore}>
          {more}
          <ChevronIcon size={12} />
        </button>
      ) : null}
    </div>
  )
}

type HeroProps = {
  title: string
  en: string
  headline: string
  desc: string
  children?: ReactNode
}

/** 一级页面顶部的标题区：中英文标题、一句主张、一句说明。 */
export function PageHero({ title, en, headline, desc, children }: HeroProps) {
  return (
    <section className="page-hero">
      <div className="page-hero-glow" aria-hidden="true" />
      <WaveMark className="page-hero-wave" playing />
      <p className="page-hero-tag">
        {title}
        <em>{en}</em>
      </p>
      <h1>{headline}</h1>
      <p className="page-hero-desc">{desc}</p>
      {children}
    </section>
  )
}

export function SubHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <header className="sub-header">
      <button type="button" className="round-btn" onClick={onBack} aria-label="返回">
        <BackIcon />
      </button>
      <strong>{title}</strong>
      <span className="sub-header-right">{right}</span>
    </header>
  )
}

export function Retry({ text = TEXT.network, onRetry }: { text?: string; onRetry?: () => void }) {
  return (
    <div className="retry" role="alert">
      <p>{text}</p>
      {onRetry ? (
        <button type="button" className="pill-btn ghost" onClick={onRetry}>
          {TEXT.retry}
        </button>
      ) : null}
    </div>
  )
}

export function Skeleton({ className }: { className: string }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />
}

export function SkeletonRows({ count = 5, cover = true }: { count?: number; cover?: boolean }) {
  return (
    <div className="skeleton-rows" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="skeleton-row">
          {cover ? <Skeleton className="sk-cover" /> : null}
          <div>
            <Skeleton className="sk-line" />
            <Skeleton className="sk-line short" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonTiles({ count = 6 }: { count?: number }) {
  return (
    <div className="tile-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="tile">
          <Skeleton className="sk-square" />
          <Skeleton className="sk-line" />
        </div>
      ))}
    </div>
  )
}

export function Empty({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <div className="empty-state">
      <WaveMark className="empty-wave" />
      <p>{text}</p>
      {action && onAction ? (
        <button type="button" className="pill-btn" onClick={onAction}>
          {action}
        </button>
      ) : null}
    </div>
  )
}
