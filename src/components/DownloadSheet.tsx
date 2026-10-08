import { catalogSize } from '../lib/download'
import type { QualityOption } from '../lib/types'

export const QUALITY_OPTIONS: QualityOption[] = [
  { id: '128kmp3', label: '标准 128K', format: 'mp3', br: '128kmp3' },
  { id: '320kmp3', label: '高品 320K', format: 'mp3', br: '320kmp3' },
  { id: 'flac', label: '无损 FLAC', format: 'flac|mp3', br: 'flac' },
]

type Props = {
  open: boolean
  defaultQuality: string
  fileInfo?: string
  loading?: boolean
  onClose: () => void
  onPick: (option: QualityOption) => void
}

export function DownloadSheet({ open, defaultQuality, fileInfo, loading, onClose, onPick }: Props) {
  if (!open) return null
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="选择音质" onClick={(e) => e.stopPropagation()}>
        <h3>选择下载音质</h3>
        <p>文件会保存为「歌名-歌手.mp3」。微信内需要点右上角，选择在浏览器中打开后再保存。</p>
        {QUALITY_OPTIONS.map((q) => (
          <button
            key={q.id}
            type="button"
            className="quality-option"
            disabled={loading}
            onClick={() => onPick(q)}
          >
            <span>{q.label}</span>
            <span className="badge">
              {[q.id === defaultQuality ? '默认' : '', catalogSize(fileInfo, q.id)]
                .filter(Boolean)
                .join(' · ') || q.br}
            </span>
          </button>
        ))}
        <button type="button" className="btn ghost" style={{ width: '100%' }} onClick={onClose}>
          取消
        </button>
      </div>
    </div>
  )
}
