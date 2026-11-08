package com.sunjun.fmusic;

import android.app.Activity;
import android.os.Build;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import org.json.JSONObject;

/** 把歌曲交给系统播放器，通知栏和后台切歌都走这里。 */
public class FMusicAudio {

    private final Activity activity;
    private final WebView webView;

    FMusicAudio(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        PlaybackService.setSink(this::emit);
    }

    @JavascriptInterface
    public void play(String url, String title, String artist, String cover) {
        activity.runOnUiThread(() -> PlaybackService.enqueuePlay(activity, url, title, artist, cover));
    }

    @JavascriptInterface
    public void prepareNext(String url, String title, String artist, String cover) {
        activity.runOnUiThread(() -> PlaybackService.enqueueNext(url, title, artist, cover));
    }

    @JavascriptInterface
    public void preparePrev(String url, String title, String artist, String cover) {
        activity.runOnUiThread(() -> PlaybackService.enqueuePrev(url, title, artist, cover));
    }

    @JavascriptInterface
    public void setMeta(String title, String artist, String cover) {
        activity.runOnUiThread(() -> {
            PlaybackService service = PlaybackService.get();
            if (service != null) service.setMeta(title, artist, cover);
            else PlaybackService.rememberMeta(title, artist, cover);
        });
    }

    @JavascriptInterface
    public void setFavorited(boolean on) {
        activity.runOnUiThread(() -> PlaybackService.rememberFavored(on));
    }

    @JavascriptInterface
    public void setLyrics(String payload) {
        activity.runOnUiThread(() -> PlaybackService.rememberLyrics(payload));
    }

    @JavascriptInterface
    public void setSong(String id) {
        activity.runOnUiThread(() -> PlaybackService.rememberSong(id));
    }

    @JavascriptInterface
    public void pause() {
        activity.runOnUiThread(() -> {
            PlaybackService service = PlaybackService.get();
            if (service != null) service.pause();
        });
    }

    @JavascriptInterface
    public void seek(double seconds) {
        activity.runOnUiThread(() -> {
            PlaybackService service = PlaybackService.get();
            if (service != null) service.seek(seconds);
        });
    }

    @JavascriptInterface
    public void volume(double level) {
        activity.runOnUiThread(() -> {
            PlaybackService service = PlaybackService.get();
            if (service != null) service.volume(level);
        });
    }

    @JavascriptInterface
    public void setUpcoming(String json, boolean loop) {
        activity.runOnUiThread(() -> {
            PlaybackService service = PlaybackService.get();
            if (service != null) service.setUpcoming(json, loop);
        });
    }

    @JavascriptInterface
    public void setRepeatOne(boolean on) {
        activity.runOnUiThread(() -> {
            PlaybackService service = PlaybackService.get();
            if (service != null) service.setRepeatOne(on);
        });
    }

    @JavascriptInterface
    public String playingUrl() {
        PlaybackService service = PlaybackService.get();
        return service == null ? "" : service.playingUrl();
    }

    @JavascriptInterface
    public void yield() {
        activity.runOnUiThread(() -> {
            PlaybackService service = PlaybackService.get();
            if (service != null) service.yieldForVideo();
        });
    }

    @JavascriptInterface
    public void stop() {
        activity.runOnUiThread(() -> {
            PlaybackService service = PlaybackService.get();
            if (service != null) service.stopPlayback();
        });
    }

    private void emit(String type, double position, double duration, String extra) {
        String script =
            "window.__fmusicAudioEvent&&window.__fmusicAudioEvent(" +
            JSONObject.quote(type == null ? "" : type) +
            "," +
            position +
            "," +
            duration +
            "," +
            JSONObject.quote(extra == null ? "" : extra) +
            ")";
        webView.post(() -> {
            try {
                if (Build.VERSION.SDK_INT >= 19) webView.evaluateJavascript(script, null);
            } catch (Exception ignored) {}
        });
    }
}
