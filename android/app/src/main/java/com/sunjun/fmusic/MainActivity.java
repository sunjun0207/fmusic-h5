package com.sunjun.fmusic;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private boolean hooksInstalled;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        installHooks();
    }

    @Override
    public void onStart() {
        super.onStart();
        installHooks();
    }

    private void installHooks() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebView webView = getBridge().getWebView();
        getBridge().setWebViewClient(new FMusicWebViewClient(getBridge()));
        if (hooksInstalled) return;
        webView.addJavascriptInterface(new FMusicNet(webView), "FMusicNet");
        webView.addJavascriptInterface(new DownloadBridge(this), "FMusicDownload");
        webView.addJavascriptInterface(new ScreenBridge(this), "FMusicScreen");
        hooksInstalled = true;
    }
}
