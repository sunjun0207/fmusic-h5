package com.sunjun.fmusic;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    private boolean hooksInstalled;
    private boolean askedNotification;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        installHooks();
    }

    @Override
    public void onStart() {
        super.onStart();
        installHooks();
        askNotification();
        deliverCommand(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        deliverCommand(intent);
    }

    private void deliverCommand(Intent intent) {
        if (intent == null) return;
        String command = intent.getStringExtra(PlaybackService.EXTRA_COMMAND);
        if (command == null || command.isEmpty()) return;
        if (getBridge() == null || getBridge().getWebView() == null) return;
        intent.removeExtra(PlaybackService.EXTRA_COMMAND);
        WebView webView = getBridge().getWebView();
        String script =
            "window.__fmusicAudioEvent&&window.__fmusicAudioEvent('command',0,0," +
            JSONObject.quote(command) +
            ")";
        webView.post(() -> {
            if (Build.VERSION.SDK_INT >= 19) webView.evaluateJavascript(script, null);
        });
    }

    private void askNotification() {
        if (askedNotification || Build.VERSION.SDK_INT < 33) return;
        askedNotification = true;
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return;
        ActivityCompat.requestPermissions(this, new String[] { Manifest.permission.POST_NOTIFICATIONS }, 4108);
    }

    @Override
    public void onPause() {
        super.onPause();
        keepWebViewRunning();
    }

    @Override
    public void onStop() {
        super.onStop();
        keepWebViewRunning();
    }

    private void keepWebViewRunning() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebView webView = getBridge().getWebView();
        webView.onResume();
        webView.resumeTimers();
    }

    private void installHooks() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebView webView = getBridge().getWebView();
        getBridge().setWebViewClient(new FMusicWebViewClient(getBridge()));
        if (hooksInstalled) return;
        webView.addJavascriptInterface(new FMusicNet(webView), "FMusicNet");
        webView.addJavascriptInterface(new DownloadBridge(this), "FMusicDownload");
        webView.addJavascriptInterface(new ScreenBridge(this, webView), "FMusicScreen");
        webView.addJavascriptInterface(new FMusicAudio(this, webView), "FMusicAudio");
        hooksInstalled = true;
    }
}
