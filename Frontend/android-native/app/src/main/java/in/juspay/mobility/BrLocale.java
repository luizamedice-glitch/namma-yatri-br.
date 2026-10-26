package in.juspay.mobility;

import android.content.Context;
import android.content.res.Configuration;
import java.util.Locale;

/** Local app configuration; the device language and other APK flavors are unaffected. */
final class BrLocale {
    private BrLocale() { }
    static Context wrap(Context context) {
        if (!BuildConfig.DEBUG || !BuildConfig.BR_TEST_MODE || !"USER".equals(BuildConfig.MERCHANT_TYPE)
                || !"in.juspay.nammayatri.debug".equals(context.getPackageName())) return context;
        Locale locale = Locale.forLanguageTag("pt-BR");
        Locale.setDefault(locale);
        Configuration config = new Configuration(context.getResources().getConfiguration());
        config.setLocale(locale);
        return context.createConfigurationContext(config);
    }
}
