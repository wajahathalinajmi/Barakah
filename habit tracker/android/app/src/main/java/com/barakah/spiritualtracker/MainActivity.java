package com.barakah.spiritualtracker;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.Collections;
import java.util.regex.Pattern;

public final class MainActivity extends Activity {
    private static final String APP_URL = "https://barakah.wajahathalinajmi.workers.dev/";
    private static final String APP_ORIGIN = "https://barakah.wajahathalinajmi.workers.dev";
    private static final Pattern SAFE_NAME = Pattern.compile("barakah-[0-9]{1,4}-day-badge\\.png");

    private WebView webView;
    private ProgressBar loading;
    private View offlinePanel;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        buildScreen();
        configureWebView();
        if (savedInstanceState == null) webView.loadUrl(APP_URL);
        else webView.restoreState(savedInstanceState);
    }

    private void buildScreen() {
        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.rgb(250, 250, 247));
        ViewCompat.setOnApplyWindowInsetsListener(frame, (view, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            view.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return insets;
        });

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(250, 250, 247));
        frame.addView(webView, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        loading = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        loading.setIndeterminate(false);
        loading.setMax(100);
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3), Gravity.TOP);
        frame.addView(loading, progressParams);

        TextView offlineText = new TextView(this);
        offlineText.setText("Barakah needs an internet connection to sync your journey.\n\nCheck your connection and try again.");
        offlineText.setTextColor(Color.rgb(55, 72, 59));
        offlineText.setTextSize(16);
        offlineText.setGravity(Gravity.CENTER);
        offlineText.setPadding(dp(28), dp(28), dp(28), dp(18));
        Button retry = new Button(this);
        retry.setText("Try again");
        retry.setTextColor(Color.WHITE);
        retry.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(39, 74, 59)));
        retry.setOnClickListener(view -> {
            offlinePanel.setVisibility(View.GONE);
            webView.reload();
        });
        android.widget.LinearLayout offlineContent = new android.widget.LinearLayout(this);
        offlineContent.setOrientation(android.widget.LinearLayout.VERTICAL);
        offlineContent.setGravity(Gravity.CENTER);
        offlineContent.addView(offlineText, new android.widget.LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        offlineContent.addView(retry, new android.widget.LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        offlinePanel = offlineContent;
        offlinePanel.setVisibility(View.GONE);
        frame.addView(offlinePanel, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(frame);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        WebView.setWebContentsDebuggingEnabled(false);

        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "barakahAndroid", Collections.singleton(APP_ORIGIN),
                    (view, message, sourceOrigin, isMainFrame, replyProxy) -> {
                        if (!isMainFrame || !"https".equals(sourceOrigin.getScheme())
                                || !"barakah.wajahathalinajmi.workers.dev".equals(sourceOrigin.getHost())
                                || (sourceOrigin.getPort() != -1 && sourceOrigin.getPort() != 443)) return;
                        handleNativeMessage(message.getData());
                    });
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isTrustedPage(uri)) return false;
                openExternal(uri);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (isTrustedPage(Uri.parse(url))) offlinePanel.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                if (request.isForMainFrame()) offlinePanel.setVisibility(View.VISIBLE);
            }
        });
        webView.setWebChromeClient(new android.webkit.WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int progress) {
                loading.setProgress(progress);
                loading.setVisibility(progress >= 100 ? View.GONE : View.VISIBLE);
            }
        });
    }

    private boolean isTrustedPage(Uri uri) {
        return "https".equals(uri.getScheme()) && "barakah.wajahathalinajmi.workers.dev".equals(uri.getHost());
    }

    private void openExternal(Uri uri) {
        String scheme = uri.getScheme();
        if (!"https".equals(scheme) && !"http".equals(scheme) && !"mailto".equals(scheme) && !"tel".equals(scheme)) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception ignored) {
            Toast.makeText(this, "No app is available to open that link.", Toast.LENGTH_SHORT).show();
        }
    }

    private void handleNativeMessage(String raw) {
        if (raw == null || raw.length() > 8_000_000) return;
        try {
            JSONObject message = new JSONObject(raw);
            if (!"sharePoster".equals(message.optString("type"))) return;
            String encoded = message.optString("imageData", "");
            String fileName = message.optString("fileName", "");
            if (encoded.isEmpty() || encoded.length() > 6_000_000 || !SAFE_NAME.matcher(fileName).matches()) return;
            byte[] png = android.util.Base64.decode(encoded, android.util.Base64.DEFAULT);
            if (png.length < 8 || png.length > 4_500_000 || png[0] != (byte) 0x89 || png[1] != 0x50 || png[2] != 0x4e || png[3] != 0x47) return;
            sharePoster(png, fileName, message.optString("title", "Barakah milestone"));
        } catch (Exception ignored) {
            Toast.makeText(this, "Could not prepare the milestone poster.", Toast.LENGTH_SHORT).show();
        }
    }

    private void sharePoster(byte[] png, String fileName, String title) throws Exception {
        File sharedDirectory = new File(getCacheDir(), "shared");
        if (!sharedDirectory.exists() && !sharedDirectory.mkdirs()) throw new IllegalStateException("Could not create a temporary share folder.");
        File poster = new File(sharedDirectory, fileName);
        try (FileOutputStream output = new FileOutputStream(poster)) {
            output.write(png);
        }
        Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", poster);
        Intent share = new Intent(Intent.ACTION_SEND);
        share.setType("image/png");
        share.putExtra(Intent.EXTRA_STREAM, uri);
        share.putExtra(Intent.EXTRA_TEXT, "Small steps, with intention. · Barakah");
        share.setClipData(ClipData.newUri(getContentResolver(), "Barakah milestone poster", uri));
        share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivity(Intent.createChooser(share, title));
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }
}
