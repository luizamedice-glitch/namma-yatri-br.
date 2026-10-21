package br.com.namma.mobilidade;

import android.Manifest;
import android.content.Intent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.UUID;
import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

/** Real Android UI -> Node HTTP -> PostgreSQL. No substitute API or fake users. */
@RunWith(AndroidJUnit4.class)
public final class BackendConnectionTest {
    @Test public void registerSnapshotAndLogoutThroughNativeApp() throws Exception {
        String invite = InstrumentationRegistry.getArguments().getString("BR_TEST_INVITE", "");
        assumeTrue("Integração Android requer backend local de testes e BR_TEST_INVITE", !invite.isEmpty());
        var instrumentation = InstrumentationRegistry.getInstrumentation();
        var context = instrumentation.getTargetContext();
        new SessionStore(context).clear();
        for (String permission : new String[]{Manifest.permission.ACCESS_COARSE_LOCATION,Manifest.permission.ACCESS_FINE_LOCATION}) {
            try (var descriptor = instrumentation.getUiAutomation().executeShellCommand("pm grant " + context.getPackageName() + " " + permission)) {
                new java.io.FileInputStream(descriptor.getFileDescriptor()).read(new byte[256]);
            }
        }
        MainActivity activity = (MainActivity)instrumentation.startActivitySync(new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        try {
            instrumentation.runOnMainSync(() -> {
                View root=activity.getWindow().getDecorView();
                edit(root,"Email").setText(UUID.randomUUID()+"@android.teste.local");
                edit(root,"Senha (mínimo de 10 caracteres)").setText("android-test-password-123");
                edit(root,"Nome").setText("Conta Android de teste");
                edit(root,"Código de convite").setText(invite);
                if(BuildConfig.ROLE.equals("driver")) {
                    edit(root,"Placa (ABC1D23)").setText("TST1A23");
                    edit(root,"Modelo do veículo").setText("Veículo de teste Android");
                    edit(root,"Cor do veículo").setText("Prata");
                }
                TextView create=findText(root,"Criar conta de "+(BuildConfig.ROLE.equals("driver")?"motorista":"passageiro"));
                assertNotNull(create); create.performClick();
            });
            await(activity,"Histórico de corridas");
            Api api=new Api(BuildConfig.API_URL); api.token=new SessionStore(context).load();
            assertFalse("Sessão real deve existir no Keystore",api.token.isEmpty());
            var snapshot=api.request("/v1/snapshot",null);
            assertEquals(BuildConfig.ROLE,snapshot.getJSONObject("user").getString("role"));
            assertEquals("Conta Android de teste",snapshot.getJSONObject("user").getString("name"));
            instrumentation.waitForIdleSync();
            Thread.sleep(500);
            // Shell-owned shared path survives the runner uninstalling the target app.
            try (var descriptor=instrumentation.getUiAutomation().executeShellCommand("screencap -p /sdcard/br-"+BuildConfig.ROLE+"-home.png");
                 var output=new java.io.FileInputStream(descriptor.getFileDescriptor())) {
                byte[] buffer=new byte[256]; while(output.read(buffer)!=-1) { /* Drain command output. */ }
            }
            instrumentation.runOnMainSync(() -> findText(activity.getWindow().getDecorView(),"Sair").performClick());
            await(activity,"Entre com sua conta de testes");
            try { api.request("/v1/snapshot",null); fail("Logout precisa revogar a sessão no servidor"); }
            catch(Api.SessionExpired expected) { /* Real server rejected the revoked token. */ }
        } finally {
            new SessionStore(context).clear(); instrumentation.runOnMainSync(activity::finish);
        }
    }
    private void await(MainActivity activity,String text) throws Exception {
        var instrumentation=InstrumentationRegistry.getInstrumentation();
        for(int i=0;i<100;i++) {
            boolean[] found={false};
            instrumentation.runOnMainSync(() -> found[0]=findText(activity.getWindow().getDecorView(),text)!=null);
            if(found[0]) return; Thread.sleep(200);
        }
        fail("Tela esperada não apareceu: "+text);
    }
    private EditText edit(View view,String hint) {
        if(view instanceof EditText && hint.contentEquals(((EditText)view).getHint())) return (EditText)view;
        if(view instanceof ViewGroup) { ViewGroup group=(ViewGroup)view; for(int i=0;i<group.getChildCount();i++) { EditText found=edit(group.getChildAt(i),hint); if(found!=null)return found; } }
        return null;
    }
    private TextView findText(View view,String text) {
        if(view instanceof TextView && text.contentEquals(((TextView)view).getText())) return (TextView)view;
        if(view instanceof ViewGroup) { ViewGroup group=(ViewGroup)view; for(int i=0;i<group.getChildCount();i++) { TextView found=findText(group.getChildAt(i),text); if(found!=null)return found; } }
        return null;
    }
}
