package in.juspay.mobility;

import android.app.Application;
import android.util.Log;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.analytics.FirebaseAnalytics;

/** ABI compatibility for SDK references; no operational Firebase service in BR driver tests. */
final class BrDriverSdkContainer {
    private BrDriverSdkContainer() { }
    static void initialize(Application application) {
        if (!BuildConfig.DEBUG || !BuildConfig.BR_TEST_MODE || !"DRIVER".equals(BuildConfig.MERCHANT_TYPE)
                || !FirebaseApp.getApps(application).isEmpty()) return;
        // Deliberately nonfunctional IDs, matching the passenger's offline debug container.
        FirebaseOptions options = new FirebaseOptions.Builder()
                .setApplicationId("1:123456789012:android:0000000000000000")
                .setApiKey("AIzaSyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
                .setProjectId("namma-yatri-br-offline-test")
                .build();
        FirebaseApp app = FirebaseApp.initializeApp(application, options);
        if (app != null) {
            app.setDataCollectionDefaultEnabled(false);
            FirebaseAnalytics.getInstance(application).setAnalyticsCollectionEnabled(false);
            Log.i("YatriDriverBR", "Local SDK compatibility container ready; collection disabled");
        }
    }
}
