import { useEffect, useState } from 'react'
import { trackFilename } from '../lib/download'
import { imageProxyUrl } from '../lib/source'

export type PosterSlide = {
  src: string
  kind: string
}

type Props = {
  slides: PosterSlide[]
  index: number
  title: string
  artist: string
  onIndex: (index: number) => void
  onClose: () => void
}

function imageExt(type: string, url: string): string {
  const kind = type.toLowerCase()
  if (kind.includes('png')) return 'png'
  if (kind.includes('webp')) return 'webp'
  if (kind.includes('gif')) return 'gif'
  const matched = url.match(/\.([a-z0-9]{3,4})(?:$|\?)/i)?.[1]?.toLowerCase()
  if (matched === 'jpeg' || matched === 'jpg') return 'jpg'
  if (matched === 'png' || matched === 'webp' || matched === 'gif') return matched
  return 'jpg'
}

async function readImage(url: string): Promise<Response> {
  try {
    const direct = await fetch(url, { credentials: 'omit' })
    if (direct.ok) return direct
  } catch {
    /* 曲库图片没有跨域头时，再走本站 */
  }
  const proxied = imageProxyUrl(url)
  if (!proxied || proxied === url) throw new Error('图片保存失败')
  const res = await fetch(proxied)
  if (!res.ok) throw new Error('图片保存失败')
  return res
}

export function PosterPreview({ slides, index, title, artist, onIndex, onClose }: Props) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const slide = slides[index] ?? slides[0]
  const count = slides.length

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && count > 1) onIndex((index - 1 + count) % count)
      if (event.key === 'ArrowRight' && count > 1) onIndex((index + 1) % count)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [count, index, onClose, onIndex])

  if (!slide) return null

  const save = async () => {
    if (saving) return
    setSaving(true)
    setMessage('')
    try {
      const res = await readImage(slide.src)
      const type = res.headers.get('content-type') ?? ''
      if (type && !type.toLowerCase().startsWith('image/')) throw new Error('保存到的不是图片')
      const blob = await res.blob()
      const filename = trackFilename(title, artist, imageExt(type || blob.type, slide.src), slide.kind)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
      setMessage(`已开始保存 ${filename}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '图片保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="poster-preview" role="dialog" aria-modal="true" aria-label={`${title} 图片`}>
      <header className="poster-preview-bar">
        <button type="button" className="poster-preview-btn" onClick={onClose}>
          关闭
        </button>
        <div className="poster-preview-title">
          <strong>{title}</strong>
          <span>
            {artist}
            {slide.kind ? ` · ${slide.kind}` : ''}
          </span>
        </div>
        <button type="button" className="poster-preview-btn is-primary" onClick={() => void save()} disabled={saving}>
          {saving ? '保存中' : '保存'}
        </button>
      </header>
      <div className="poster-preview-stage">
        {count > 1 ? (
          <button
            type="button"
            className="poster-preview-step"
            aria-label="上一张"
            onClick={() => onIndex((index - 1 + count) % count)}
          >
            ‹
          </button>
        ) : null}
        <img src={slide.src} alt={`${title} ${slide.kind}`} />
        {count > 1 ? (
          <button
            type="button"
            className="poster-preview-step"
            aria-label="下一张"
            onClick={() => onIndex((index + 1) % count)}
          >
            ›
          </button>
        ) : null}
      </div>
      {count > 1 ? (
        <div className="poster-preview-dots">
          {slides.map((item, dot) => (
            <button
              key={item.src}
              type="button"
              className={dot === index ? 'is-on' : ''}
              aria-label={item.kind || `第 ${dot + 1} 张`}
              onClick={() => onIndex(dot)}
            />
          ))}
        </div>
      ) : null}
      {message ? <p className="poster-preview-note">{message}</p> : null}
    </div>
  )
}
