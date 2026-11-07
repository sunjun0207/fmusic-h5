package com.sunjun.fmusic;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import androidx.core.content.ContextCompat;
import java.util.Locale;

/** 把歌曲保存到系统「下载」，文件名沿用页面给出的「歌名-歌手-音质」。 */
public class DownloadBridge {

    private final Activity activity;

    DownloadBridge(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public void download(String url, String filename) {
        activity.runOnUiThread(() -> start(url, filename));
    }

    private void start(String url, String filename) {
        if (!allowed(url)) {
            toast("下载地址无效");
            return;
        }
        if (
            Build.VERSION.SDK_INT <= 28 &&
            ContextCompat.checkSelfPermission(activity, Manifest.permission.WRITE_EXTERNAL_STORAGE) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            activity.requestPermissions(new String[] { Manifest.permission.WRITE_EXTERNAL_STORAGE }, 4101);
            toast("请允许存储权限后再次下载");
            return;
        }
        if (
            Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            activity.requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 4102);
        }

        String safe = sanitize(filename);
        DownloadManager manager = (DownloadManager) activity.getSystemService(Activity.DOWNLOAD_SERVICE);
        if (manager == null) {
            toast("系统下载服务不可用");
            return;
        }
        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        request.setTitle(safe);
        request.setDescription("碎冰音乐");
        String mime = mimeOf(safe);
        request.setMimeType(mime);
        if (mime.startsWith("image/")) {
            request.addRequestHeader("Referer", "https://www.kuwo.cn/");
            request.addRequestHeader("User-Agent", "Mozilla/5.0");
        }
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, safe);
        try {
            manager.enqueue(request);
        } catch (Exception error) {
            toast("下载失败");
        }
    }

    private static boolean allowed(String url) {
        if (url == null || url.isEmpty()) return false;
        Uri uri = Uri.parse(url);
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme())) return false;
        String host = uri.getHost();
        if (host == null) return false;
        host = host.toLowerCase(Locale.ROOT);
        return "music.4848948.xyz".equals(host) || "kuwo.cn".equals(host) || host.endsWith(".kuwo.cn");
    }

    private static String sanitize(String filename) {
        String raw = filename == null ? "" : filename;
        String safe = raw.replaceAll("[\\\\/:*?\"<>|]", " ").replaceAll("\\p{Cntrl}", "").replaceAll("\\s+", " ").trim();
        if (safe.isEmpty()) safe = "fmusic.mp3";
        if (safe.length() > 120) safe = safe.substring(0, 120);
        return safe;
    }

    private static String mimeOf(String filename) {
        String lower = filename.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".flac")) return "audio/flac";
        if (lower.endsWith(".mp4")) return "video/mp4";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".gif")) return "image/gif";
        return "audio/mpeg";
    }

    private void toast(String text) {
        Toast.makeText(activity, text, Toast.LENGTH_SHORT).show();
    }
}
