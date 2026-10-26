type Props = {
  text: string
  tone?: 'light' | 'dark'
  layout?: 'block' | 'inline'
  className?: string
}

export function Pending({ text, tone = 'light', layout = 'block', className = '' }: Props) {
  const dots = (
    <>
      <span />
      <span />
      <span />
    </>
  )
  return (
    <div className={`pending ${tone} ${layout} ${className}`.trim()} role="status">
      {layout === 'block' ? (
        <div className="pending-orb" aria-hidden>
          {dots}
        </div>
      ) : (
        <span className="pending-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
      )}
      <p>{text}</p>
    </div>
  )
}
