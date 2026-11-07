type NativeAudio = {
  play: (url: string, title: string, artist: string, cover: string) => void
  prepareNext: (url: string, title: string, artist: string, cover: string) => void
  preparePrev: (url: string, title: string, artist: string, cover: string) => void
  setMeta: (title: string, artist: string, cover: string) => void
  pause: () => void
  seek: (seconds: number) => void
  volume: (level: number) => void
  stop: () => void
}

export type NativeTrackInfo = {
  url: string
  title: string
  artist: string
  cover: string
}

const emptyTrack: NativeTrackInfo = { url: '', title: '', artist: '', cover: '' }
let pendingMeta: NativeTrackInfo = { ...emptyTrack }

type AudioEvent = {
  type: string
  position: number
  duration: number
  extra: string
}

function bridge(): NativeAudio | null {
  if (typeof window === 'undefined') return null
  const native = (window as Window & { FMusicAudio?: NativeAudio }).FMusicAudio
  if (!native || typeof native.play !== 'function' || typeof native.prepareNext !== 'function' || typeof native.preparePrev !== 'function') return null
  return native
}

export function hasNativeAudio(): boolean {
  return bridge() !== null
}

function sendTrack(kind: 'next' | 'prev', info: NativeTrackInfo | null) {
  const native = bridge()
  const track = info ?? emptyTrack
  if (kind === 'next') native?.prepareNext(track.url, track.title, track.artist, track.cover)
  else native?.preparePrev(track.url, track.title, track.artist, track.cover)
}

export function prepareNativeNext(info: NativeTrackInfo | null) {
  sendTrack('next', info)
}

export function prepareNativePrev(info: NativeTrackInfo | null) {
  sendTrack('prev', info)
}

export function noteNativeTrack(title: string, artist: string, cover = '') {
  pendingMeta = { url: '', title: title || '', artist: artist || '', cover: cover || '' }
  bridge()?.setMeta(pendingMeta.title, pendingMeta.artist, pendingMeta.cover)
}

class NativeSongPlayer extends EventTarget {
  preload = 'metadata'
  readyState = 0
  private attrSrc = ''
  private time = 0
  private length = 0
  private isPaused = true
  private isEnded = false
  private level = 1
  private isMuted = false
  private remote = false
  private pending: { resolve: () => void; reject: (error: Error) => void } | null = null
  private errorToken = 0

  constructor() {
    super()
    const previous = (window as Window & { __fmusicAudioEvent?: (type: string, position: number, duration: number, extra: string) => void })
      .__fmusicAudioEvent
    ;(window as Window & { __fmusicAudioEvent?: typeof previous }).__fmusicAudioEvent = (type, position, duration, extra) => {
      previous?.(type, position, duration, extra)
      this.onNative({ type, position, duration, extra })
    }
  }

  get src() {
    return this.attrSrc
  }

  set src(value: string) {
    this.attrSrc = value
  }

  get currentTime() {
    return this.time
  }

  set currentTime(value: number) {
    this.time = value
    if (!this.remote) bridge()?.seek(value)
  }

  get duration() {
    return this.length
  }

  get paused() {
    return this.isPaused
  }

  get ended() {
    return this.isEnded
  }

  get volume() {
    return this.level
  }

  set volume(value: number) {
    this.level = value
    this.pushVolume()
  }

  get muted() {
    return this.isMuted
  }

  set muted(value: boolean) {
    this.isMuted = value
    this.pushVolume()
  }

  getAttribute(name: string) {
    return name === 'src' ? this.attrSrc : null
  }

  removeAttribute(name: string) {
    if (name !== 'src') return
    this.attrSrc = ''
    this.isPaused = true
      this.pending?.reject(new DOMException('The operation was aborted.', 'AbortError'))
    this.pending = null
    bridge()?.stop()
  }

  load() {}

  play() {
    const url = this.attrSrc
    if (!url) return Promise.reject(new Error('没有播放地址'))
    this.errorToken += 1
    this.isPaused = false
    this.isEnded = false
    return new Promise<void>((resolve, reject) => {
      this.pending?.reject(new DOMException('The operation was aborted.', 'AbortError'))
      this.pending = { resolve, reject }
      bridge()?.play(url, pendingMeta.title, pendingMeta.artist, pendingMeta.cover)
    })
  }

  pause() {
    this.isPaused = true
    bridge()?.pause()
  }

  private pushVolume() {
    bridge()?.volume(this.isMuted ? 0 : this.level)
  }

  private emit(type: string) {
    this.dispatchEvent(new Event(type))
  }

  private onNative(event: AudioEvent) {
    if (event.type === 'time' || event.type === 'playing') {
      this.remote = true
      this.time = event.position
      if (event.duration > 0 && event.duration !== this.length) {
        this.length = event.duration
        this.readyState = Math.max(this.readyState, 1)
        this.emit('loadedmetadata')
        this.emit('durationchange')
      }
      this.remote = false
    }
    if (event.type === 'time') {
      this.emit('timeupdate')
      return
    }
    if (event.type === 'playing') {
      this.errorToken += 1
      this.isPaused = false
      this.isEnded = false
      this.readyState = 4
      this.pending?.resolve()
      this.pending = null
      this.emit('play')
      this.emit('playing')
      return
    }
    if (event.type === 'paused') {
      this.isPaused = true
      this.emit('pause')
      return
    }
    if (event.type === 'ended') {
      this.isPaused = true
      this.isEnded = true
      this.pending?.reject(new DOMException('The operation was aborted.', 'AbortError'))
      this.pending = null
      this.emit('pause')
      this.emit('ended')
      return
    }
    if (event.type === 'advanced') {
      this.errorToken += 1
      this.attrSrc = event.extra || this.attrSrc
      this.remote = true
      this.time = 0
      this.length = 0
      this.remote = false
      this.isPaused = false
      this.isEnded = false
      this.readyState = 1
      this.pending?.resolve()
      this.pending = null
      this.emit('durationchange')
      this.emit('play')
      this.emit('playing')
      window.dispatchEvent(new CustomEvent('fmusic-native-advanced', { detail: this.attrSrc }))
      return
    }
    if (event.type === 'command') {
      window.dispatchEvent(new CustomEvent('fmusic-native-command', { detail: event.extra || '' }))
      return
    }
    if (event.type === 'error') {
      const token = this.errorToken
      const extra = event.extra
      const failed = this.pending
      this.pending = null
      window.setTimeout(() => {
        if (token !== this.errorToken) {
          failed?.resolve()
          return
        }
        this.isPaused = true
        failed?.reject(new Error(extra || '播放失败'))
        this.emit('error')
      }, 700)
    }
  }
}

export function createSongPlayer(): HTMLAudioElement {
  if (!hasNativeAudio()) {
    const audio = new Audio()
    audio.preload = 'metadata'
    return audio
  }
  return new NativeSongPlayer() as unknown as HTMLAudioElement
}
