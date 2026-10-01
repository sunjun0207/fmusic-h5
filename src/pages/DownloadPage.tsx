import { useState } from 'react'
import { requestDownload, trackExt, trackFilename } from '../lib/download'
import { getDownloads, removeDownload, saveDownloads, upsertDownload } from '../lib/storage'
import type { DownloadTask } from '../lib/types'

export function DownloadPage() {
  const [tasks, setTasks] = useState<DownloadTask[]>(() => getDownloads())
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState('')

  const refresh = () => setTasks(getDownloads())

  const saveTask = async (task: DownloadTask) => {
    if (!task.url || savingId) return
    setSavingId(task.id)
    setSaveError('')
    try {
      const filename = trackFilename(task.title, task.artist, trackExt(task.quality))
      const mode = await requestDownload(task.url, filename)
      if (mode === 'started') {
        upsertDownload({ ...task, status: 'opened' })
        refresh()
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '下载失败')
    } finally {
      setSavingId(null)
    }
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

      {saveError ? <div className="empty">{saveError}</div> : null}

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
              <button type="button" className="btn primary" onClick={() => void saveTask(t)} disabled={!t.url || savingId === t.id}>
                {savingId === t.id ? '准备中' : '下载'}
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
