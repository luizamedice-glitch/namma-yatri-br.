// SPDX-License-Identifier: AGPL-3.0-or-later
package in.juspay.mobility;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.*;
import android.os.*;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

/** BR pilot only: authenticated GPS and offer checks independent of the WebView.
 * Started by an explicit online action in a resumed Activity. No boot receiver,
 * background Activity launch, legacy Indian endpoints, or automatic ride actions.
 */
public final class BrDriverService extends Service implements LocationListener {
    private static final String TRACKING="yatri_br_tracking",OFFERS="yatri_br_offers";
    private static final int FOREGROUND=47001,OFFER=47002;
    private final Handler main=new Handler(Looper.getMainLooper());
    private final ScheduledExecutorService worker=Executors.newSingleThreadScheduledExecutor();
    private volatile Location latest;
    private volatile boolean closed;
    private LocationManager locations;
    private SharedPreferences prefs,diagnostics;
    private int uploads,snapshots,alerts,errors;
    private String displayedOffer="";

    static boolean enabled(Context c){
        return BuildConfig.DEBUG&&BuildConfig.BR_TEST_MODE&&BuildConfig.BR_RIDE_PILOT
            &&"DRIVER".equals(BuildConfig.MERCHANT_TYPE)
            &&"in.juspay.nammayatripartner.debug".equals(c.getPackageName());
    }
    private boolean authorized(){
        long until=prefs.getLong("YATRI_DRIVER_SESSION_UNTIL",0);
        return enabled(this)&&prefs.getString("YATRI_DRIVER_SESSION","").matches("[a-f0-9]{64}")
            &&(until==0||until>System.currentTimeMillis());
    }
    @Override public void onCreate(){
        super.onCreate();prefs=getSharedPreferences("godel",MODE_PRIVATE);
        diagnostics=getSharedPreferences("yatri_br_tracking_diagnostic",MODE_PRIVATE);
    }
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(!authorized()||ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED){stopSelf();return START_NOT_STICKY;}
        if(locations!=null)return START_NOT_STICKY;
        NotificationManager manager=getSystemService(NotificationManager.class);
        if(Build.VERSION.SDK_INT>=26){
            NotificationChannel tracking=new NotificationChannel(TRACKING,"Motorista online",NotificationManager.IMPORTANCE_LOW);
            tracking.setDescription("Localização compartilhada enquanto online ou em corrida");manager.createNotificationChannel(tracking);
            NotificationChannel offers=new NotificationChannel(OFFERS,"Chamadas de corrida",NotificationManager.IMPORTANCE_HIGH);
            offers.enableVibration(true);offers.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);manager.createNotificationChannel(offers);
        }
        Notification notification=notification(TRACKING,"Motorista online","Compartilhando localização para receber corridas.").setOngoing(true).build();
        try{
            if(Build.VERSION.SDK_INT>=29)startForeground(FOREGROUND,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            else startForeground(FOREGROUND,notification);
            locations=(LocationManager)getSystemService(LOCATION_SERVICE);
            for(String provider:new String[]{LocationManager.GPS_PROVIDER,LocationManager.NETWORK_PROVIDER}){
                if(locations.isProviderEnabled(provider)){
                    locations.requestLocationUpdates(provider,5000,0,this,Looper.getMainLooper());
                    Location known=locations.getLastKnownLocation(provider);if(known!=null)onLocationChanged(known);
                }
            }
            diagnostics.edit().putBoolean("stopped",false).apply();record("running");worker.scheduleWithFixedDelay(this::tick,0,5,TimeUnit.SECONDS);
        }catch(RuntimeException ignored){record("permission_or_start_error");stopSelf();}
        return START_NOT_STICKY;
    }
    private NotificationCompat.Builder notification(String channel,String title,String text){
        Intent open=new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content=PendingIntent.getActivity(this,0,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this,channel).setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle(title).setContentText(text).setContentIntent(content)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setCategory(NotificationCompat.CATEGORY_SERVICE);
    }
    private boolean fresh(Location location){
        return location!=null&&(SystemClock.elapsedRealtimeNanos()-location.getElapsedRealtimeNanos())/1000000L<30000
            &&location.getLatitude()>=-90&&location.getLatitude()<=90&&location.getLongitude()>=-180&&location.getLongitude()<=180
            &&(location.getLatitude()!=0||location.getLongitude()!=0);
    }
    @Override public void onLocationChanged(Location location){
        if(fresh(location)&&(latest==null||!fresh(latest)||location.getElapsedRealtimeNanos()>=latest.getElapsedRealtimeNanos()))latest=new Location(location);
    }
    private void tick(){
        if(closed)return;
        if(!authorized()){halt("session_expired");return;}
        try{
            Location point=latest;boolean fresh=fresh(point);
            if(fresh){call("/driver/location",new JSONObject().put("lat",point.getLatitude()).put("lng",point.getLongitude()));uploads++;}
            JSONObject snapshot=call("/snapshot",null);snapshots++;
            if(!"driver".equals(snapshot.getJSONObject("user").getString("role"))){halt("invalid_role");return;}
            JSONArray rides=snapshot.getJSONArray("rides"),offers=snapshot.getJSONArray("offers");
            if(fresh&&!snapshot.optBoolean("available")&&rides.length()==0){halt("offline");return;}
            NotificationManager manager=getSystemService(NotificationManager.class);
            String offer=offers.length()>0?offers.getJSONObject(0).getString("id"):"";
            if(!offer.equals(displayedOffer)){
                if(!offer.isEmpty()){
                    // Persist only deduplication ID, never passenger/route data or credentials.
                    String previous=diagnostics.getString("lastOffer","");
                    if(!offer.equals(previous)){
                        manager.notify(OFFER,notification(OFFERS,"Nova solicitação de corrida","Abra o AlceYatri para consultar e aceitar.")
                            .setCategory(NotificationCompat.CATEGORY_EVENT).setPriority(NotificationCompat.PRIORITY_HIGH)
                            .setAutoCancel(true).setTimeoutAfter(600000).build());
                        alerts++;diagnostics.edit().putString("lastOffer",offer).apply();
                    }
                }else manager.cancel(OFFER);
                displayedOffer=offer;
            }
            manager.notify(FOREGROUND,notification(TRACKING,rides.length()>0?"Corrida em andamento":"Motorista online",
                fresh?"Compartilhando localização. Toque para abrir.":"GPS sem atualização. Ative a localização do celular.").setOngoing(true).build());
            record(fresh?"running":"waiting_gps");
        }catch(Unauthorized ignored){halt("session_rejected");}
        catch(Exception ignored){errors++;record("reconnecting");}
    }
    private JSONObject call(String path,JSONObject body)throws Exception{
        URI base=new URI(prefs.getString("YATRI_DRIVER_BACKEND_URL",""));String host=base.getHost();
        boolean local=host!=null&&host.matches("localhost|127\\.0\\.0\\.1|10\\.[0-9.]+|192\\.168\\.[0-9.]+|172\\.(1[6-9]|2[0-9]|3[01])\\.[0-9.]+");
        if(host==null||base.getUserInfo()!=null||base.getQuery()!=null||base.getFragment()!=null||
            !("https".equals(base.getScheme())||"http".equals(base.getScheme())&&local)||!Arrays.asList("","/").contains(base.getPath()))throw new Unauthorized();
        HttpURLConnection connection=(HttpURLConnection)new URL(base.toString().replaceAll("/$","")+"/v1"+path).openConnection();
        try{
            connection.setConnectTimeout(8000);connection.setReadTimeout(8000);connection.setInstanceFollowRedirects(false);
            connection.setRequestMethod(body==null?"GET":"POST");connection.setRequestProperty("Authorization","Bearer "+prefs.getString("YATRI_DRIVER_SESSION",""));
            if(body!=null){
                connection.setRequestProperty("Content-Type","application/json");connection.setDoOutput(true);
                byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);connection.setFixedLengthStreamingMode(bytes.length);
                try(OutputStream output=connection.getOutputStream()){output.write(bytes);}
            }
            int status=connection.getResponseCode();if(status==401||status==403)throw new Unauthorized();
            if(status!=200)throw new IOException();
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();
            try(InputStream input=connection.getInputStream()){
                byte[] buffer=new byte[4096];int n;
                while((n=input.read(buffer))!=-1){if(bytes.size()+n>262144)throw new IOException();bytes.write(buffer,0,n);}
            }
            return new JSONObject(bytes.toString("UTF-8"));
        }finally{connection.disconnect();}
    }
    private static final class Unauthorized extends Exception{}
    private void record(String state){diagnostics.edit().putString("state",state).putInt("uploads",uploads).putInt("snapshots",snapshots)
        .putInt("notifications",alerts).putInt("errors",errors).putLong("observedAt",System.currentTimeMillis()).apply();}
    private void halt(String reason){record(reason);main.post(this::stopSelf);}
    @Override public void onDestroy(){
        closed=true;worker.shutdownNow();if(locations!=null)locations.removeUpdates(this);
        getSystemService(NotificationManager.class).cancel(OFFER);stopForeground(true);
        diagnostics.edit().putBoolean("stopped",true).apply();super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent){return null;}
    @Override public void onProviderEnabled(String provider){}
    @Override public void onProviderDisabled(String provider){}
    @Override public void onStatusChanged(String provider,int status,Bundle extras){}
}
