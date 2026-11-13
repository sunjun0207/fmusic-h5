package com.sunjun.fmusic;

import android.net.Uri;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/** 页面里的搜索、歌单请求改走这里，不再依赖 WebView 自己发请求。 */
public class FMusicNet {

    private static final int MAX_BYTES = 3_000_000;
    private final WebView webView;
    private final ExecutorService executor = Executors.newCachedThreadPool();

    FMusicNet(WebView webView) {
        this.webView = webView;
    }

    @JavascriptInterface
    public void request(String id, String url, String method, String headersJson, String body) {
        executor.execute(() -> run(id, url, method, headersJson, body));
    }

    private void run(String id, String url, String method, String headersJson, String body) {
        if (!allowed(url)) {
            finish(id, 0, "", "", "接口地址无效");
            return;
        }
        Exception last = null;
        for (int attempt = 0; attempt < 2; attempt++) {
            HttpURLConnection connection = null;
            try {
                String verb = method == null || method.isEmpty() ? "GET" : method.toUpperCase(Locale.ROOT);
                connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(25000);
                connection.setInstanceFollowRedirects(true);
                connection.setUseCaches(false);
                connection.setRequestProperty("Connection", "close");
                connection.setRequestMethod(verb);
                connection.setRequestProperty("Accept", "*/*");
                connection.setRequestProperty(
                    "User-Agent",
                    "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                );
                applyHeaders(connection, headersJson);
                applyHostHeaders(connection, url);
                if (!"GET".equals(verb) && !"HEAD".equals(verb) && body != null && !body.isEmpty()) {
                    byte[] payload = body.getBytes(StandardCharsets.UTF_8);
                    connection.setDoOutput(true);
                    connection.getOutputStream().write(payload);
                }
                int status = connection.getResponseCode();
                String contentType = connection.getContentType() == null ? "" : connection.getContentType();
                InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                byte[] bytes = readFully(stream);
                String encoded = Base64.encodeToString(bytes, Base64.NO_WRAP);
                finish(id, status, contentType, encoded, "");
                connection.disconnect();
                return;
            } catch (Exception error) {
                last = error;
                if (connection != null) connection.disconnect();
            }
        }
        String message = last == null || last.getMessage() == null ? "请求失败" : last.getMessage();
        finish(id, 0, "", "", "接口 " + message);
    }

    private static void applyHeaders(HttpURLConnection connection, String headersJson) {
        if (headersJson == null || headersJson.isEmpty()) return;
        try {
            JSONObject json = new JSONObject(headersJson);
            java.util.Iterator<String> keys = json.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                if (key == null) continue;
                String lower = key.toLowerCase(Locale.ROOT);
                if (
                    lower.equals("host") ||
                    lower.equals("cookie") ||
                    lower.equals("origin") ||
                    lower.equals("referer") ||
                    lower.equals("content-length") ||
                    lower.equals("accept-encoding") ||
                    lower.equals("user-agent")
                ) continue;
                connection.setRequestProperty(key, json.optString(key, ""));
            }
        } catch (Exception ignored) {}
    }

    private static void applyHostHeaders(HttpURLConnection connection, String url) {
        String host = Uri.parse(url).getHost();
        if (host == null) return;
        host = host.toLowerCase(Locale.ROOT);
        if (host.equals("nmobi.kuwo.cn")) {
            connection.setRequestProperty("User-Agent", "okhttp/3.10.0");
        } else if (host.equals("ncomment.kuwo.cn")) {
            connection.setRequestProperty("Referer", "https://www.kuwo.cn/");
            connection.setRequestProperty("User-Agent", "Mozilla/5.0");
        }
    }

    private static boolean allowed(String url) {
        if (url == null || url.isEmpty()) return false;
        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme();
        if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) return false;
        String host = uri.getHost();
        if (host == null) return false;
        host = host.toLowerCase(Locale.ROOT);
        return "music.4848948.xyz".equals(host) || "kuwo.cn".equals(host) || host.endsWith(".kuwo.cn");
    }

    private static byte[] readFully(InputStream input) throws java.io.IOException {
        if (input == null) return new byte[0];
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int total = 0;
        int read;
        while ((read = input.read(buffer)) >= 0) {
            total += read;
            if (total > MAX_BYTES) throw new java.io.IOException("响应过大");
            out.write(buffer, 0, read);
        }
        return out.toByteArray();
    }

    private void finish(String id, int status, String contentType, String base64, String error) {
        String script =
            "window.__fmusicNetDone&&window.__fmusicNetDone(" +
            JSONObject.quote(id == null ? "" : id) +
            "," +
            status +
            "," +
            JSONObject.quote(contentType == null ? "" : contentType) +
            "," +
            JSONObject.quote(base64 == null ? "" : base64) +
            "," +
            JSONObject.quote(error == null ? "" : error) +
            ")";
        webView.post(() -> {
            try {
                webView.evaluateJavascript(script, null);
            } catch (Exception ignored) {}
        });
    }
}
