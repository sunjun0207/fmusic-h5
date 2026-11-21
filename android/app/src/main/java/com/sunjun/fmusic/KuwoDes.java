package com.sunjun.fmusic;

/** 酷我播放地址的请求加密。后台切歌时页面可能已经停住，所以在播放服务里直接算。 */
final class KuwoDes {

    private static final byte[] SECRET = "ylzsxkwm".getBytes();
    private static final long[] MASKS = new long[64];
    private static final int[] SHIFTS = { 1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1 };
    private static final long[] SHIFT_MASK = { 0L, 0x100001L, 0x300003L };

    private static final long[] E = {
        31, 0, 1, 2, 3, 4, -1, -1, 3, 4, 5, 6, 7, 8, -1, -1, 7, 8, 9, 10, 11, 12, -1, -1, 11, 12, 13, 14, 15, 16, -1, -1, 15,
        16, 17, 18, 19, 20, -1, -1, 19, 20, 21, 22, 23, 24, -1, -1, 23, 24, 25, 26, 27, 28, -1, -1, 27, 28, 29, 30, 31, 30, -1, -1,
    };
    private static final long[] IP = {
        57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3, 61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15,
        7, 56, 48, 40, 32, 24, 16, 8, 0, 58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4, 62, 54, 46, 38, 30, 22, 14, 6,
    };
    private static final long[] IP_1 = {
        39, 7, 47, 15, 55, 23, 63, 31, 38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29, 36, 4, 44, 12, 52, 20, 60,
        28, 35, 3, 43, 11, 51, 19, 59, 27, 34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25, 32, 0, 40, 8, 48, 16, 56, 24,
    };
    private static final long[] P = {
        15, 6, 19, 20, 28, 11, 27, 16, 0, 14, 22, 25, 4, 17, 30, 9, 1, 7, 23, 13, 31, 26, 2, 8, 18, 12, 29, 5, 21, 10, 3, 24,
    };
    private static final long[] PC_1 = {
        56, 48, 40, 32, 24, 16, 8, 0, 57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43, 35, 62, 54, 46,
        38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 60, 52, 44, 36, 28, 20, 12, 4, 27, 19, 11, 3,
    };
    private static final long[] PC_2 = {
        13, 16, 10, 23, 0, 4, -1, -1, 2, 27, 14, 5, 20, 9, -1, -1, 22, 18, 11, 3, 25, 7, -1, -1, 15, 6, 26, 19, 12, 1, -1, -1,
        40, 51, 30, 36, 46, 54, -1, -1, 29, 39, 50, 44, 32, 47, -1, -1, 43, 48, 38, 55, 33, 52, -1, -1, 45, 41, 49, 35, 28, 31, -1, -1,
    };
    private static final int[][] BOX = {
        {
            14, 4, 3, 15, 2, 13, 5, 3, 13, 14, 6, 9, 11, 2, 0, 5, 4, 1, 10, 12, 15, 6, 9, 10, 1, 8, 12, 7, 8, 11, 7, 0, 0, 15, 10,
            5, 14, 4, 9, 10, 7, 8, 12, 3, 13, 1, 3, 6, 15, 12, 6, 11, 2, 9, 5, 0, 4, 2, 11, 14, 1, 7, 8, 13,
        },
        {
            15, 0, 9, 5, 6, 10, 12, 9, 8, 7, 2, 12, 3, 13, 5, 2, 1, 14, 7, 8, 11, 4, 0, 3, 14, 11, 13, 6, 4, 1, 10, 15, 3, 13, 12,
            11, 15, 3, 6, 0, 4, 10, 1, 7, 8, 4, 11, 14, 13, 8, 0, 6, 2, 15, 9, 5, 7, 1, 10, 12, 14, 2, 5, 9,
        },
        {
            10, 13, 1, 11, 6, 8, 11, 5, 9, 4, 12, 2, 15, 3, 2, 14, 0, 6, 13, 1, 3, 15, 4, 10, 14, 9, 7, 12, 5, 0, 8, 7, 13, 1, 2,
            4, 3, 6, 12, 11, 0, 13, 5, 14, 6, 8, 15, 2, 7, 10, 8, 15, 4, 9, 11, 5, 9, 0, 14, 3, 10, 7, 1, 12,
        },
        {
            7, 10, 1, 15, 0, 12, 11, 5, 14, 9, 8, 3, 9, 7, 4, 8, 13, 6, 2, 1, 6, 11, 12, 2, 3, 0, 5, 14, 10, 13, 15, 4, 13, 3, 4,
            9, 6, 10, 1, 12, 11, 0, 2, 5, 0, 13, 14, 2, 8, 15, 7, 4, 15, 1, 10, 7, 5, 6, 12, 11, 3, 8, 9, 14,
        },
        {
            2, 4, 8, 15, 7, 10, 13, 6, 4, 1, 3, 12, 11, 7, 14, 0, 12, 2, 5, 9, 10, 13, 0, 3, 1, 11, 15, 5, 6, 8, 9, 14, 14, 11, 5,
            6, 4, 1, 3, 10, 2, 12, 15, 0, 13, 2, 8, 5, 11, 8, 0, 15, 7, 14, 9, 4, 12, 7, 10, 9, 1, 13, 6, 3,
        },
        {
            12, 9, 0, 7, 9, 2, 14, 1, 10, 15, 3, 4, 6, 12, 5, 11, 1, 14, 13, 0, 2, 8, 7, 13, 15, 5, 4, 10, 8, 3, 11, 6, 10, 4, 6,
            11, 7, 9, 0, 6, 4, 2, 13, 1, 9, 15, 3, 8, 15, 3, 1, 14, 12, 5, 11, 0, 2, 12, 14, 7, 5, 10, 8, 13,
        },
        {
            4, 1, 3, 10, 15, 12, 5, 0, 2, 11, 9, 6, 8, 7, 6, 9, 11, 4, 12, 15, 0, 3, 10, 5, 14, 13, 7, 8, 13, 14, 1, 2, 13, 6, 14,
            9, 4, 1, 2, 14, 11, 13, 5, 0, 1, 10, 8, 3, 0, 11, 3, 5, 9, 4, 15, 2, 7, 8, 12, 15, 10, 7, 6, 12,
        },
        {
            13, 7, 10, 0, 6, 9, 5, 15, 8, 4, 3, 10, 11, 14, 12, 5, 2, 11, 9, 6, 15, 12, 0, 3, 4, 1, 14, 13, 1, 2, 7, 8, 1, 2, 12,
            15, 10, 4, 0, 3, 13, 14, 6, 9, 7, 8, 9, 6, 15, 1, 5, 12, 3, 10, 14, 5, 8, 7, 11, 0, 4, 13, 2, 11,
        },
    };

    static {
        for (int i = 0; i < 64; i++) MASKS[i] = 1L << i;
    }

    private KuwoDes() {}

    static String encryptQuery(String query) {
        byte[] raw = crypt(query.getBytes(java.nio.charset.StandardCharsets.UTF_8), SECRET, 0);
        return base64(raw);
    }

    private static String base64(byte[] data) {
        char[] table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".toCharArray();
        StringBuilder out = new StringBuilder(((data.length + 2) / 3) * 4);
        int i = 0;
        while (i + 3 <= data.length) {
            int n = ((data[i] & 255) << 16) | ((data[i + 1] & 255) << 8) | (data[i + 2] & 255);
            out.append(table[(n >> 18) & 63]).append(table[(n >> 12) & 63]).append(table[(n >> 6) & 63]).append(table[n & 63]);
            i += 3;
        }
        if (i < data.length) {
            int rest = data.length - i;
            int n = (data[i] & 255) << 16;
            if (rest == 2) n |= (data[i + 1] & 255) << 8;
            out.append(table[(n >> 18) & 63]).append(table[(n >> 12) & 63]);
            out.append(rest == 2 ? table[(n >> 6) & 63] : '=');
            out.append('=');
        }
        return out.toString();
    }

    private static byte[] crypt(byte[] msg, byte[] key, int mode) {
        long l = 0;
        for (int i = 0; i < 8; i++) l |= (key[i] & 255L) << (i * 8);
        int blocks = msg.length / 8;
        long[] keys = new long[16];
        subKeys(l, keys, mode);
        long[] encoded = new long[blocks + 1];
        for (int m = 0; m < blocks; m++) {
            long block = 0;
            for (int n = 0; n < 8; n++) block |= (msg[n + m * 8] & 255L) << (n * 8);
            encoded[m] = des64(keys, block);
        }
        long tail = 0;
        int extra = msg.length % 8;
        for (int i = 0; i < extra; i++) tail |= (msg[blocks * 8 + i] & 255L) << (i * 8);
        if (extra > 0 || mode == 0) encoded[blocks] = des64(keys, tail);
        int count = extra > 0 || mode == 0 ? blocks + 1 : blocks;
        byte[] out = new byte[count * 8];
        int cursor = 0;
        for (int i = 0; i < count; i++) {
            for (int bit = 0; bit < 8; bit++) out[cursor++] = (byte) ((encoded[i] >>> (bit * 8)) & 255);
        }
        return out;
    }

    private static void subKeys(long value, long[] keys, int mode) {
        long state = bitTransform(PC_1, 56, value);
        for (int i = 0; i < 16; i++) {
            long mask = SHIFT_MASK[SHIFTS[i]];
            long moved = state & mask;
            state = (moved << (28 - SHIFTS[i])) | ((state & ~mask) >>> SHIFTS[i]);
            keys[i] = bitTransform(PC_2, 64, state);
        }
        if (mode == 1) {
            for (int j = 0; j < 8; j++) {
                long swap = keys[j];
                keys[j] = keys[15 - j];
                keys[15 - j] = swap;
            }
        }
    }

    private static long des64(long[] keys, long value) {
        long out = bitTransform(IP, 64, value);
        long[] pair = { out & 0xffffffffL, out >>> 32 };
        for (int i = 0; i < 16; i++) {
            long right = bitTransform(E, 64, pair[1]) ^ keys[i];
            int[] parts = new int[8];
            for (int j = 0; j < 8; j++) parts[j] = (int) ((right >>> (j * 8)) & 255);
            long box = 0;
            for (int s = 7; s >= 0; s--) box = (box << 4) | (BOX[s][parts[s]] & 15L);
            right = bitTransform(P, 32, box);
            long left = pair[0];
            pair[0] = pair[1];
            pair[1] = left ^ right;
        }
        long low = pair[1] & 0xffffffffL;
        long high = pair[0] & 0xffffffffL;
        out = (high << 32) | low;
        return bitTransform(IP_1, 64, out);
    }

    private static long bitTransform(long[] table, int n, long value) {
        long out = 0;
        for (int i = 0; i < n; i++) {
            long bit = table[i];
            if (bit < 0 || (value & MASKS[(int) bit]) == 0) continue;
            out |= MASKS[i];
        }
        return out;
    }
}
