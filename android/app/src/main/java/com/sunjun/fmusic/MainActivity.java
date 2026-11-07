package com.sunjun.fmusic;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

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
