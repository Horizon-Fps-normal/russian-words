package com.russianwords.android;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.Assume;
import org.junit.Test;

public class EdgeSvetlanaClientTest {
    @Test
    public void mapsAppSpeedToOriginalEdgeRate() {
        assertEquals("-18%", EdgeSvetlanaClient.rateForSpeed(0.82));
        assertEquals("+0%", EdgeSvetlanaClient.rateForSpeed(1.0));
        assertEquals("+15%", EdgeSvetlanaClient.rateForSpeed(1.15));
    }

    @Test
    public void synthesizesSvetlanaWhenNetworkTestIsEnabled() throws Exception {
        Assume.assumeTrue("1".equals(System.getenv("RUN_EDGE_TTS_NETWORK_TEST")));
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<byte[]> audio = new AtomicReference<>();
        AtomicReference<Throwable> failure = new AtomicReference<>();
        new EdgeSvetlanaClient().synthesize("привет", 1.0, new EdgeSvetlanaClient.Callback() {
            @Override public void onSuccess(byte[] result) { audio.set(result); done.countDown(); }
            @Override public void onFailure(Throwable error) { failure.set(error); done.countDown(); }
        });
        assertTrue("Edge TTS timed out", done.await(25, TimeUnit.SECONDS));
        if (failure.get() != null) throw new AssertionError(failure.get());
        assertTrue(audio.get() != null && audio.get().length > 1000);
    }
}
