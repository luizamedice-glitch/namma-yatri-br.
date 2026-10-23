package in.juspay.mobility;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.graphics.Matrix;
import android.graphics.SurfaceTexture;
import android.media.MediaPlayer;
import android.util.AttributeSet;
import android.util.Log;
import android.view.Surface;
import android.view.TextureView;
import android.widget.RelativeLayout;

/** Local video used only by the Brazilian passenger debug layout overlay. */
public final class BrandVideoSplash extends RelativeLayout implements TextureView.SurfaceTextureListener {
    private static final String TAG = "YatriBrandSplash";
    private final TextureView video;
    private MediaPlayer player;
    private Surface surface;
    private Runnable showHome;
    private boolean finished;
    private boolean prepared;
    private int videoWidth;
    private int videoHeight;
    private final Runnable deadline = () -> finishVideo("timeout");

    public BrandVideoSplash(Context context, AttributeSet attrs) {
        super(context, attrs);
        setBackgroundColor(0xFFFD00BB); // Background sampled from the supplied MP4.
        setContentDescription("AlceYatri Brasil");
        setClickable(true);
        video = new TextureView(context);
        video.setOpaque(false);
        video.setAlpha(0f); // Keep the brand background visible until a decoded frame exists.
        addView(video, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT));
        video.setSurfaceTextureListener(this);
    }

    /** The original frontend remains responsible for deciding when Home is ready. */
    public void finishWhenReady(Runnable callback) {
        if (finished) callback.run();
        else showHome = callback;
    }

    @Override protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        postDelayed(deadline, 6000); // A decoder failure must never trap the original UI.
    }

    @Override public void onSurfaceTextureAvailable(SurfaceTexture texture, int width, int height) {
        if (finished) return;
        try {
            player = new MediaPlayer();
            surface = new Surface(texture);
            player.setSurface(surface);
            player.setVolume(0f, 0f);
            player.setLooping(false);
            player.setOnPreparedListener(mp -> {
                prepared = true;
                videoWidth = mp.getVideoWidth();
                videoHeight = mp.getVideoHeight();
                fitVideo();
                if (getWindowVisibility() == VISIBLE) mp.start();
            });
            player.setOnCompletionListener(mp -> finishVideo("completed"));
            player.setOnErrorListener((mp, what, extra) -> {
                finishVideo("decoder_error");
                return true;
            });
            try (AssetFileDescriptor file = getContext().getAssets().openFd("branding/alceyatri_abertura_original.mp4")) {
                player.setDataSource(file.getFileDescriptor(), file.getStartOffset(), file.getLength());
            }
            player.prepareAsync();
        } catch (Exception error) {
            finishVideo("asset_error");
        }
    }

    private void fitVideo() {
        if (videoWidth <= 0 || videoHeight <= 0 || video.getWidth() == 0 || video.getHeight() == 0) return;
        float w = video.getWidth(), h = video.getHeight();
        float scale = Math.min(w / videoWidth, h / videoHeight);
        Matrix transform = new Matrix();
        transform.setScale(videoWidth * scale / w, videoHeight * scale / h, w / 2f, h / 2f);
        video.setTransform(transform); // Fit the entire frame, without cropping or stretching.
    }

    private void finishVideo(String reason) {
        if (finished) return;
        finished = true;
        removeCallbacks(deadline);
        // Leave the final frame visible while the original frontend finishes loading.
        if (player != null && prepared) {
            try { player.pause(); } catch (IllegalStateException ignored) { }
        }
        Log.i(TAG, "video_" + reason);
        if (showHome != null) {
            Runnable callback = showHome;
            showHome = null;
            callback.run();
        }
    }

    @Override protected void onWindowVisibilityChanged(int visibility) {
        super.onWindowVisibilityChanged(visibility);
        if (player == null || !prepared || finished) return;
        try {
            if (visibility == VISIBLE) player.start();
            else player.pause();
        } catch (IllegalStateException ignored) { finishVideo("lifecycle_error"); }
    }

    private void release() {
        if (player != null) { player.release(); player = null; }
        if (surface != null) { surface.release(); surface = null; }
        prepared = false;
    }

    @Override protected void onDetachedFromWindow() {
        removeCallbacks(deadline);
        showHome = null;
        release();
        super.onDetachedFromWindow();
    }

    @Override public boolean onSurfaceTextureDestroyed(SurfaceTexture texture) {
        finishVideo("surface_closed");
        release();
        return true;
    }

    @Override public void onSurfaceTextureSizeChanged(SurfaceTexture texture, int width, int height) { fitVideo(); }
    @Override public void onSurfaceTextureUpdated(SurfaceTexture texture) { video.setAlpha(1f); }
}
