export const BRAND = {
  name: '音浪',
  en: 'SOUNDWAVE',
  motto: '听见热爱 · 遇见共鸣',
  tagline: '让每一种情绪，都有专属 BGM。',
  intro: '一个发现好音乐、分享好心情、遇见同频灵魂的音乐世界。',
  pillars: 'DISCOVER · FEEL · SHARE',
  promise: '不止听见旋律，更要感受热爱。',
}

export const SLOGANS = [
  '音乐不设限，热爱正当时。',
  '总有一首歌，懂你的此刻。',
  '让好音乐，找到懂它的人。',
  '戴上耳机，世界都是你的。',
  '每一种心情，都值得被听见。',
  '不止是听歌，更是热爱生活。',
]

export const KEYWORDS = [
  { title: '年轻潮流', text: '新鲜、个性、时尚、有态度。' },
  { title: '情绪共鸣', text: '治愈、热爱、孤独、快乐、自由。' },
  { title: '音乐发现', text: '热门新歌、宝藏歌曲、小众音乐。' },
  { title: '音乐社交', text: '歌单分享、评论互动、音乐社区。' },
  { title: '沉浸体验', text: '高品质音乐、视觉享受、个性推荐。' },
]

export const HERO = {
  title: '让音乐，点亮每一个瞬间。',
  text: '发现好音乐，遇见好心情。在这里，找到属于你的声音，让每一次播放都成为一次新的心动。',
  play: '立即听歌',
  explore: '探索音乐',
}

type Copy = { title: string; en: string; desc: string }

export const SECTION: Record<
  'forYou' | 'hot' | 'fresh' | 'playlists' | 'charts' | 'private' | 'radio' | 'community' | 'picks' | 'artists',
  Copy
> = {
  forYou: { title: '为你推荐', en: 'FOR YOU', desc: '每一次打开，都有新的音乐惊喜。' },
  hot: { title: '全网热歌', en: 'HOT 100', desc: '正在流行的好声音，当然不能错过。' },
  fresh: { title: '每日新歌', en: 'NEW RELEASE', desc: '新鲜音乐准时上架，让耳朵保持新鲜感。' },
  playlists: { title: '宝藏歌单', en: 'PLAYLISTS', desc: '总有一些好音乐，值得被更多人听见。' },
  charts: { title: '热门排行榜', en: 'TOP CHARTS', desc: '大家都在听什么？一起感受当下音乐潮流。' },
  private: { title: '私人专属', en: 'ONLY FOR YOU', desc: '懂你的音乐品味，也懂你此刻的心情。' },
  radio: { title: '音乐电台', en: 'RADIO', desc: '给生活一点背景音乐，让平凡日子也有旋律。' },
  community: { title: '音乐社区', en: 'COMMUNITY', desc: '分享喜欢的歌，遇见同频的灵魂。' },
  picks: { title: '精选推荐', en: 'EDITOR PICKS', desc: '总有一首歌，懂你的此刻。' },
  artists: { title: '热门歌手', en: 'ARTISTS', desc: '让好音乐，找到懂它的人。' },
}

type PageCopy = Copy & { headline: string }

export const PAGE: Record<'discover' | 'daily' | 'charts' | 'radio' | 'community' | 'mine', PageCopy> = {
  discover: {
    title: '发现音乐',
    en: 'DISCOVER',
    headline: '下一首心动，可能就在这里。',
    desc: '探索未知旋律，发现不一样的音乐世界。',
  },
  daily: {
    title: '每日推荐',
    en: 'DAILY MIX',
    headline: '今天的心情，交给音乐来安排。',
    desc: '根据你的喜好，遇见专属于你的音乐惊喜。',
  },
  charts: {
    title: '排行榜',
    en: 'TOP CHARTS',
    headline: '此刻最热，听点不一样的。',
    desc: '热门歌曲实时发现，跟上音乐潮流。',
  },
  radio: {
    title: '音乐电台',
    en: 'RADIO',
    headline: '给情绪一个出口，给生活一点旋律。',
    desc: '从清晨到深夜，总有一段旋律陪伴你。',
  },
  community: {
    title: '音乐社区',
    en: 'COMMUNITY',
    headline: '因为一首歌，认识有趣的人。',
    desc: '分享你的音乐故事，遇见与你同频的灵魂。',
  },
  mine: {
    title: '我的音乐宇宙',
    en: 'MY UNIVERSE',
    headline: '每一种心情，都值得被听见。',
    desc: '收藏、歌单、最近播放和下载，都在这里。',
  },
}

export type PickSource = { kind: 'chart'; id: string } | { kind: 'keyword'; keyword: string }

export type Pick = Copy & { id: string; source: PickSource; tone: string }

export const PICKS: Pick[] = [
  { id: 'today', title: '今日必听', en: 'TODAY', desc: '精选好歌，为今天加一点旋律。', source: { kind: 'chart', id: '93' }, tone: 'violet' },
  { id: 'heal', title: '治愈时光', en: 'HEALING', desc: '累了就听听歌，让心情慢慢放晴。', source: { kind: 'keyword', keyword: '治愈歌单' }, tone: 'mint' },
  { id: 'live', title: '潮流现场', en: 'LIVE', desc: '热门节奏持续加载，释放你的音乐能量。', source: { kind: 'chart', id: '158' }, tone: 'pink' },
  { id: 'night', title: '深夜情绪', en: 'MIDNIGHT', desc: '当世界安静下来，让音乐替你表达。', source: { kind: 'keyword', keyword: '深夜' }, tone: 'blue' },
  { id: 'indie', title: '独立音乐', en: 'INDIE', desc: '发现不一样的声音，收藏属于你的宝藏。', source: { kind: 'keyword', keyword: '独立音乐' }, tone: 'amber' },
]

export type Station = Copy & { id: string; keyword: string; tone: string }

/** keyword 是搜歌单用的词：酷我优先返回同名的冷门歌单，这些词实测出来的都是高播放量歌单。 */
export const STATIONS: Station[] = [
  { id: 'morning', title: '清晨唤醒', en: 'MORNING', desc: '被旋律轻轻叫醒，元气满格。', keyword: '早晨', tone: 'amber' },
  { id: 'commute', title: '通勤路上', en: 'COMMUTE', desc: '戴上耳机，世界都是你的。', keyword: '通勤', tone: 'blue' },
  { id: 'focus', title: '专注时刻', en: 'FOCUS', desc: '关掉杂音，只留下专注。', keyword: '学习歌单', tone: 'mint' },
  { id: 'workout', title: '燃脂运动', en: 'WORKOUT', desc: '跟着节拍，再多坚持一分钟。', keyword: '运动', tone: 'pink' },
  { id: 'citywalk', title: '城市漫步', en: 'CITYWALK', desc: '慢一点走，听城市的呼吸。', keyword: '散步', tone: 'violet' },
  { id: 'night', title: '晚安电台', en: 'GOOD NIGHT', desc: '把今天的疲惫，交给温柔的旋律。', keyword: '助眠', tone: 'indigo' },
]

/** 按时段挑一个电台，私人专属和首页「此刻」都用它。 */
export function momentStation(date = new Date()): Station {
  const hour = date.getHours()
  const id =
    hour >= 5 && hour < 9
      ? 'morning'
      : hour >= 9 && hour < 12
        ? 'focus'
        : hour >= 12 && hour < 17
          ? 'citywalk'
          : hour >= 17 && hour < 20
            ? 'commute'
            : hour >= 20 && hour < 23
              ? 'workout'
              : 'night'
  return STATIONS.find((item) => item.id === id) ?? STATIONS[0]!
}

export function momentLabel(date = new Date()): string {
  const hour = date.getHours()
  if (hour >= 5 && hour < 9) return '清晨'
  if (hour >= 9 && hour < 12) return '上午'
  if (hour >= 12 && hour < 17) return '午后'
  if (hour >= 17 && hour < 20) return '傍晚'
  if (hour >= 20 && hour < 23) return '夜晚'
  return '深夜'
}

/** id 是搜歌单用的词，同 STATIONS.keyword：只搜「华语」会先出一堆同名的冷门歌单。 */
export const PLAYLIST_CATEGORIES = [
  { id: 'rcm', label: '推荐' },
  { id: '华语歌单', label: '华语' },
  { id: '欧美歌单', label: '欧美' },
  { id: '粤语歌单', label: '粤语' },
  { id: '日语歌单', label: '日语' },
  { id: '韩语歌单', label: '韩语' },
  { id: '流行热歌', label: '流行' },
  { id: '民谣歌单', label: '民谣' },
  { id: '摇滚歌单', label: '摇滚' },
  { id: '电子歌单', label: '电子' },
  { id: '说唱歌单', label: '说唱' },
  { id: 'R&B歌单', label: 'R&B' },
  { id: '古风歌单', label: '古风' },
  { id: '轻音乐放松', label: '轻音乐' },
  { id: '治愈歌单', label: '治愈' },
  { id: '伤感歌单', label: '伤感' },
  { id: '学习歌单', label: '学习' },
  { id: '运动', label: '运动' },
  { id: '助眠', label: '睡前' },
  { id: '通勤', label: '通勤' },
]

export const STORY = {
  title: '音乐，是生活的另一种表达。',
  lines: [
    '有人用音乐记录青春，有人用旋律治愈孤独，也有人在节奏中寻找自由。',
    '音浪希望成为你的音乐灵感空间，让每一份热爱都有回响，让每一次相遇都有声音。',
  ],
  sign: 'SOUNDWAVE · 让热爱持续发声。',
}

export const TEXT = {
  searchPlaceholder: '搜一首歌，遇见好心情',
  play: '播放这首歌',
  playAll: '播放全部',
  favorite: '收进我的音乐宇宙',
  favorited: '已收进我的音乐宇宙',
  unfavorited: '已从音乐宇宙移出',
  createPlaylist: '创建我的专属歌单',
  share: '把这份喜欢分享出去',
  emptyList: '这里还没有音乐，去收藏一些喜欢的歌吧',
  searchEmpty: '没找到这首歌，换个关键词试试？',
  loading: '正在为你寻找好声音……',
  playFailed: '音乐暂时走神了，请稍后再试',
  network: '网络开了个小差，稍后再来听吧',
  retry: '再试一次',
}

/** 把网络层的报错换成品牌口吻。断网、超时、JSONP 失败都算网络问题。 */
export function friendlyError(error: unknown, fallback: string = TEXT.network): string {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return TEXT.network
  if (error instanceof TypeError) return TEXT.network
  if (error instanceof Error && /请求失败|请求超时|Failed to fetch|NetworkError|Load failed/i.test(error.message)) {
    return TEXT.network
  }
  return fallback
}
