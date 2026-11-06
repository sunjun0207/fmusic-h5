package com.sunjun.fmusic;

import android.net.Uri;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** 安装包没有 Nginx。把本机 /api-fmusic-pomelo7-server 转到线上反代，页面仍用相对路径。 */
public final class ApiProxy {

    private static final String TAG = "FMusicProxy";
    private static final String UPSTREAM = "https://music.4848948.xyz";
    private static final String PREFIX = "/api-fmusic-pomelo7-server";
    private static final Set<String> FORWARD_HEADERS = new HashSet<>(
        Arrays.asList("accept", "accept-language", "content-type", "range", "user-agent")
    );

    private ApiProxy() {}

    public static WebResourceResponse intercept(WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (uri == null || !isLocalApi(uri)) return null;
        String path = uri.getPath();
        if (path == null) return null;
        String target = UPSTREAM + path;
        String query = uri.getEncodedQuery();
        if (query != null && !query.isEmpty()) target = target + "?" + query;
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(target).openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestMethod(request.getMethod());
            Map<String, String> requestHeaders = request.getRequestHeaders();
            if (requestHeaders != null) {
                for (Map.Entry<String, String> header : requestHeaders.entrySet()) {
                    if (header.getKey() == null || header.getValue() == null) continue;
                    if (!FORWARD_HEADERS.contains(header.getKey().toLowerCase(Locale.ROOT))) continue;
                    connection.setRequestProperty(header.getKey(), header.getValue());
                }
            }
            int status = connection.getResponseCode();
            String reason = connection.getResponseMessage();
            if (reason == null || reason.isEmpty()) reason = status >= 400 ? "Error" : "OK";
            String contentType = connection.getContentType();
            String mime = "application/octet-stream";
            String encoding = null;
            if (contentType != null && !contentType.isEmpty()) {
                String[] parts = contentType.split(";");
                mime = parts[0].trim();
                for (int i = 1; i < parts.length; i++) {
                    String piece = parts[i].trim();
                    if (piece.toLowerCase(Locale.ROOT).startsWith("charset=")) {
                        encoding = piece.substring("charset=".length()).trim().replace("\"", "");
                    }
                }
            }
            Map<String, String> responseHeaders = new LinkedHashMap<>();
            Map<String, List<String>> fields = connection.getHeaderFields();
            if (fields != null) {
                for (Map.Entry<String, List<String>> entry : fields.entrySet()) {
                    String name = entry.getKey();
                    if (name == null) continue;
                    String lower = name.toLowerCase(Locale.ROOT);
                    if (
                        lower.equals("content-encoding") ||
                        lower.equals("content-length") ||
                        lower.equals("transfer-encoding")
                    ) continue;
                    List<String> values = entry.getValue();
                    if (values == null || values.isEmpty()) continue;
                    StringBuilder joined = new StringBuilder();
                    for (int i = 0; i < values.size(); i++) {
                        if (i > 0) joined.append(", ");
                        joined.append(values.get(i));
                    }
                    responseHeaders.put(name, joined.toString());
                }
            }
            InputStream body = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            if (body == null) body = new ByteArrayInputStream(new byte[0]);
            return new WebResourceResponse(mime, encoding, status, reason, responseHeaders, body);
        } catch (Exception error) {
            Log.e(TAG, "proxy failed: " + target, error);
            if (connection != null) connection.disconnect();
            return new WebResourceResponse(
                "text/plain",
                "utf-8",
                502,
                "Bad Gateway",
                new LinkedHashMap<String, String>(),
                new ByteArrayInputStream(new byte[0])
            );
        }
    }

    private static boolean isLocalApi(Uri uri) {
        String path = uri.getPath();
        if (path == null || !(path.equals(PREFIX) || path.startsWith(PREFIX + "/"))) return false;
        String host = uri.getHost();
        return host == null || !host.equalsIgnoreCase("music.4848948.xyz");
    }
}
