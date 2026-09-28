import type { NotificationInfo, UpdateInfo } from '../lib/types'

type Props = {
  update: UpdateInfo | null
  notification: NotificationInfo | null
  onCloseUpdate: () => void
  onCloseNotification: (dismissForever: boolean) => void
}

export function Dialogs({ update, notification, onCloseUpdate, onCloseNotification }: Props) {
  if (!update && !notification) return null

  if (update) {
    return (
      <div className="overlay center">
        <div className="dialog" role="dialog" aria-labelledby="update-title">
          <h3 id="update-title">发现新版本 {update.version}</h3>
          <p>{update.content}</p>
          <div className="dialog-actions">
            <button type="button" className="btn ghost" onClick={onCloseUpdate}>
              稍后
            </button>
            <a className="btn primary" href={update.url || 'https://app.4848948.xyz/'} target="_blank" rel="noreferrer">
              去更新
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="overlay center">
      <div className="dialog" role="dialog" aria-labelledby="notice-title">
        <h3 id="notice-title">{notification!.title || '公告'}</h3>
        <p>{notification!.content}</p>
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={() => onCloseNotification(true)}>
            不在提醒
          </button>
          <button type="button" className="btn primary" onClick={() => onCloseNotification(false)}>
            知道了
          </button>
        </div>
      </div>
    </div>
  )
}
