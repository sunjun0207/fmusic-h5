package com.sunjun.fmusic;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

/** MV 全屏时把安装包转到横屏并铺满屏幕，退出后回到竖屏。 */
public class ScreenBridge {

    private static final int PAGE = Color.parseColor("#F4FAF8");

    private final Activity activity;
    private final WebView webView;

    ScreenBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    @JavascriptInterface
    public void landscape() {
        activity.runOnUiThread(() -> apply(true));
    }

    @JavascriptInterface
    public void portrait() {
        activity.runOnUiThread(() -> apply(false));
    }

    private void apply(boolean landscape) {
        if (activity.isFinishing()) return;
        Window window = activity.getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, !landscape);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams attrs = window.getAttributes();
            attrs.layoutInDisplayCutoutMode = landscape
                ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT;
            window.setAttributes(attrs);
        }
        int color = landscape ? Color.BLACK : PAGE;
        window.setStatusBarColor(color);
        window.setNavigationBarColor(color);
        window.getDecorView().setBackgroundColor(color);
        View content = activity.findViewById(android.R.id.content);
        if (content != null) content.setBackgroundColor(color);
        webView.setBackgroundColor(color);
        activity.setRequestedOrientation(
            landscape
                ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        );
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, webView);
        if (controller != null) {
            if (landscape) {
                controller.hide(WindowInsetsCompat.Type.systemBars());
                controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            } else {
                controller.show(WindowInsetsCompat.Type.systemBars());
                controller.setAppearanceLightStatusBars(true);
                controller.setAppearanceLightNavigationBars(true);
            }
        }
        webView.post(webView::requestLayout);
    }
}
