import { useEffect, useState } from 'react'
import { smallerImageUrl } from '../lib/api'

type Props = {
  src?: string
  alt?: string
  className?: string
  /** 图片全挂时显示的字，一般是歌名或歌单名的第一个字。 */
  label?: string
}

/** 大图 404 时逐档换小图，全挂了显示渐变占位。 */
export function Img({ src, alt = '', className = '', label }: Props) {
  const [current, setCurrent] = useState(src || '')
  const [failed, setFailed] = useState(!src)

  useEffect(() => {
    setCurrent(src || '')
    setFailed(!src)
  }, [src])

  if (failed || !current) {
    return (
      <span className={`img-ph ${className}`.trim()} aria-hidden={!alt} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
        {label ? <b>{label.trim().charAt(0)}</b> : null}
      </span>
    )
  }
  return (
    <img
      className={className}
      src={current}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => {
        const next = smallerImageUrl(current)
        if (next !== current) setCurrent(next)
        else setFailed(true)
      }}
    />
  )
}
