import { useEffect, useRef, useState, type ReactNode } from 'react'
import { coverUrl } from '../lib/api'
import { TEXT } from '../lib/brand'
import type { MusicItem, MyPlaylist } from '../lib/types'
import { CloseIcon, PlusIcon } from './Icons'
import { Img } from './Img'

export type MenuEntry = { key: string; icon: ReactNode; label: string; danger?: boolean; run: () => void }

type MenuProps = {
  item: MusicItem
  entries: MenuEntry[]
  onClose: () => void
}

/** 歌曲「更多」面板：下一首播放、收藏、加入歌单、评论、分享等。 */
export function SongMenu({ item, entries, onClose }: MenuProps) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet song-menu" role="dialog" aria-label={`${item.title} 的更多操作`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-song">
          <Img className="sheet-song-cover" src={coverUrl(item.image, 120)} label={item.title} />
          <div>
            <strong>{item.title}</strong>
            <span>
              {item.artist}
              {item.album ? ` · ${item.album}` : ''}
            </span>
          </div>
          <button type="button" className="round-btn" onClick={onClose} aria-label="关闭">
            <CloseIcon />
          </button>
        </div>
        <div className="menu-list">
          {entries.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={`menu-item${entry.danger ? ' is-danger' : ''}`}
              onClick={() => {
                onClose()
                entry.run()
              }}
            >
              <span className="menu-icon">{entry.icon}</span>
              {entry.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

type PickerProps = {
  item: MusicItem
  lists: MyPlaylist[]
  onPick: (list: MyPlaylist) => void
  onCreate: () => void
  onClose: () => void
}

export function PlaylistPicker({ item, lists, onPick, onCreate, onClose }: PickerProps) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet picker-sheet" role="dialog" aria-label="收藏到歌单" onClick={(e) => e.stopPropagation()}>
        <div className="queue-head">
          <h3>收藏到歌单</h3>
          <button type="button" className="round-btn" onClick={onClose} aria-label="关闭">
            <CloseIcon />
          </button>
        </div>
        <p className="sheet-note">「{item.title}」想放进哪张歌单？</p>
        <button type="button" className="picker-row picker-create" onClick={onCreate}>
          <span className="picker-cover is-new">
            <PlusIcon />
          </span>
          <span>
            <strong>{TEXT.createPlaylist}</strong>
            <em>新建后自动收进这首歌</em>
          </span>
        </button>
        <div className="picker-list">
          {lists.map((list) => {
            const has = list.songs.some((song) => song.id === item.id)
            const cover = list.songs.find((song) => song.image)?.image
            return (
              <button key={list.id} type="button" className="picker-row" disabled={has} onClick={() => onPick(list)}>
                <Img className="picker-cover" src={cover ? coverUrl(cover, 120) : undefined} label={list.name} />
                <span>
                  <strong>{list.name}</strong>
                  <em>{has ? '已在歌单里' : `${list.songs.length} 首`}</em>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

type PromptProps = {
  title: string
  placeholder?: string
  initial?: string
  confirm?: string
  onSubmit: (value: string) => void
  onClose: () => void
}

export function PromptDialog({ title, placeholder, initial = '', confirm = '确定', onSubmit, onClose }: PromptProps) {
  const [value, setValue] = useState(initial)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60)
    return () => window.clearTimeout(timer)
  }, [])

  const submit = () => {
    const clean = value.trim()
    if (!clean) return
    onSubmit(clean)
  }

  return (
    <div className="overlay center" onClick={onClose}>
      <form
        className="dialog prompt-dialog"
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <h3>{title}</h3>
        <input
          ref={inputRef}
          className="prompt-input"
          value={value}
          maxLength={40}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn primary" disabled={!value.trim()}>
            {confirm}
          </button>
        </div>
      </form>
    </div>
  )
}

type ConfirmProps = {
  title: string
  text: string
  confirm: string
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({ title, text, confirm, onConfirm, onClose }: ConfirmProps) {
  return (
    <div className="overlay center" onClick={onClose}>
      <div className="dialog" role="alertdialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{text}</p>
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              onClose()
              onConfirm()
            }}
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>
  )
}
