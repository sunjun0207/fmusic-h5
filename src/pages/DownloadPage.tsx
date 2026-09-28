import { useState } from 'react'
import { getDownloads, removeDownload, saveDownloads, upsertDownload } from '../lib/storage'
import type { DownloadTask } from '../lib/types'

export function DownloadPage() {
  const [tasks, setTasks] = useState<DownloadTask[]>(() => getDownloads())

  const refresh = () => setTasks(getDownloads())

  const openUrl = (task: DownloadTask) => {
    if (!task.url) return
    window.open(task.url, '_blank', 'noopener,noreferrer')
    upsertDownload({ ...task, status: 'opened' })
    refresh()
  }

  const markReady = (task: DownloadTask) => {
    upsertDownload({ ...task, status: 'ready' })
    refresh()
  }

  const clearAll = () => {
    saveDownloads([])
    refresh()
  }

  return (
    <div>
      <div className="section-title">
        下载列表
        {tasks.length ? (
          <button type="button" onClick={clearAll}>
            <span>清空</span>
          </button>
        ) : (
          <span>H5 本地记录</span>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="empty">还没有下载记录。在歌曲详情里选择音质即可添加。</div>
      ) : (
        tasks.map((t) => (
          <div key={t.id} className="download-item">
            <div>
              <div className="song-title">{t.title}</div>
              <div className="song-sub">
                {t.artist} · {t.quality}
              </div>
              <span className="badge">{t.status}</span>
            </div>
            <div className="download-actions">
              <button type="button" className="btn primary" onClick={() => openUrl(t)} disabled={!t.url}>
                打开
              </button>
              <button type="button" className="btn" onClick={() => markReady(t)}>
                已下载
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  removeDownload(t.id)
                  refresh()
                }}
              >
                删除
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
