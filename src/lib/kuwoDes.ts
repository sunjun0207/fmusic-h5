/*
  Browser port of KuwoDES (SoftEncryption).
  Thanks to
  https://github.com/XuShaohua/kwplayer/blob/master/kuwo/DES.py
  https://github.com/Levi233/MusicPlayer/blob/master/app/src/main/java/com/chenhao/musicplayer/utils/crypt/KuwoDES.java
*/

type LongLike = {
  low: number
  valueOf: () => bigint
  toString: () => string
  not: () => LongLike
  isNegative: () => boolean
  or: (x: LongLike | number | bigint) => LongLike
  and: (x: LongLike | number | bigint) => LongLike
  xor: (x: LongLike | number | bigint) => LongLike
  equals: (x: LongLike | number | bigint) => boolean
  multiply: (x: LongLike | number | bigint) => LongLike
  shiftLeft: (x: number) => LongLike
  shiftRight: (x: number) => LongLike
}

const toBig = (x: LongLike | number | bigint): bigint => {
  if (typeof x === 'bigint') return x
  if (typeof x === 'number') return BigInt(x)
  return x.valueOf()
}

const Long = (n: number | bigint | LongLike): LongLike => {
  const v = typeof n === 'object' && n !== null && 'valueOf' in n ? n.valueOf() : BigInt(n as number | bigint)
  return {
    low: Number(v),
    valueOf: () => v,
    toString: () => v.toString(),
    not: () => Long(~v),
    isNegative: () => v < 0n,
    or: (x) => Long(v | toBig(x)),
    and: (x) => Long(v & toBig(x)),
    xor: (x) => Long(v ^ toBig(x)),
    equals: (x) => v === toBig(x),
    multiply: (x) => Long(v * toBig(x)),
    shiftLeft: (x) => Long(v << BigInt(x)),
    shiftRight: (x) => Long(v >> BigInt(x)),
  }
}

const range = (n: number) => Array.from(new Array(n).keys())
const power = (base: number, index: number) =>
  Array(index)
    .fill(0)
    .reduce((result: LongLike) => result.multiply(base), Long(1))
const LongArray = (...array: number[]) => array.map((n) => (n === -1 ? Long(-1n) : Long(n)))

const arrayE = LongArray(
  31, 0, 1, 2, 3, 4, -1, -1, 3, 4, 5, 6, 7, 8, -1, -1, 7, 8, 9, 10, 11, 12, -1, -1, 11, 12, 13, 14, 15, 16, -1, -1, 15,
  16, 17, 18, 19, 20, -1, -1, 19, 20, 21, 22, 23, 24, -1, -1, 23, 24, 25, 26, 27, 28, -1, -1, 27, 28, 29, 30, 31, 30, -1,
  -1,
)

const arrayIP = LongArray(
  57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3, 61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15,
  7, 56, 48, 40, 32, 24, 16, 8, 0, 58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4, 62, 54, 46, 38, 30, 22, 14,
  6,
)

const arrayIP_1 = LongArray(
  39, 7, 47, 15, 55, 23, 63, 31, 38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29, 36, 4, 44, 12, 52, 20, 60,
  28, 35, 3, 43, 11, 51, 19, 59, 27, 34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25, 32, 0, 40, 8, 48, 16, 56,
  24,
)

const arrayLs = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1]
const arrayLsMask = LongArray(0, 0x100001, 0x300003)
const arrayMask = range(64).map((n) => power(2, n))
arrayMask[arrayMask.length - 1] = arrayMask[arrayMask.length - 1].multiply(-1)

const arrayP = LongArray(
  15, 6, 19, 20, 28, 11, 27, 16, 0, 14, 22, 25, 4, 17, 30, 9, 1, 7, 23, 13, 31, 26, 2, 8, 18, 12, 29, 5, 21, 10, 3, 24,
)

const arrayPC_1 = LongArray(
  56, 48, 40, 32, 24, 16, 8, 0, 57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43, 35, 62, 54, 46,
  38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 60, 52, 44, 36, 28, 20, 12, 4, 27, 19, 11, 3,
)

const arrayPC_2 = LongArray(
  13, 16, 10, 23, 0, 4, -1, -1, 2, 27, 14, 5, 20, 9, -1, -1, 22, 18, 11, 3, 25, 7, -1, -1, 15, 6, 26, 19, 12, 1, -1, -1,
  40, 51, 30, 36, 46, 54, -1, -1, 29, 39, 50, 44, 32, 47, -1, -1, 43, 48, 38, 55, 33, 52, -1, -1, 45, 41, 49, 35, 28, 31,
  -1, -1,
)

const matrixNSBox = [
  [
    14, 4, 3, 15, 2, 13, 5, 3, 13, 14, 6, 9, 11, 2, 0, 5, 4, 1, 10, 12, 15, 6, 9, 10, 1, 8, 12, 7, 8, 11, 7, 0, 0, 15, 10,
    5, 14, 4, 9, 10, 7, 8, 12, 3, 13, 1, 3, 6, 15, 12, 6, 11, 2, 9, 5, 0, 4, 2, 11, 14, 1, 7, 8, 13,
  ],
  [
    15, 0, 9, 5, 6, 10, 12, 9, 8, 7, 2, 12, 3, 13, 5, 2, 1, 14, 7, 8, 11, 4, 0, 3, 14, 11, 13, 6, 4, 1, 10, 15, 3, 13, 12,
    11, 15, 3, 6, 0, 4, 10, 1, 7, 8, 4, 11, 14, 13, 8, 0, 6, 2, 15, 9, 5, 7, 1, 10, 12, 14, 2, 5, 9,
  ],
  [
    10, 13, 1, 11, 6, 8, 11, 5, 9, 4, 12, 2, 15, 3, 2, 14, 0, 6, 13, 1, 3, 15, 4, 10, 14, 9, 7, 12, 5, 0, 8, 7, 13, 1, 2,
    4, 3, 6, 12, 11, 0, 13, 5, 14, 6, 8, 15, 2, 7, 10, 8, 15, 4, 9, 11, 5, 9, 0, 14, 3, 10, 7, 1, 12,
  ],
  [
    7, 10, 1, 15, 0, 12, 11, 5, 14, 9, 8, 3, 9, 7, 4, 8, 13, 6, 2, 1, 6, 11, 12, 2, 3, 0, 5, 14, 10, 13, 15, 4, 13, 3, 4,
    9, 6, 10, 1, 12, 11, 0, 2, 5, 0, 13, 14, 2, 8, 15, 7, 4, 15, 1, 10, 7, 5, 6, 12, 11, 3, 8, 9, 14,
  ],
  [
    2, 4, 8, 15, 7, 10, 13, 6, 4, 1, 3, 12, 11, 7, 14, 0, 12, 2, 5, 9, 10, 13, 0, 3, 1, 11, 15, 5, 6, 8, 9, 14, 14, 11, 5,
    6, 4, 1, 3, 10, 2, 12, 15, 0, 13, 2, 8, 5, 11, 8, 0, 15, 7, 14, 9, 4, 12, 7, 10, 9, 1, 13, 6, 3,
  ],
  [
    12, 9, 0, 7, 9, 2, 14, 1, 10, 15, 3, 4, 6, 12, 5, 11, 1, 14, 13, 0, 2, 8, 7, 13, 15, 5, 4, 10, 8, 3, 11, 6, 10, 4, 6,
    11, 7, 9, 0, 6, 4, 2, 13, 1, 9, 15, 3, 8, 15, 3, 1, 14, 12, 5, 11, 0, 2, 12, 14, 7, 5, 10, 8, 13,
  ],
  [
    4, 1, 3, 10, 15, 12, 5, 0, 2, 11, 9, 6, 8, 7, 6, 9, 11, 4, 12, 15, 0, 3, 10, 5, 14, 13, 7, 8, 13, 14, 1, 2, 13, 6, 14,
    9, 4, 1, 2, 14, 11, 13, 5, 0, 1, 10, 8, 3, 0, 11, 3, 5, 9, 4, 15, 2, 7, 8, 12, 15, 10, 7, 6, 12,
  ],
  [
    13, 7, 10, 0, 6, 9, 5, 15, 8, 4, 3, 10, 11, 14, 12, 5, 2, 11, 9, 6, 15, 12, 0, 3, 4, 1, 14, 13, 1, 2, 7, 8, 1, 2, 12,
    15, 10, 4, 0, 3, 13, 14, 6, 9, 7, 8, 9, 6, 15, 1, 5, 12, 3, 10, 14, 5, 8, 7, 11, 0, 4, 13, 2, 11,
  ],
]

const bitTransform = (arrInt: LongLike[], n: number, l: LongLike): LongLike => {
  let l2 = Long(0)
  range(n).forEach((i) => {
    if (arrInt[i].isNegative() || l.and(arrayMask[arrInt[i].low]).equals(0)) return
    l2 = l2.or(arrayMask[i])
  })
  return l2
}

const DES64 = (longs: LongLike[], l: LongLike): LongLike => {
  let out = bitTransform(arrayIP, 64, l)
  const pSource: LongLike[] = [out.and(0xffffffff), out.and(-4294967296).shiftRight(32)]

  range(16).forEach((i) => {
    let R = Long(pSource[1])
    R = bitTransform(arrayE, 64, R)
    R = R.xor(longs[i])
    const pR = range(8).map((j) => R.shiftRight(j * 8).and(255))
    let SOut = Long(0)
    range(8)
      .reverse()
      .forEach((sbi) => {
        SOut = SOut.shiftLeft(4).or(matrixNSBox[sbi][pR[sbi].low])
      })
    R = bitTransform(arrayP, 32, SOut)
    const L = Long(pSource[0])
    pSource[0] = Long(pSource[1])
    pSource[1] = L.xor(R)
  })
  pSource.reverse()
  out = pSource[1].shiftLeft(32).and(-4294967296).or(pSource[0].and(0xffffffff))
  out = bitTransform(arrayIP_1, 64, out)
  return out
}

const subKeys = (l: LongLike, longs: LongLike[], n: number) => {
  let l2 = bitTransform(arrayPC_1, 56, l)
  range(16).forEach((i) => {
    l2 = l2
      .and(arrayLsMask[arrayLs[i]])
      .shiftLeft(28 - arrayLs[i])
      .or(l2.and(arrayLsMask[arrayLs[i]].not()).shiftRight(arrayLs[i]))
    longs[i] = bitTransform(arrayPC_2, 64, l2)
  })
  if (n === 1) {
    range(8).forEach((j) => {
      ;[longs[j], longs[15 - j]] = [longs[15 - j], longs[j]]
    })
  }
}

const crypt = (msg: Uint8Array, key: Uint8Array, mode: number): Uint8Array => {
  let l = Long(0)
  range(8).forEach((i) => {
    l = Long(key[i]).shiftLeft(i * 8).or(l)
  })

  const j = Math.floor(msg.length / 8)
  const arrLong1 = range(16).map(() => Long(0))
  subKeys(l, arrLong1, mode)

  const arrLong2 = range(j).map(() => Long(0))
  range(j).forEach((m) => {
    range(8).forEach((n) => {
      arrLong2[m] = Long(msg[n + m * 8])
        .shiftLeft(n * 8)
        .or(arrLong2[m])
    })
  })

  const arrLong3 = range(Math.floor((1 + 8 * (j + 1)) / 8)).map(() => Long(0))
  range(j).forEach((i1) => {
    arrLong3[i1] = DES64(arrLong1, arrLong2[i1])
  })

  const arrByte1 = msg.slice(j * 8)
  let l2 = Long(0)
  range(msg.length % 8).forEach((i1) => {
    l2 = Long(arrByte1[i1]).shiftLeft(i1 * 8).or(l2)
  })

  if (arrByte1.length || mode === 0) arrLong3[j] = DES64(arrLong1, l2)

  const arrByte2 = new Uint8Array(8 * arrLong3.length)
  let i4 = 0
  arrLong3.forEach((l3) => {
    range(8).forEach((i6) => {
      arrByte2[i4] = l3.shiftRight(i6 * 8).and(255).low
      i4 += 1
    })
  })
  return arrByte2
}

const SECRET_KEY = new TextEncoder().encode('ylzsxkwm')

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

export const encrypt = (msg: Uint8Array): Uint8Array => crypt(msg, SECRET_KEY, 0)

export const encryptQuery = (query: string): string => {
  const bytes = new TextEncoder().encode(query)
  return bytesToBase64(encrypt(bytes))
}

export const buildPlain = (rid: string, format = 'mp3', br?: string): string => {
  const base = `user=0&corp=kuwo&source=kwplayer_ar_5.1.0.0_B_jiakong_vh.apk&p2p=1&type=convert_url2&sig=0&format=${format}&rid=${rid}`
  return br ? `${base}&br=${br}` : base
}

export const buildNmobiPath = (rid: string, format = 'mp3', br = '320kmp3'): string => {
  const q = encryptQuery(buildPlain(rid, format, br || undefined))
  return `/proxy/kw-nmobi/mobi.s?f=kuwo&q=${encodeURIComponent(q)}`
}
