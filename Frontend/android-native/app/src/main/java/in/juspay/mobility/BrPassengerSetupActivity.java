package in.juspay.mobility;
import android.app.Activity;
public final class BrPassengerSetupActivity extends BrPilotSetupActivity {
    @Override protected String role(){return "passenger";}
    static void openIfNeeded(Activity activity){BrPilotSetupActivity.openIfNeeded(activity,"passenger");}
}
