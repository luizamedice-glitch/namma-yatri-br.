package in.juspay.mobility;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Movie;
import android.os.SystemClock;
import android.view.View;
import java.io.IOException;
import java.io.InputStream;

/** Local, silent BR opening. No network, player surface or additional dependency. */
@SuppressWarnings("deprecation")
final class BrOpeningView extends View {
    private final Movie movie;
    private final Runnable onComplete;
    private long startedAt = -1;
    private boolean completed;

    BrOpeningView(Context context, Runnable onComplete) throws IOException {
        super(context);
        this.onComplete = onComplete;
        try (InputStream stream = context.getAssets().open("branding/br_abertura.gif")) {
            movie = Movie.decodeStream(stream);
        }
        if (movie == null) throw new IOException("Invalid BR opening animation");
        setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        setContentDescription("AlceYatri Brasil");
    }

    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        canvas.drawColor(Color.rgb(255, 0, 190));
        if (startedAt < 0) startedAt = SystemClock.uptimeMillis();
        long elapsed = SystemClock.uptimeMillis() - startedAt;
        int duration = movie.duration() > 0 ? movie.duration() : 2500;
        movie.setTime((int) Math.min(elapsed, duration - 1));
        float scale = Math.min(getWidth() / (float) movie.width(),
                getHeight() / (float) movie.height());
        canvas.save();
        canvas.translate((getWidth() - movie.width() * scale) / 2f,
                (getHeight() - movie.height() * scale) / 2f);
        canvas.scale(scale, scale);
        movie.draw(canvas, 0, 0);
        canvas.restore();
        if (elapsed < duration) {
            postInvalidateOnAnimation();
        } else if (!completed) {
            completed = true;
            post(onComplete);
        }
    }
}
