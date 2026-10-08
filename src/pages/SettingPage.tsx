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
        <div className="setting-row about-note-row">
          <div>
            <div>说明</div>
            <div className="about-note">
              这里是一处轻轻的听歌处。你可以寻一句歌词，或一个忽然想起的名字，让旋律在指尖慢慢展开。想再听一遍，就停在这一首；想一路听下去，就交给列表；也可以把顺序交给偶然。最近听过的歌会留下来，正在播放的名单也随时可以翻开。愿每一首都成为一段温柔的停留。
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
