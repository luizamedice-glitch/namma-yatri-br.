package br.com.namma.mobilidade;

import android.content.Intent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Exercises real dev-account HTTP provisioning, encrypted persistence and session recovery. */
@RunWith(AndroidJUnit4.class)
public final class BackendConnectionTest {
    private MainActivity launch() {
        var i = InstrumentationRegistry.getInstrumentation();
        return (MainActivity)i.startActivitySync(new Intent(i.getTargetContext(), MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    }
    private Api connected() throws Exception { return connected(null); }
    private Api connected(String excluded) throws Exception {
        var context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        long deadline = System.currentTimeMillis() + 25000;
        while (System.currentTimeMillis() < deadline) {
            String token = new SessionStore(context).load();
            if (!token.isEmpty() && !token.equals(excluded)) { Api api = new Api(BuildConfig.API_URL); api.token = token; return api; }
            Thread.sleep(100);
        }
        throw new AssertionError("A conta automática não foi provisionada no backend real");
    }
    @Test public void automaticAccountPersistsAndRecoversWithoutLogin() throws Exception {
        var i = InstrumentationRegistry.getInstrumentation();
        var context = i.getTargetContext();
        i.getUiAutomation().grantRuntimePermission(context.getPackageName(), android.Manifest.permission.ACCESS_FINE_LOCATION);
        i.getUiAutomation().grantRuntimePermission(context.getPackageName(), android.Manifest.permission.ACCESS_COARSE_LOCATION);
        new SessionStore(context).clear();
        MainActivity activity = launch();
        try {
            Api api = connected(); JSONObject user = api.request("/v1/snapshot", null).getJSONObject("user");
            assertEquals(BuildConfig.ROLE, user.getString("role"));
            assertEquals(BuildConfig.ROLE.equals("driver") ? "Giselo" : "Fagner", user.getString("name"));
            try { waitUntil(() -> {
                boolean[] ready = {false};
                i.runOnMainSync(() -> ready[0] = contains(activity.getWindow().getDecorView(), BuildConfig.ROLE.equals("driver") ? "Ficar disponível" : "Localização GPS atual"));
                return ready[0];
            }); } catch (AssertionError failure) {
                var manager = (android.location.LocationManager)context.getSystemService(android.content.Context.LOCATION_SERVICE);
                String[] visible = {""};
                i.runOnMainSync(() -> visible[0] = visibleText(activity.getWindow().getDecorView()));
                throw new AssertionError("GPS enabled=" + manager.isProviderEnabled("gps") + ", providers=" + manager.getProviders(true)
                    + ", fine=" + context.checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION)
                    + ", coarse=" + context.checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION)
                    + ", UI=" + visible[0], failure);
            }
            if (BuildConfig.ROLE.equals("driver")) {
                waitUntil(() -> {
                    if (api.request("/v1/snapshot", null).optBoolean("available")) return true;
                    i.runOnMainSync(() -> click(activity.getWindow().getDecorView(), "Ficar disponível"));
                    return false;
                });
                waitUntil(() -> {
                    boolean[] ready = {false};
                    i.runOnMainSync(() -> ready[0] = contains(activity.getWindow().getDecorView(), "Ficar indisponível"));
                    return ready[0];
                });
                i.runOnMainSync(() -> assertTrue(click(activity.getWindow().getDecorView(), "Ficar indisponível")));
                waitUntil(() -> !api.request("/v1/snapshot", null).optBoolean("available"));
            }
            i.waitForIdleSync();
            i.runOnMainSync(() -> {
                assertTrue(contains(activity.getWindow().getDecorView(), user.optString("name")));
                assertFalse(contains(activity.getWindow().getDecorView(), "Entrar"));
                assertFalse(contains(activity.getWindow().getDecorView(), "Email"));
            });
            try (var screenshot = i.getUiAutomation().executeShellCommand("screencap -p /sdcard/br-" + BuildConfig.ROLE + "-home.png")) {
                try (var input = new android.os.ParcelFileDescriptor.AutoCloseInputStream(screenshot)) { byte[] buffer = new byte[8192]; while (input.read(buffer) != -1) {} }
            }
            String oldToken = api.token;
            i.runOnMainSync(activity::finish);
            MainActivity reopened = launch();
            try {
                assertEquals(oldToken, connected().token);
                assertEquals(user.getString("id"), connected().request("/v1/snapshot", null).getJSONObject("user").getString("id"));
            } finally { i.runOnMainSync(reopened::finish); }
            api.request("/v1/auth/logout", new JSONObject());
            MainActivity recovered = launch();
            try {
                Api replacement = connected(oldToken);
                assertNotEquals(oldToken, replacement.token);
                assertEquals(user.getString("id"), replacement.request("/v1/snapshot", null).getJSONObject("user").getString("id"));
            } finally { i.runOnMainSync(recovered::finish); }
        } finally { i.runOnMainSync(activity::finish); }
    }
    interface Condition { boolean get() throws Exception; }
    private void waitUntil(Condition condition) throws Exception {
        long deadline = System.currentTimeMillis() + 25000;
        while (System.currentTimeMillis() < deadline) {
            if (condition.get()) return;
            Thread.sleep(500);
        }
        throw new AssertionError("Estado operacional esperado não chegou pelo GPS/backend reais do ambiente de testes");
    }
    private String visibleText(View view) {
        if (view instanceof TextView) return ((TextView)view).getText().toString() + " | ";
        StringBuilder result = new StringBuilder();
        if (view instanceof ViewGroup) { ViewGroup group=(ViewGroup)view; for(int n=0;n<group.getChildCount();n++) result.append(visibleText(group.getChildAt(n))); }
        return result.toString();
    }
    private boolean click(View view, String text) {
        if (view instanceof TextView && ((TextView)view).getText().toString().equals(text) && view.isClickable()) return view.performClick();
        if (view instanceof ViewGroup) { ViewGroup group=(ViewGroup)view; for(int n=0;n<group.getChildCount();n++) if(click(group.getChildAt(n),text)) return true; }
        return false;
    }
    private boolean contains(View view, String text) {
        if (view instanceof TextView && ((TextView)view).getText().toString().equals(text)) return true;
        if (view instanceof ViewGroup) { ViewGroup group=(ViewGroup)view; for(int i=0;i<group.getChildCount();i++) if(contains(group.getChildAt(i),text)) return true; }
        return false;
    }
}
