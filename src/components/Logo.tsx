import { BRAND } from '../lib/brand'

type Props = { playing?: boolean; size?: 'md' | 'lg' }

export function WaveMark({ playing = false, className = '' }: { playing?: boolean; className?: string }) {
  return (
    <span className={`wave-mark${playing ? ' is-playing' : ''} ${className}`.trim()} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}

export function Logo({ playing = false, size = 'md' }: Props) {
  return (
    <div className={`logo logo--${size}`} role="img" aria-label={BRAND.name}>
      <span className="logo-badge">
        <WaveMark playing={playing} />
      </span>
      <strong className="logo-word" aria-hidden="true">
        {BRAND.name}
      </strong>
    </div>
  )
}
