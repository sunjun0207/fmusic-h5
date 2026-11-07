package com.sunjun.fmusic;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;

/** 后台播放，并在通知栏提供上一首、暂停、下一首、打开应用和关闭。 */
public class PlaybackService extends Service {

    static final String CHANNEL_ID = "fmusic-media";
    private static final int NOTICE_ID = 4108;
    private static final String ACTION_PREV = "com.sunjun.fmusic.PREV";
    private static final String ACTION_TOGGLE = "com.sunjun.fmusic.TOGGLE";
    private static final String ACTION_NEXT = "com.sunjun.fmusic.NEXT";
    private static final String ACTION_CLOSE = "com.sunjun.fmusic.CLOSE";

    interface Sink {
        void onAudio(String type, double position, double duration, String extra);
    }

    static final class Track {
        final String url;
        final String title;
        final String artist;
        final String cover;

        Track(String url, String title, String artist, String cover) {
            this.url = url == null ? "" : url;
            this.title = title == null ? "" : title;
            this.artist = artist == null ? "" : artist;
            this.cover = cover == null ? "" : cover;
        }
    }

    private static PlaybackService instance;
    private static Sink sink;
    private static String pendingPlay = "";
    private static String pendingTitle = "";
    private static String pendingArtist = "";
    private static String pendingCover = "";
    private static Track pendingNext;
    private static Track pendingPrev;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private MediaPlayer player;
    private MediaSessionCompat session;
    private AudioManager audioManager;
    private AudioFocusRequest focusRequest;
    private String currentUrl = "";
    private Track nextTrack;
    private Track prevTrack;
    private String title = "碎冰音乐";
    private String artist = "正在播放";
    private String coverUrl = "";
    private Bitmap largeIcon;
    private int coverToken;
    private boolean completed;
    private boolean prepared;
    private boolean foreground;
    private boolean playingAudio;
    private boolean closing;
    private boolean allowResume;
    private String lastControl = "";
    private long lastControlAt;
    private final AudioManager.OnAudioFocusChangeListener focusListener = this::onFocus;

    static void setSink(Sink next) {
        sink = next;
    }

    static PlaybackService get() {
        return instance;
    }

    static void rememberMeta(String title, String artist, String cover) {
        pendingTitle = title == null ? "" : title;
        pendingArtist = artist == null ? "" : artist;
        pendingCover = cover == null ? "" : cover;
    }

    static void enqueuePlay(Context context, String url, String songTitle, String songArtist, String cover) {
        PlaybackService service = instance;
        if (service != null) {
            service.setMeta(songTitle, songArtist, cover);
            service.play(url);
            return;
        }
        pendingPlay = url == null ? "" : url;
        rememberMeta(songTitle, songArtist, cover);
        Intent intent = new Intent(context, PlaybackService.class);
        if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent);
        else context.startService(intent);
    }

    static void enqueueNext(String url, String songTitle, String songArtist, String cover) {
        Track track = trackOf(url, songTitle, songArtist, cover);
        PlaybackService service = instance;
        if (service != null) service.nextTrack = track;
        else pendingNext = track;
    }

    static void enqueuePrev(String url, String songTitle, String songArtist, String cover) {
        Track track = trackOf(url, songTitle, songArtist, cover);
        PlaybackService service = instance;
        if (service != null) service.prevTrack = track;
        else pendingPrev = track;
    }

    private static Track trackOf(String url, String songTitle, String songArtist, String cover) {
        if (!allowed(url)) return null;
        return new Track(url, songTitle, songArtist, cover);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        createChannel();
        session = new MediaSessionCompat(this, "fmusic");
        session.setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                if (acceptControl("toggle")) toggle();
            }

            @Override
            public void onPause() {
                if (acceptControl("toggle")) pause();
            }

            @Override
            public void onSkipToNext() {
                if (acceptControl("next")) skip(true);
            }

            @Override
            public void onSkipToPrevious() {
                if (acceptControl("prev")) skip(false);
            }

            @Override
            public void onStop() {
                if (acceptControl("close")) closeFromNotification();
            }

            @Override
            public void onSeekTo(long pos) {
                seek(pos / 1000d);
            }
        }, handler);
        session.setPlaybackToLocal(AudioManager.STREAM_MUSIC);
        session.setActive(true);
        if (!pendingTitle.isEmpty() || !pendingArtist.isEmpty() || !pendingCover.isEmpty()) {
            setMeta(pendingTitle, pendingArtist, pendingCover);
            pendingTitle = "";
            pendingArtist = "";
            pendingCover = "";
        }
        showForeground();
        if (!pendingPlay.isEmpty()) {
            String url = pendingPlay;
            pendingPlay = "";
            play(url);
        }
        if (pendingNext != null) {
            nextTrack = pendingNext;
            pendingNext = null;
        }
        if (pendingPrev != null) {
            prevTrack = pendingPrev;
            pendingPrev = null;
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_CLOSE.equals(action)) {
            if (acceptControl("close")) closeFromNotification();
            return START_NOT_STICKY;
        }
        if (ACTION_TOGGLE.equals(action)) {
            if (acceptControl("toggle")) toggle();
            return START_NOT_STICKY;
        }
        if (ACTION_NEXT.equals(action)) {
            if (acceptControl("next")) skip(true);
            return START_NOT_STICKY;
        }
        if (ACTION_PREV.equals(action)) {
            if (acceptControl("prev")) skip(false);
            return START_NOT_STICKY;
        }
        if (!foreground) showForeground();
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        closeFromNotification();
    }

    @Override
    public void onDestroy() {
        stopPlayback();
        if (session != null) {
            session.setActive(false);
            session.release();
            session = null;
        }
        if (instance == this) instance = null;
        super.onDestroy();
    }

    void play(String url) {
        if (!allowed(url)) {
            emit("error", 0, 0, "播放地址无效");
            return;
        }
        if (url.equals(currentUrl) && player != null && !completed) {
            if (!safePlaying()) resume();
            else emit("playing", position(), duration(), "");
            return;
        }
        nextTrack = null;
        prevTrack = null;
        completed = false;
        allowResume = true;
        currentUrl = url;
        open(url);
    }

    void setMeta(String nextTitle, String nextArtist, String nextCover) {
        if (nextTitle != null && !nextTitle.isEmpty()) title = nextTitle;
        if (nextArtist != null && !nextArtist.isEmpty()) artist = nextArtist;
        String next = nextCover == null ? "" : nextCover;
        if (!next.equals(coverUrl)) {
            coverUrl = next;
            loadCover(next);
        }
        if (foreground || player != null) showForeground();
    }

    void pause() {
        if (player == null) return;
        allowResume = false;
        handler.removeCallbacks(tick);
        playingAudio = false;
        if (safePlaying()) {
            try {
                player.pause();
            } catch (IllegalStateException ignored) {}
        }
        emit("paused", position(), duration(), "");
        showForeground();
    }

    void seek(double seconds) {
        if (player == null || completed) return;
        int ms = (int) Math.max(0, seconds * 1000);
        try {
            player.seekTo(ms);
        } catch (IllegalStateException ignored) {}
        showForeground();
    }

    void volume(double level) {
        if (player == null) return;
        float value = (float) Math.max(0, Math.min(1, level));
        try {
            player.setVolume(value, value);
        } catch (IllegalStateException ignored) {}
    }

    void stopPlayback() {
        boolean active = player != null || foreground || !currentUrl.isEmpty();
        handler.removeCallbacks(tick);
        currentUrl = "";
        nextTrack = null;
        prevTrack = null;
        completed = false;
        playingAudio = false;
        releasePlayer();
        abandonFocus();
        hideForeground();
        publishSession();
        if (active) emit("paused", 0, 0, "");
    }

    private void closeFromNotification() {
        if (closing) return;
        closing = true;
        stopPlayback();
        emit("command", 0, 0, "close");
        stopSelf();
    }

    private boolean acceptControl(String name) {
        long now = SystemClock.elapsedRealtime();
        if (name.equals(lastControl) && now - lastControlAt < 350) return false;
        lastControl = name;
        lastControlAt = now;
        return true;
    }

    private void toggle() {
        if (player == null || completed) {
            emit("command", 0, 0, "toggle");
            return;
        }
        if (safePlaying()) pause();
        else resume();
    }

    private void resume() {
        if (player == null || completed || !prepared) return;
        allowResume = true;
        requestFocus();
        try {
            player.start();
        } catch (IllegalStateException error) {
            return;
        }
        playingAudio = true;
        emit("playing", position(), duration(), "");
        watch();
        showForeground();
    }

    private void skip(boolean toNext) {
        Track track = toNext ? nextTrack : prevTrack;
        if (track == null || !allowed(track.url) || track.url.equals(currentUrl)) {
            emit("command", 0, 0, toNext ? "next" : "prev");
            return;
        }
        startQueued(track);
    }

    private void startQueued(Track track) {
        nextTrack = null;
        prevTrack = null;
        if (track.title != null && !track.title.isEmpty()) title = track.title;
        if (track.artist != null && !track.artist.isEmpty()) artist = track.artist;
        if (track.cover != null && !track.cover.equals(coverUrl)) {
            coverUrl = track.cover;
            loadCover(track.cover);
        }
        completed = false;
        allowResume = true;
        currentUrl = track.url;
        open(track.url);
        emit("advanced", 0, 0, track.url);
    }

    private void open(String url) {
        releasePlayer();
        prepared = false;
        requestFocus();
        showForeground();
        MediaPlayer next = new MediaPlayer();
        player = next;
        next.setAudioAttributes(
            new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()
        );
        next.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
        next.setOnPreparedListener(ready -> {
            if (player != next) return;
            prepared = true;
            ready.start();
            completed = false;
            playingAudio = true;
            emit("playing", 0, duration(), "");
            watch();
            showForeground();
        });
        next.setOnCompletionListener(done -> {
            if (player != next) return;
            completed = true;
            playingAudio = false;
            handler.removeCallbacks(tick);
            Track queued = nextTrack;
            if (queued != null && allowed(queued.url)) {
                startQueued(queued);
                return;
            }
            emit("ended", position(), duration(), "");
            showForeground();
        });
        next.setOnErrorListener((mp, what, extra) -> {
            if (player != next) return true;
            // 切歌重新申请音频焦点时，未准备好的播放器会被误启动，系统回报 -38，随后仍会正常开播。
            if (!prepared && (what == -38 || extra == -38)) return true;
            completed = true;
            prepared = false;
            playingAudio = false;
            handler.removeCallbacks(tick);
            emit("error", 0, 0, "播放失败");
            showForeground();
            return true;
        });
        try {
            next.setDataSource(url);
            next.prepareAsync();
        } catch (Exception error) {
            playingAudio = false;
            emit("error", 0, 0, "播放失败");
            showForeground();
        }
    }

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            if (player == null || completed || !safePlaying()) return;
            emit("time", position(), duration(), "");
            handler.postDelayed(this, 500);
        }
    };

    private void watch() {
        handler.removeCallbacks(tick);
        handler.post(tick);
    }

    private boolean safePlaying() {
        try {
            return player != null && player.isPlaying();
        } catch (IllegalStateException error) {
            return false;
        }
    }

    private double position() {
        try {
            return player == null ? 0 : player.getCurrentPosition() / 1000d;
        } catch (IllegalStateException error) {
            return 0;
        }
    }

    private double duration() {
        try {
            int ms = player == null ? 0 : player.getDuration();
            return ms > 0 ? ms / 1000d : 0;
        } catch (IllegalStateException error) {
            return 0;
        }
    }

    private void releasePlayer() {
        if (player == null) return;
        MediaPlayer old = player;
        player = null;
        prepared = false;
        try {
            old.setOnErrorListener(null);
            old.setOnPreparedListener(null);
            old.setOnCompletionListener(null);
            old.reset();
            old.release();
        } catch (Exception ignored) {}
    }

    private void requestFocus() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            if (focusRequest == null) {
                focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(
                        new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                            .build()
                    )
                    .setOnAudioFocusChangeListener(focusListener)
                    .build();
            }
            audioManager.requestAudioFocus(focusRequest);
            return;
        }
        audioManager.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
    }

    private void abandonFocus() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= 26 && focusRequest != null) audioManager.abandonAudioFocusRequest(focusRequest);
        else audioManager.abandonAudioFocus(focusListener);
    }

    private void onFocus(int change) {
        if (change == AudioManager.AUDIOFOCUS_LOSS) {
            pause();
            return;
        }
        if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
            if (player != null && safePlaying()) {
                try {
                    player.pause();
                } catch (IllegalStateException ignored) {}
            }
            playingAudio = false;
            allowResume = true;
            emit("paused", position(), duration(), "");
            showForeground();
            return;
        }
        if (change == AudioManager.AUDIOFOCUS_GAIN && allowResume && player != null && !completed && !safePlaying()) {
            resume();
        }
    }

    private void showForeground() {
        publishSession();
        int playIcon = playingAudio ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play;
        String playLabel = playingAudio ? "暂停" : "播放";
        Notification notice = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_music)
            .setLargeIcon(largeIcon)
            .setContentTitle(title)
            .setContentText(artist)
            .setSubText("碎冰音乐")
            .setContentIntent(openApp())
            .setDeleteIntent(actionIntent(ACTION_CLOSE, 4))
            .setOngoing(playingAudio)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setColor(0xFF1AA6A0)
            .addAction(new NotificationCompat.Action(android.R.drawable.ic_media_previous, "上一首", actionIntent(ACTION_PREV, 1)))
            .addAction(new NotificationCompat.Action(playIcon, playLabel, actionIntent(ACTION_TOGGLE, 2)))
            .addAction(new NotificationCompat.Action(android.R.drawable.ic_media_next, "下一首", actionIntent(ACTION_NEXT, 3)))
            .addAction(new NotificationCompat.Action(R.drawable.ic_stat_open, "打开", openApp()))
            .addAction(new NotificationCompat.Action(R.drawable.ic_stat_close, "关闭", actionIntent(ACTION_CLOSE, 5)))
            .setStyle(new MediaStyle()
                .setMediaSession(session == null ? null : session.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2))
            .build();
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTICE_ID, notice, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTICE_ID, notice);
        }
        foreground = true;
    }

    private void hideForeground() {
        if (!foreground) return;
        foreground = false;
        stopForeground(true);
    }

    private void publishSession() {
        if (session == null) return;
        int state = playingAudio
            ? PlaybackStateCompat.STATE_PLAYING
            : (currentUrl.isEmpty() ? PlaybackStateCompat.STATE_STOPPED : PlaybackStateCompat.STATE_PAUSED);
        session.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY
                    | PlaybackStateCompat.ACTION_PAUSE
                    | PlaybackStateCompat.ACTION_PLAY_PAUSE
                    | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
                    | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
                    | PlaybackStateCompat.ACTION_STOP
                    | PlaybackStateCompat.ACTION_SEEK_TO
            )
            .setState(state, (long) (position() * 1000), playingAudio ? 1f : 0f)
            .build());
        MediaMetadataCompat.Builder meta = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, (long) (duration() * 1000));
        if (largeIcon != null) meta.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, largeIcon);
        session.setMetadata(meta.build());
    }

    private void loadCover(String url) {
        int token = ++coverToken;
        if (url == null || url.isEmpty() || !url.startsWith("https://")) {
            largeIcon = null;
            if (foreground) showForeground();
            return;
        }
        new Thread(() -> {
            Bitmap bitmap = fetchBitmap(url);
            handler.post(() -> {
                if (token != coverToken) return;
                largeIcon = bitmap;
                if (foreground || player != null) showForeground();
            });
        }, "fmusic-cover").start();
    }

    private static Bitmap fetchBitmap(String url) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setInstanceFollowRedirects(true);
            conn.setRequestProperty("User-Agent", "Mozilla/5.0");
            if (conn.getResponseCode() >= 400) return null;
            try (InputStream in = conn.getInputStream()) {
                Bitmap raw = BitmapFactory.decodeStream(in);
                if (raw == null) return null;
                int max = 256;
                int width = raw.getWidth();
                int height = raw.getHeight();
                if (width <= max && height <= max) return raw;
                float scale = Math.min(max / (float) width, max / (float) height);
                return Bitmap.createScaledBitmap(raw, Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)), true);
            }
        } catch (Exception error) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private PendingIntent openApp() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(this, 6, intent, flags);
    }

    private PendingIntent actionIntent(String action, int request) {
        Intent intent = new Intent(this, PlaybackService.class);
        intent.setAction(action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getService(this, request, intent, flags);
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "正在播放", NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("歌曲播放和控制");
        channel.setSound(null, null);
        channel.enableVibration(false);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private void emit(String type, double position, double duration, String extra) {
        Sink current = sink;
        if (current != null) current.onAudio(type, position, duration, extra == null ? "" : extra);
    }

    static boolean allowed(String url) {
        if (url == null || url.isEmpty()) return false;
        Uri uri = Uri.parse(url);
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme())) return false;
        String host = uri.getHost();
        if (host == null) return false;
        host = host.toLowerCase(Locale.ROOT);
        return "kuwo.cn".equals(host) || host.endsWith(".kuwo.cn");
    }
}
