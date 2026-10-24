package in.juspay.mobility;
import android.app.Activity;
public final class BrDriverSetupActivity extends BrPilotSetupActivity {
    @Override protected String role(){return "driver";}
    static void openIfNeeded(Activity activity){BrPilotSetupActivity.openIfNeeded(activity,"driver");}
}
