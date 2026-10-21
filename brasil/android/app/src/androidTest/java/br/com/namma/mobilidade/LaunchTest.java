package br.com.namma.mobilidade;

import android.content.Intent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Startup smoke test only; does not claim to validate the operational ride flow. */
@RunWith(AndroidJUnit4.class)
public final class LaunchTest {
    @Test public void polylineDecoding() {
        var points = MainActivity.decode("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
        assertEquals(3, points.size());
        assertEquals(38.5, points.get(0).latitude, 0.00001);
        assertEquals(-120.2, points.get(0).longitude, 0.00001);
    }
    @Test public void missingServerRequiresConfiguration() throws Exception {
        try { new Api("").verifyBackend(); fail("Sem backend configurado não pode iniciar autenticação"); }
        catch (Exception expected) { assertTrue(expected.getMessage().contains("Configure o servidor")); }
    }
    private boolean contains(View view, String text) {
        if (view instanceof TextView && ((TextView)view).getText().toString().equals(text)) return true;
        if (view instanceof ViewGroup) { ViewGroup group=(ViewGroup)view; for(int i=0;i<group.getChildCount();i++) if(contains(group.getChildAt(i),text)) return true; }
        return false;
    }
}
