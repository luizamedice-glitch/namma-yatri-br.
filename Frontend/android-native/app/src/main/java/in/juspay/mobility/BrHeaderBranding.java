package in.juspay.mobility;

import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;

/** Branding adapter for the original Presto header, only in the BR passenger debug APK. */
final class BrHeaderBranding {
    private BrHeaderBranding() { }

    static void install(View root) {
        if (root == null || !BuildConfig.DEBUG || !BuildConfig.BR_TEST_MODE
                || !"USER".equals(BuildConfig.MERCHANT_TYPE)) return;
        root.getViewTreeObserver().addOnGlobalLayoutListener(() -> resizeHeader(root));
    }

    private static void resizeHeader(View view) {
        float density = view.getResources().getDisplayMetrics().density;
        ViewGroup.LayoutParams params = view.getLayoutParams();
        // Original header contract: 93x32 dp image alongside the Navigation button.
        // Both conditions are required; unrelated images and screens are left alone.
        if (view instanceof ImageView && params != null
                && Math.abs(params.width - Math.round(93 * density)) <= 1
                && Math.abs(params.height - Math.round(32 * density)) <= 1
                && view.getParent() instanceof ViewGroup) {
            ViewGroup logoGroup = (ViewGroup) view.getParent();
            if (logoGroup.getParent() instanceof ViewGroup
                    && hasNavigationButton((ViewGroup) logoGroup.getParent())) {
                int widthDp = view.getResources().getConfiguration().screenWidthDp < 380 ? 116 : 136;
                params.width = Math.round(widthDp * density);
                params.height = Math.round(44 * density);
                view.setLayoutParams(params);
                hideLegacyMenu((ViewGroup) logoGroup.getParent());
                Log.i("YatriBrandHeader", "logo_resized_" + widthDp + "x44dp");
                return;
            }
        }
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) resizeHeader(group.getChildAt(i));
        }
    }

    // The BR footer replaces the old header menu. Retain the original Presto views.
    private static void hideLegacyMenu(View view) {
        CharSequence label = view.getContentDescription();
        if (label != null && ("Navigation : Button".contentEquals(label)
                || "Navegação: botão".contentEquals(label))
                && view.getParent() instanceof View
                && ((View) view.getParent()).getParent() instanceof View) {
            ((View) ((View) view.getParent()).getParent()).setVisibility(View.GONE);
            return;
        }
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) hideLegacyMenu(group.getChildAt(i));
        }
    }

    private static boolean hasNavigationButton(View view) {
        CharSequence label = view.getContentDescription() == null ? "" : view.getContentDescription();
        if ("Navigation : Button".contentEquals(label) || "Navegação: botão".contentEquals(label)) return true;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                if (hasNavigationButton(group.getChildAt(i))) return true;
            }
        }
        return false;
    }
}
