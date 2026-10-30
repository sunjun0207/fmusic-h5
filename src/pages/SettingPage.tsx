import { useState } from 'react'
import { Logo } from '../components/Logo'
import { APP_VERSION } from '../lib/api'
import { BRAND, KEYWORDS, STORY } from '../lib/brand'
import { getSettings, saveSettings } from '../lib/storage'
import type { AppSettings } from '../lib/types'
import { QUALITY_OPTIONS } from '../components/DownloadSheet'
import { MV_QUALITIES, POSTER_OPTIONS } from '../lib/quality'

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
            <div>海报清晰度</div>
            <div className="song-sub">歌曲详情里的封面和歌手图</div>
          </div>
          <select
            value={String(settings.posterSize)}
            onChange={(e) => patch({ posterSize: Number(e.target.value) })}
          >
            {POSTER_OPTIONS.map((item) => (
              <option key={item.size} value={item.size}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="setting-row">
          <div>
            <div>MV 清晰度</div>
            <div className="song-sub">播放 MV 时的清晰度，也可在播放器里改</div>
          </div>
          <select
            value={settings.mvQuality}
            onChange={(e) => patch({ mvQuality: e.target.value })}
          >
            {MV_QUALITIES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="section-title">关于</div>
      <section className="about-brand">
        <Logo size="lg" />
        <p className="about-motto">{BRAND.motto}</p>
        <p className="about-tagline">{BRAND.tagline}</p>
        <p className="about-intro">{BRAND.intro}</p>
        <ul className="about-keywords">
          {KEYWORDS.map((item) => (
            <li key={item.title}>
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </section>
      <div className="setting-group">
        <div className="setting-row">
          <div>名称</div>
          <div className="song-sub">
            {BRAND.name} {BRAND.en}
          </div>
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
              {STORY.lines.join('')}
              {STORY.sign}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
