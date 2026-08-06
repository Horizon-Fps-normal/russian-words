package com.russianwords.android;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

/** Online Edge Read Aloud client. This streams audio; it does not contain a voice model. */
final class EdgeSvetlanaClient {
    interface Callback {
        void onSuccess(byte[] audio);
        void onFailure(Throwable error);
    }

    private static final String TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
    private static final String CHROMIUM_VERSION = "143.0.3650.75";
    private static final String VOICE = "ru-RU-SvetlanaNeural";
    private final OkHttpClient client = new OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build();

    WebSocket synthesize(String text, double speed, Callback callback) {
        String connectionId = id();
        String url = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1"
            + "?TrustedClientToken=" + TRUSTED_CLIENT_TOKEN
            + "&Sec-MS-GEC=" + securityToken()
            + "&Sec-MS-GEC-Version=1-" + CHROMIUM_VERSION
            + "&ConnectionId=" + connectionId;
        Request request = new Request.Builder()
            .url(url)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                + "Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0")
            .header("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold")
            .header("Pragma", "no-cache")
            .header("Cache-Control", "no-cache")
            .header("Cookie", "muid=" + id().toUpperCase(Locale.ROOT) + ";")
            .build();
        return client.newWebSocket(request, new WebSocketListener() {
            private final ByteArrayOutputStream audio = new ByteArrayOutputStream();
            private final AtomicBoolean finished = new AtomicBoolean();

            @Override
            public void onOpen(WebSocket socket, Response response) {
                String timestamp = timestamp();
                socket.send("X-Timestamp:" + timestamp + "\r\n"
                    + "Content-Type:application/json; charset=utf-8\r\n"
                    + "Path:speech.config\r\n\r\n"
                    + "{\"context\":{\"synthesis\":{\"audio\":{\"metadataoptions\":{"
                    + "\"sentenceBoundaryEnabled\":\"false\",\"wordBoundaryEnabled\":\"false\"},"
                    + "\"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}\r\n");
                String ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ru-RU'>"
                    + "<voice name='" + VOICE + "'><prosody pitch='+0Hz' rate='" + rateForSpeed(speed)
                    + "' volume='+0%'>" + escapeXml(text) + "</prosody></voice></speak>";
                socket.send("X-RequestId:" + id() + "\r\n"
                    + "Content-Type:application/ssml+xml\r\n"
                    + "X-Timestamp:" + timestamp + "Z\r\n"
                    + "Path:ssml\r\n\r\n" + ssml);
            }

            @Override
            public void onMessage(WebSocket socket, ByteString bytes) {
                if (bytes.size() < 2) return;
                int headerLength = ((bytes.getByte(0) & 0xff) << 8) | (bytes.getByte(1) & 0xff);
                int start = headerLength + 2;
                if (start >= bytes.size()) return;
                String headers = bytes.substring(2, start).utf8().toLowerCase(Locale.ROOT);
                if (!headers.contains("path:audio") || !headers.contains("content-type:audio/mpeg")) return;
                byte[] chunk = bytes.substring(start).toByteArray();
                audio.write(chunk, 0, chunk.length);
            }

            @Override
            public void onMessage(WebSocket socket, String message) {
                if (!message.toLowerCase(Locale.ROOT).contains("path:turn.end")) return;
                socket.close(1000, "complete");
                byte[] result = audio.toByteArray();
                if (result.length == 0) finishFailure(new IllegalStateException("Edge TTS returned no audio"));
                else if (finished.compareAndSet(false, true)) callback.onSuccess(result);
            }

            @Override
            public void onFailure(WebSocket socket, Throwable error, Response response) {
                finishFailure(error);
            }

            @Override
            public void onClosed(WebSocket socket, int code, String reason) {
                byte[] result = audio.toByteArray();
                if (result.length == 0) finishFailure(new IllegalStateException("Edge TTS closed before audio"));
                else if (finished.compareAndSet(false, true)) callback.onSuccess(result);
            }

            private void finishFailure(Throwable error) {
                if (finished.compareAndSet(false, true)) callback.onFailure(error);
            }
        });
    }

    static String rateForSpeed(double speed) {
        double value = Math.max(0.5, Math.min(1.5, speed));
        int percent = (int) Math.round((value - 1) * 100);
        return (percent >= 0 ? "+" : "") + percent + "%";
    }

    private static String id() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    private static String timestamp() {
        SimpleDateFormat format = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss 'GMT+0000 (Coordinated Universal Time)'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date());
    }

    private static String securityToken() {
        try {
            long seconds = System.currentTimeMillis() / 1000L + 11644473600L;
            seconds -= seconds % 300L;
            String value = Long.toString(seconds * 10000000L) + TRUSTED_CLIENT_TOKEN;
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.US_ASCII));
            StringBuilder result = new StringBuilder(digest.length * 2);
            for (byte part : digest) result.append(String.format(Locale.ROOT, "%02X", part & 0xff));
            return result.toString();
        } catch (Exception error) {
            throw new IllegalStateException(error);
        }
    }

    private static String escapeXml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace("\"", "&quot;").replace("'", "&apos;");
    }
}
