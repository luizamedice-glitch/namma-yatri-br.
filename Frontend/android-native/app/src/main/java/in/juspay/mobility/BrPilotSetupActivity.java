package in.juspay.mobility;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.TimeZone;
import java.util.Locale;
import org.json.JSONObject;

/** Operator provisioning for the BR driver pilot, never used by release/passenger. */
public abstract class BrPilotSetupActivity extends Activity {
    private static final String BASE="https://52-67-246-31.sslip.io";
    private boolean busy;
    protected abstract String role();
    private String prefix(){return "YATRI_"+role().toUpperCase(Locale.ROOT);}
    private static boolean enabled(Context c,String role) {
        boolean driver="driver".equals(role);
        return BuildConfig.DEBUG && BuildConfig.BR_TEST_MODE && (driver||BuildConfig.BR_RIDE_PILOT)
            && (driver?"DRIVER":"USER").equals(BuildConfig.MERCHANT_TYPE)
            && (driver?"in.juspay.nammayatripartner.debug":"in.juspay.nammayatri.debug").equals(c.getPackageName());
    }
    private static SharedPreferences prefs(Context c){return c.getSharedPreferences("godel",MODE_PRIVATE);}
    static void openIfNeeded(Activity activity,String role){
        if(!enabled(activity,role))return;
        SharedPreferences p=prefs(activity);String key="YATRI_"+role.toUpperCase(Locale.ROOT);
        long until=p.getLong(key+"_SESSION_UNTIL",0);
        if(p.getString(key+"_SESSION","").matches("[a-f0-9]{64}")&&(until==0||until>System.currentTimeMillis()))return;
        activity.startActivity(new Intent(activity,"driver".equals(role)?BrDriverSetupActivity.class:BrPassengerSetupActivity.class));
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if(!enabled(this,role())){finish();return;}
        getWindow().setStatusBarColor(Color.WHITE);
        getWindow().setNavigationBarColor(Color.WHITE);
        LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);
        int pad=(int)(24*getResources().getDisplayMetrics().density);box.setPadding(pad,pad*2,pad,pad);
        box.setBackgroundColor(Color.WHITE);
        TextView title=new TextView(this);title.setText("driver".equals(role())?"Conectar motorista":"Conectar passageiro");title.setTextSize(26);title.setTextColor(Color.rgb(90,30,80));box.addView(title);
        TextView description=new TextView(this);description.setText("Cole o código de conexão recebido para vincular este celular ao servidor de testes.");description.setTextSize(17);box.addView(description);
        EditText code=new EditText(this);code.setHint("Código de conexão");code.setContentDescription("Código de conexão");
        code.setSingleLine(true);code.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
        code.setSaveEnabled(false);
        if(android.os.Build.VERSION.SDK_INT>=26)code.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
        box.addView(code);
        Button connect=new Button(this);connect.setText("Conectar ao servidor");box.addView(connect);
        TextView status=new TextView(this);status.setTextSize(16);box.addView(status);setContentView(box);
        connect.setOnClickListener(v->{
            if(busy)return;
            String value=code.getText().toString().replaceAll("[\\s-]","").toLowerCase(Locale.ROOT);
            if(!value.matches("[a-f0-9]{32}")){status.setText("Cole o código completo de conexão.");return;}
            busy=true;connect.setEnabled(false);status.setText("Conectando ao servidor…");
            new Thread(()->{
                HttpURLConnection connection=null;
                try{
                    connection=(HttpURLConnection)new URL(BASE+"/v1/"+role()+"/pair").openConnection();
                    connection.setRequestMethod("POST");connection.setConnectTimeout(15000);connection.setReadTimeout(15000);
                    connection.setInstanceFollowRedirects(false);connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json");
                    byte[] payload=new JSONObject().put("code",value).toString().getBytes(StandardCharsets.UTF_8);
                    connection.setFixedLengthStreamingMode(payload.length);
                    try(java.io.OutputStream stream=connection.getOutputStream()){stream.write(payload);}
                    int response=connection.getResponseCode();
                    if(response!=200)throw new IllegalStateException(response==401?"Código inválido, usado ou expirado. Peça um novo código.":"Servidor indisponível. Tente novamente.");
                    ByteArrayOutputStream bytes=new ByteArrayOutputStream();
                    try(InputStream input=connection.getInputStream()){
                        byte[] buffer=new byte[512];int n;
                        while((n=input.read(buffer))!=-1){if(bytes.size()+n>4096)throw new Exception();bytes.write(buffer,0,n);}
                    }
                    JSONObject result=new JSONObject(bytes.toString("UTF-8"));String token=result.getString("token");
                    SimpleDateFormat format=new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",Locale.ROOT);
                    format.setLenient(false);format.setTimeZone(TimeZone.getTimeZone("UTC"));
                    long until=format.parse(result.getString("expiresAt")).getTime();
                    if(!token.matches("[a-f0-9]{64}")||until<=System.currentTimeMillis())throw new Exception();
                    if(!prefs(this).edit().putString(prefix()+"_BACKEND_URL",BASE).putString(prefix()+"_SESSION",token)
                        .putLong(prefix()+"_SESSION_UNTIL",until).commit())throw new Exception();
                    runOnUiThread(()->{if(!isFinishing()){code.setText("");finish();}});
                }catch(Exception e){
                    String message=e instanceof IllegalStateException?e.getMessage():"Não foi possível conectar. Confira a internet e tente novamente.";
                    runOnUiThread(()->{if(!isFinishing()){busy=false;connect.setEnabled(true);status.setText(message);}});
                }finally{if(connection!=null)connection.disconnect();}
            },"driver-connect").start();
        });
    }
}
