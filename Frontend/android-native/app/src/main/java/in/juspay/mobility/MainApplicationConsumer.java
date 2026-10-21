package in.juspay.mobility;

import android.app.Application;
import android.util.Log;

import com.google.android.play.core.splitcompat.SplitCompatApplication;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.analytics.FirebaseAnalytics;

import java.lang.reflect.Method;

public class MainApplicationConsumer extends Application {

    @Override
    public void onCreate() {
        super.onCreate();
        // In debug builds only, provide an offline FirebaseApp container so that
        // original SDK references do not crash before the passenger UI is displayed.
        // These are nonfunctional test IDs, NOT real cloud credentials.
        if (BuildConfig.DEBUG && FirebaseApp.getApps(this).isEmpty()) {
            FirebaseOptions options = new FirebaseOptions.Builder()
                    .setApplicationId("1:123456789012:android:0000000000000000")
                    .setApiKey("AIzaSyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
                    .setProjectId("namma-yatri-br-offline-test")
                    .build();
            FirebaseApp app = FirebaseApp.initializeApp(this, options);
            if (app != null) {
                app.setDataCollectionDefaultEnabled(false);
                FirebaseAnalytics.getInstance(this).setAnalyticsCollectionEnabled(false);
                Log.i("NammaYatriBR", "Firebase local-only debug container initialized; collection disabled");
            }
        }
    }
}
