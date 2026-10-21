package br.com.namma.mobilidade;

import android.test.ActivityInstrumentationTestCase2;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

/** Startup smoke test only; does not claim to validate the operational ride flow. */
@SuppressWarnings("deprecation")
public final class LaunchTest extends ActivityInstrumentationTestCase2<MainActivity> {
    public LaunchTest() { super(MainActivity.class); }
    public void testLaunchShowsAuthenticationWithoutHyperSDK() {
        MainActivity activity = getActivity();
        getInstrumentation().waitForIdleSync();
        assertTrue("Login must render without network, Firebase or maps key", contains(activity.getWindow().getDecorView(), "Entre com sua conta de testes"));
        assertTrue(contains(activity.getWindow().getDecorView(), "Entrar"));
        assertFalse(activity.isFinishing());
    }
    public void testPolylineDecoding() {
        var points = MainActivity.decode("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
        assertEquals(3, points.size());
        assertEquals(38.5, points.get(0).latitude, 0.00001);
        assertEquals(-120.2, points.get(0).longitude, 0.00001);
    }
    private boolean contains(View view, String text) {
        if (view instanceof TextView && ((TextView)view).getText().toString().equals(text)) return true;
        if (view instanceof ViewGroup) { ViewGroup group=(ViewGroup)view; for(int i=0;i<group.getChildCount();i++) if(contains(group.getChildAt(i),text)) return true; }
        return false;
    }
}
