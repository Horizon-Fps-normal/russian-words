package com.russianwords.android;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RussianWordsPlugin.class);
        super.onCreate(savedInstanceState);
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.setSoundEffectsEnabled(false);
            webView.setHapticFeedbackEnabled(false);
            webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        }
    }
}
