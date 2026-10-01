import { useState } from 'react'
import { APP_VERSION } from '../lib/api'
import { getSettings, saveSettings } from '../lib/storage'
import type { AppSettings } from '../lib/types'
import { QUALITY_OPTIONS } from '../components/DownloadSheet'

export function SettingPage() {
  const [settings, setSettings] = useState<AppSettings>(() => getSettings())

  const patch = (p: Partial<AppSettings>) => {
    saveSettings(p)
    setSettings(getSettings())
  }

  return (
    <div>
      <div className="section-title">播放与下载</div>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <div>默认音质</div>
            <div className="song-sub">用于播放与下载选择</div>
          </div>
          <select
            value={settings.quality}
            onChange={(e) => patch({ quality: e.target.value })}
          >
            {QUALITY_OPTIONS.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
          </select>
        </div>
        <div className="setting-row">
          <div>
            <div>公告提醒</div>
            <div className="song-sub">本地开关，关闭后不再弹出公告</div>
          </div>
          <button
            type="button"
            className={`toggle${settings.showNotification ? ' on' : ''}`}
            aria-pressed={settings.showNotification}
            onClick={() => patch({ showNotification: !settings.showNotification })}
          />
        </div>
      </div>

      <div className="section-title">关于</div>
      <div className="setting-group">
        <div className="setting-row">
          <div>名称</div>
          <div className="song-sub">聆听jun.sun</div>
        </div>
        <div className="setting-row">
          <div>版本</div>
          <div className="song-sub">{APP_VERSION} H5</div>
        </div>
        <div className="setting-row">
          <div>联系邮箱</div>
          <a href="mailto:sunjun0207@163.com" className="song-sub">
            sunjun0207@163.com
          </a>
        </div>
        <div className="setting-row">
          <div>说明</div>
          <div className="song-sub" style={{ maxWidth: '58%', textAlign: 'right' }}>
            搜歌/歌词/播放直连酷我；版本与公告走自有 API
          </div>
        </div>
      </div>
    </div>
  )
}
