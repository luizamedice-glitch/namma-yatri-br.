package br.com.namma.mobilidade;

import android.Manifest;
import android.app.*;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.*;
import android.os.*;
import org.json.JSONObject;
import java.util.Arrays;
import java.util.concurrent.*;

/** Maintains GPS reporting during external navigation; no push/Firebase dependency. */
public final class DriverLocationService extends Service implements LocationListener {
    private final ScheduledExecutorService reporter = Executors.newSingleThreadScheduledExecutor();
    private volatile Location latest;
    private LocationManager manager;
    private boolean started;
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (!BuildConfig.ROLE.equals("driver") || (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED && checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED)) {
            stopSelf(); return START_NOT_STICKY;
        }
        NotificationManager notifications = (NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        notifications.createNotificationChannel(new NotificationChannel("driver-location", "Localização do motorista", NotificationManager.IMPORTANCE_LOW));
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification notification = new Notification.Builder(this, "driver-location")
                .setSmallIcon(android.R.drawable.ic_menu_mylocation).setContentTitle("Mobilidade · Motorista")
                .setContentText("Localização ativa. Abra o app para receber e gerenciar corridas.")
                .setContentIntent(open).setOngoing(true).build();
        if (Build.VERSION.SDK_INT >= 29) startForeground(100, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        else startForeground(100, notification);
        if (!started) {
            started = true;
            manager=(LocationManager)getSystemService(LOCATION_SERVICE);
            try {
                for(String provider: Arrays.asList(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)) {
                    if (manager.isProviderEnabled(provider)) manager.requestLocationUpdates(provider, 5000, 0, this);
                }
            } catch (SecurityException e) { stopSelf(); return START_NOT_STICKY; }
            reporter.scheduleWithFixedDelay(this::report, 0, 5, TimeUnit.SECONDS);
        }
        return START_NOT_STICKY;
    }
    private void report() {
        String token = new SessionStore(this).load();
        if (token.isEmpty()) { stopSelf(); return; }
        Location position = latest;
        if (position == null || SystemClock.elapsedRealtimeNanos()-position.getElapsedRealtimeNanos() > 30000000000L) return;
        Api api = new Api(getSharedPreferences("settings",0).getString("api",BuildConfig.API_URL)); api.token=token;
        try {
            JSONObject body = new JSONObject(); body.put("lat",position.getLatitude()); body.put("lng",position.getLongitude());
            api.request("/v1/driver/location",body);
        } catch (Api.SessionExpired e) { stopSelf(); }
        catch (Exception ignored) { /* A failed send never refreshes server-side location_at. Retry next interval. */ }
    }
    @Override public void onLocationChanged(Location location) { latest=location; }
    @Override public void onProviderDisabled(String provider) { latest=null; }
    @Override public void onProviderEnabled(String provider) {
        try { manager.requestLocationUpdates(provider,5000,0,this); } catch (SecurityException ignored) { stopSelf(); }
    }
    @Override public void onStatusChanged(String provider,int status,Bundle extras) {}
    @Override public void onDestroy() {
        reporter.shutdownNow();
        if(manager!=null) manager.removeUpdates(this);
        stopForeground(STOP_FOREGROUND_REMOVE); super.onDestroy();
    }
}
