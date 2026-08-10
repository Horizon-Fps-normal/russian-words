package com.russianwords.android;

import android.app.Activity;
import android.content.Intent;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import okhttp3.WebSocket;

@CapacitorPlugin(name = "RussianWords")
public class RussianWordsPlugin extends Plugin {
    private static final long MAX_BACKGROUND_BYTES = 8L * 1024L * 1024L;
    private static final String[] BACKGROUND_NAMES = {
        "background.png", "background.jpg", "background.webp", "background.gif", "background.image"
    };
    private TextToSpeech tts;
    private volatile boolean ttsReady;
    private Voice russianVoice;
    private final EdgeSvetlanaClient edgeClient = new EdgeSvetlanaClient();
    private int speechRequestSerial;
    private WebSocket edgeSocket;
    private MediaPlayer edgePlayer;
    private PluginCall activeSpeechCall;

    @Override
    public void load() {
        tts = new TextToSpeech(getContext(), status -> {
            if (status == TextToSpeech.SUCCESS) {
                int result = tts.setLanguage(Locale.forLanguageTag("ru-RU"));
                ttsReady = result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED;
                if (ttsReady) {
                    russianVoice = selectRussianFemaleVoice(tts.getVoices());
                    if (russianVoice != null) tts.setVoice(russianVoice);
                    tts.setPitch(1.06f);
                }
            }
        });
    }

    @PluginMethod
    public synchronized void speakRussian(PluginCall call) {
        String text = call.getString("text", "").trim();
        double speed = call.getDouble("speed", 1.0);
        if (text.isEmpty()) { call.reject("朗读文本不能为空"); return; }
        stopSpeechInternal();
        int requestId = speechRequestSerial;
        activeSpeechCall = call;
        File cached = edgeCacheFile(text, speed);
        if (cached.isFile() && cached.length() > 0) {
            playEdgeFile(cached, text, speed, requestId, call);
            return;
        }
        edgeSocket = edgeClient.synthesize(text, speed, new EdgeSvetlanaClient.Callback() {
            @Override
            public void onSuccess(byte[] audio) {
                if (!isCurrentRequest(requestId, call)) return;
                try {
                    File directory = cached.getParentFile();
                    if (directory != null && !directory.exists()) directory.mkdirs();
                    try (FileOutputStream output = new FileOutputStream(cached)) { output.write(audio); }
                    playEdgeFile(cached, text, speed, requestId, call);
                } catch (Exception error) {
                    fallbackToSystem(text, speed, requestId, call);
                }
            }

            @Override
            public void onFailure(Throwable error) {
                fallbackToSystem(text, speed, requestId, call);
            }
        });
    }

    private synchronized boolean isCurrentRequest(int requestId, PluginCall call) {
        return requestId == speechRequestSerial && activeSpeechCall == call;
    }

    private void playEdgeFile(File audio, String text, double speed, int requestId, PluginCall call) {
        getActivity().runOnUiThread(() -> {
            synchronized (RussianWordsPlugin.this) {
                if (!isCurrentRequest(requestId, call)) return;
                try {
                    MediaPlayer player = new MediaPlayer();
                    edgePlayer = player;
                    player.setDataSource(audio.getAbsolutePath());
                    player.setOnPreparedListener(prepared -> {
                        synchronized (RussianWordsPlugin.this) {
                            if (!isCurrentRequest(requestId, call) || edgePlayer != prepared) return;
                            prepared.start();
                            resolveSpeechCall(call, true, "edge-svetlana");
                        }
                    });
                    player.setOnCompletionListener(this::releaseEdgePlayer);
                    player.setOnErrorListener((failed, what, extra) -> {
                        releaseEdgePlayer(failed);
                        fallbackToSystem(text, speed, requestId, call);
                        return true;
                    });
                    player.prepareAsync();
                } catch (Exception error) {
                    releaseEdgePlayer(edgePlayer);
                    fallbackToSystem(text, speed, requestId, call);
                }
            }
        });
    }

    private synchronized void fallbackToSystem(String text, double speed, int requestId, PluginCall call) {
        if (!isCurrentRequest(requestId, call)) return;
        if (text == null || text.isEmpty() || !ttsReady) {
            resolveSpeechCall(call, false, "unavailable");
            return;
        }
        tts.stop();
        if (russianVoice != null) tts.setVoice(russianVoice);
        tts.setPitch(1.0f);
        tts.setSpeechRate((float) Math.max(0.7, Math.min(1.3, speed)));
        Bundle parameters = new Bundle();
        int result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, parameters, UUID.randomUUID().toString());
        resolveSpeechCall(call, result == TextToSpeech.SUCCESS, "system");
    }

    private synchronized void resolveSpeechCall(PluginCall call, boolean ok, String provider) {
        if (activeSpeechCall != call) return;
        activeSpeechCall = null;
        JSObject response = new JSObject();
        response.put("ok", ok);
        response.put("provider", provider);
        call.resolve(response);
    }

    private File edgeCacheFile(String text, double speed) {
        try {
            String value = "svetlana-original-v1|" + text + "|" + speed;
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder name = new StringBuilder();
            for (byte part : digest) name.append(String.format(Locale.ROOT, "%02x", part & 0xff));
            return new File(new File(getContext().getCacheDir(), "edge-tts"), name + ".mp3");
        } catch (Exception error) {
            return new File(new File(getContext().getCacheDir(), "edge-tts"), Integer.toHexString(valueHash(text, speed)) + ".mp3");
        }
    }

    private int valueHash(String text, double speed) {
        return (text + "|" + speed).hashCode();
    }

    private synchronized void releaseEdgePlayer(MediaPlayer player) {
        if (player == null) return;
        try { player.stop(); } catch (Exception ignored) {}
        player.reset();
        player.release();
        if (edgePlayer == player) edgePlayer = null;
    }

    private synchronized void stopSpeechInternal() {
        speechRequestSerial += 1;
        if (edgeSocket != null) {
            edgeSocket.cancel();
            edgeSocket = null;
        }
        if (edgePlayer != null) releaseEdgePlayer(edgePlayer);
        if (tts != null) tts.stop();
        if (activeSpeechCall != null) {
            JSObject response = new JSObject();
            response.put("ok", false);
            response.put("cancelled", true);
            activeSpeechCall.resolve(response);
            activeSpeechCall = null;
        }
    }

    /**
     * Android does not expose a portable gender field for TTS voices. Prefer
     * well-known female Russian names/engine identifiers, reject clearly male
     * names, then fall back to the highest-quality ru-RU voice supplied by the
     * installed engine. QUEUE_FLUSH still guarantees only one utterance plays.
     */
    private Voice selectRussianFemaleVoice(Set<Voice> voices) {
        if (voices == null) return null;
        Voice best = null;
        int bestScore = Integer.MIN_VALUE;
        for (Voice voice : voices) {
            Locale locale = voice.getLocale();
            if (locale == null || !"ru".equalsIgnoreCase(locale.getLanguage())) continue;
            String name = voice.getName() == null ? "" : voice.getName().toLowerCase(Locale.ROOT);
            int score = voice.getQuality();
            if ("RU".equalsIgnoreCase(locale.getCountry())) score += 40;
            if (!voice.isNetworkConnectionRequired()) score += 15;
            if (name.matches(".*(svetlana|dariya|irina|alena|milena|katya|tatyana|female|x-dfc).*")) score += 1000;
            if (name.matches(".*(dmitry|maxim|pavel|alexander|yuri).*")) score -= 1000;
            if (name.matches(".*(^|[-_ .])male($|[-_ .]).*")) score -= 1000;
            if (score > bestScore) {
                best = voice;
                bestScore = score;
            }
        }
        return best;
    }

    @PluginMethod
    public synchronized void stopSpeaking(PluginCall call) {
        stopSpeechInternal();
        call.resolve();
    }

    @PluginMethod
    public void selectBackgroundImage(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        startActivityForResult(call, intent, "backgroundPicked");
    }

    @ActivityCallback
    private void backgroundPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.resolve(new JSObject());
            return;
        }
        Uri uri = result.getData().getData();
        try {
            String mime = getContext().getContentResolver().getType(uri);
            if (mime == null || !(mime.equals("image/png") || mime.equals("image/jpeg") || mime.equals("image/webp") || mime.equals("image/gif"))) {
                call.reject("仅支持 PNG、JPEG、WebP 或 GIF 图片");
                return;
            }
            File directory = new File(getContext().getFilesDir(), "background");
            if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("无法创建背景目录");
            File temporary = new File(directory, "background.tmp");
            long total = 0;
            try (InputStream input = getContext().getContentResolver().openInputStream(uri);
                 FileOutputStream output = new FileOutputStream(temporary)) {
                if (input == null) throw new IllegalStateException("无法读取图片");
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    total += count;
                    if (total > MAX_BACKGROUND_BYTES) throw new IllegalArgumentException("图片不能超过 8MB");
                    output.write(buffer, 0, count);
                }
            }
            File target = new File(directory, backgroundNameForMime(mime));
            deleteBackgroundFiles(directory);
            if (!temporary.renameTo(target)) throw new IllegalStateException("无法保存背景图片");
            JSObject response = new JSObject();
            response.put("path", Uri.fromFile(target).toString());
            call.resolve(response);
        } catch (Exception error) {
            new File(new File(getContext().getFilesDir(), "background"), "background.tmp").delete();
            call.reject(error.getMessage() == null ? "导入背景失败" : error.getMessage());
        }
    }

    @PluginMethod
    public void getBackgroundImage(PluginCall call) {
        File image = findBackgroundImage();
        JSObject response = new JSObject();
        if (image != null && image.isFile()) response.put("path", Uri.fromFile(image).toString());
        call.resolve(response);
    }

    @PluginMethod
    public void clearBackgroundImage(PluginCall call) {
        try {
            deleteBackgroundFiles(new File(getContext().getFilesDir(), "background"));
            call.resolve();
        } catch (Exception error) {
            call.reject(error.getMessage() == null ? "无法删除背景图片" : error.getMessage());
        }
    }

    private String backgroundNameForMime(String mime) {
        if ("image/png".equals(mime)) return "background.png";
        if ("image/webp".equals(mime)) return "background.webp";
        if ("image/gif".equals(mime)) return "background.gif";
        return "background.jpg";
    }

    private File findBackgroundImage() {
        File directory = new File(getContext().getFilesDir(), "background");
        for (String name : BACKGROUND_NAMES) {
            File candidate = new File(directory, name);
            if (candidate.isFile()) return candidate;
        }
        return null;
    }

    private void deleteBackgroundFiles(File directory) {
        for (String name : BACKGROUND_NAMES) {
            File candidate = new File(directory, name);
            if (candidate.exists() && !candidate.delete()) throw new IllegalStateException("无法替换旧背景");
        }
    }

    @Override
    protected void handleOnDestroy() {
        stopSpeechInternal();
        if (tts != null) { tts.stop(); tts.shutdown(); }
        super.handleOnDestroy();
    }
}
