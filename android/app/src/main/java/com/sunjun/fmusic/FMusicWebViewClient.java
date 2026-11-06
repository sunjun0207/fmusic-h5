package com.sunjun.fmusic;

import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

public class FMusicWebViewClient extends BridgeWebViewClient {

    public FMusicWebViewClient(Bridge bridge) {
        super(bridge);
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        WebResourceResponse proxied = ApiProxy.intercept(request);
        if (proxied != null) return proxied;
        return super.shouldInterceptRequest(view, request);
    }
}
