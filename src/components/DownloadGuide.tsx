import { isWeChat, type PendingDownload } from '../lib/download'

type Props = {
  pending: PendingDownload | null
  saving: boolean
  error?: string
  onClose: () => void
  onSave: () => void
}

export function DownloadGuide({ pending, saving, error, onClose, onSave }: Props) {
  if (!pending) return null
  const wechat = isWeChat()
  return (
    <div className="overlay center" style={{ zIndex: 60 }}>
      <div className="dialog" role="dialog" aria-labelledby="dl-guide-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="dl-guide-title">{wechat ? '请用浏览器下载' : '保存歌曲'}</h3>
        <p>
          {wechat
            ? `微信里不能直接保存歌曲，继续下载会提示「可在浏览器打开此网页来下载文件」。请点右上角「···」，选择「在浏览器打开」，然后点「保存」。文件名是「${pending.filename}」。`
            : `将保存为「${pending.filename}」。`}
        </p>
        {error ? <p>{error}</p> : null}
        <div className="dialog-actions">
          {wechat ? (
            <button type="button" className="btn primary" onClick={onClose}>
              知道了
            </button>
          ) : (
            <>
              <button type="button" className="btn ghost" onClick={onClose} disabled={saving}>
                取消
              </button>
              <button type="button" className="btn primary" onClick={onSave} disabled={saving}>
                {saving ? '准备中…' : '保存'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
