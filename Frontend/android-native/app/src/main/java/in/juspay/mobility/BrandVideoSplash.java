package in.juspay.mobility;

import android.content.Context;
import android.util.AttributeSet;
import android.util.Log;
import android.widget.RelativeLayout;
import java.io.IOException;

/** BR passenger opening derived from the original video, with a uniform pink canvas. */
public final class BrandVideoSplash extends RelativeLayout {
    private Runnable showHome;
    private boolean finished;

    public BrandVideoSplash(Context context, AttributeSet attrs) {
        super(context, attrs);
        setBackgroundColor(0xFFFF00BE);
        setClickable(true);
        try {
            addView(new BrOpeningView(context, () -> finishOpening()),
                    new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT));
        } catch (IOException error) {
            finished = true;
            Log.e("YatriBrandSplash", "opening_asset_error", error);
        }
    }

    public void finishWhenReady(Runnable callback) {
        if (finished) callback.run();
        else showHome = callback;
    }

    private void finishOpening() {
        if (finished) return;
        finished = true;
        Log.i("YatriBrandSplash", "opening_completed");
        if (showHome != null) {
            Runnable callback = showHome;
            showHome = null;
            callback.run();
        }
    }

    @Override protected void onDetachedFromWindow() {
        showHome = null;
        super.onDetachedFromWindow();
    }
}
