package br.com.namma.mobilidade;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.view.WindowInsets;
import android.widget.*;
import com.google.android.gms.maps.*;
import com.google.android.gms.maps.model.*;
import org.json.*;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Independent Brazilian client. No HyperSDK, Firebase, remote assets or Indian endpoints. */
public final class MainActivity extends Activity implements LocationListener {
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final ExecutorService streamWorker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean syncing = new AtomicBoolean();
    private final AtomicBoolean streamRunning = new AtomicBoolean();
    private volatile long lastRefreshAt;
    private volatile boolean foreground;
    private volatile HttpURLConnection stream;
    private String cursor = "0";
    private Typeface originalRegular, originalSemiBold;
    private Api api;
    private SessionStore sessions;
    private GoogleMap map;
    private LocationManager locations;
    private Location gps;
    private JSONObject origin, destination, quote, active;
    private LinearLayout root, panel, tripForm;
    private TextView message, summary;
    private Button originButton, destinationButton, requestButton;
    private final boolean driver = BuildConfig.ROLE.equals("driver");
    private boolean available;
    private boolean locationPermissionRequested;
    private boolean authenticationInProgress;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        originalRegular = Typeface.createFromAsset(getAssets(), "fonts/PlusJakartaSans-Regular.ttf");
        originalSemiBold = Typeface.createFromAsset(getAssets(), "fonts/PlusJakartaSans-SemiBold.ttf");
        sessions = new SessionStore(this);
        api = new Api(BuildConfig.API_URL);
        locations = (LocationManager) getSystemService(LOCATION_SERVICE);
        if (saved != null) {
            try {
                if (saved.containsKey("origin")) origin = new JSONObject(saved.getString("origin"));
                if (saved.containsKey("destination")) destination = new JSONObject(saved.getString("destination"));
            } catch (JSONException ignored) { origin = null; destination = null; }
        }
        provisionDevelopmentSession();
    }
    @Override protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (origin != null) out.putString("origin", origin.toString());
        if (destination != null) out.putString("destination", destination.toString());
    }
    private int dp(int n) { return (int) (n * getResources().getDisplayMetrics().density); }
    private LinearLayout column() { LinearLayout v = new LinearLayout(this); v.setOrientation(LinearLayout.VERTICAL); return v; }
    private TextView label(String value, int size) {
        TextView t = new TextView(this); t.setText(value); t.setTextSize(size); t.setTypeface(originalRegular); t.setTextColor(Color.rgb(20, 43, 39)); t.setPadding(0, dp(5), 0, dp(5)); return t;
    }
    private Button button(String title, LinearLayout parent, Runnable action) {
        Button b = new Button(this); b.setText(title); b.setTypeface(originalSemiBold); b.setAllCaps(false); b.setMinHeight(dp(48));
        parent.addView(b, new LinearLayout.LayoutParams(-1, -2)); b.setOnClickListener(v -> action.run()); return b;
    }
    private EditText field(String hint, LinearLayout parent, boolean password) {
        EditText e = new EditText(this); e.setHint(hint); e.setTypeface(originalRegular); e.setSingleLine(true); e.setTextSize(16);
        e.setInputType(password ? 129 : 1); parent.addView(e, new LinearLayout.LayoutParams(-1, dp(52))); return e;
    }
    private void baseScreen() {
        map = null;
        android.app.Fragment old = getFragmentManager().findFragmentByTag("map");
        if (old != null) { getFragmentManager().beginTransaction().remove(old).commitAllowingStateLoss(); getFragmentManager().executePendingTransactions(); }
        root = column(); root.setPadding(dp(18), dp(8), dp(18), dp(8)); root.setBackgroundColor(Color.rgb(246, 249, 246));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            int top, bottom;
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars()); top = bars.top; bottom = bars.bottom;
            } else { top = insets.getSystemWindowInsetTop(); bottom = insets.getSystemWindowInsetBottom(); }
            view.setPadding(dp(18), dp(8) + top, dp(18), dp(8) + bottom);
            return insets;
        });
        setContentView(root);
        TextView title = label(driver ? "Yatri Brasil — Motorista" : "Yatri Brasil — Passageiro", 24); title.setTypeface(originalSemiBold); root.addView(title);
        root.addView(label(driver ? "Giselo" : "Fagner", 16));
        message = label("", 14); message.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE); root.addView(message);
    }
    // Elementos visuais recuperados da versão Partner; a camada de eventos permanece intacta.
    private ImageView originalStatusIcon(boolean online) {
        ImageView image = new ImageView(this);
        String name = online ? "ic_driver_status_online.png" : "ic_driver_status_offline.png";
        try (java.io.InputStream stream = getAssets().open("original-ui/" + name)) {
            android.graphics.Bitmap bitmap = android.graphics.BitmapFactory.decodeStream(stream);
            if (bitmap != null) image.setImageBitmap(bitmap);
        } catch (java.io.IOException e) {
            android.util.Log.w("YatriBrasil", "Recurso original do status indisponível", e);
        }
        image.setScaleType(ImageView.ScaleType.FIT_CENTER);
        image.setContentDescription(online ? "Motorista disponível" : "Motorista indisponível");
        image.setLayoutParams(new LinearLayout.LayoutParams(dp(42), dp(42)));
        return image;
    }
    private LinearLayout originalRideCard(LinearLayout parent) {
        LinearLayout card = column();
        card.setPadding(dp(16), dp(12), dp(16), dp(16));
        android.graphics.drawable.GradientDrawable shape = new android.graphics.drawable.GradientDrawable();
        shape.setColor(Color.WHITE);
        shape.setCornerRadius(dp(12));
        shape.setStroke(dp(1), Color.rgb(231, 232, 232));
        card.setBackground(shape);
        card.setElevation(dp(3));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.setMargins(dp(0), dp(8), dp(0), dp(10));
        parent.addView(card, params);
        return card;
    }
    private void showMessage(String value) { if (message != null) message.setText(value); }
    interface Work { JSONObject run() throws Exception; }
    interface Done { void run(JSONObject result) throws Exception; }
    private void run(Work job, Done done) {
        run(job, done, null);
    }
    private void run(Work job, Done done, java.util.function.Consumer<String> error) {
        String session = api.token;
        worker.execute(() -> {
            try { JSONObject result = job.run(); ui.post(() -> { if (isDestroyed() || !session.equals(api.token)) return; try { done.run(result); } catch (Exception e) { showMessage("Não foi possível apresentar a resposta do servidor"); } }); }
            catch (Exception e) { ui.post(() -> {
                if (isDestroyed() || !session.equals(api.token)) return;
                if (e instanceof Api.SessionExpired && !api.token.isEmpty()) clearSession();
                String detail = e.getMessage() == null ? "Falha de conexão. Verifique a rede e tente novamente." : e.getMessage();
                if (error != null) error.accept(detail); else showMessage(detail);
            }); }
        });
    }
    private static JSONObject json(Object... pairs) throws JSONException {
        JSONObject o = new JSONObject(); for (int i=0;i<pairs.length;i+=2) o.put((String)pairs[i], pairs[i+1]); return o;
    }
    private void provisionDevelopmentSession() {
        if (authenticationInProgress) return;
        baseScreen();
        root.addView(label("Conectando a conta de " + (driver ? "Giselo" : "Fagner") + "…", 18));
        button("Tentar novamente", root, this::provisionDevelopmentSession);
        if (BuildConfig.DEV_CREDENTIAL.isEmpty() || api.base.isEmpty()) {
            showMessage("Este build está sem a configuração do ambiente de desenvolvimento. É necessário gerar um APK com o endereço do backend e a credencial deste perfil.");
            return;
        }
        authenticationInProgress = true;
        worker.execute(() -> {
            try {
                Api connection = new Api(BuildConfig.API_URL);
                connection.verifyBackend();
                connection.token = sessions.load();
                JSONObject state = null;
                if (!connection.token.isEmpty()) {
                    try { state = connection.request("/v1/snapshot", null); }
                    catch (Api.SessionExpired expired) { connection.token = ""; }
                }
                String expected = driver ? "b1a51100-0000-4000-8000-000000000002" : "b1a51100-0000-4000-8000-000000000001";
                if (state == null || !state.getJSONObject("user").optString("id").equals(expected) || !state.getJSONObject("user").optString("role").equals(BuildConfig.ROLE)) {
                    connection.token = "";
                    JSONObject provisioned = connection.request("/v1/development/session", json("role", BuildConfig.ROLE, "credential", BuildConfig.DEV_CREDENTIAL));
                    JSONObject user = provisioned.getJSONObject("user");
                    if (!user.optString("id").equals(expected) || !user.optString("role").equals(BuildConfig.ROLE)) throw new Exception("O servidor devolveu um perfil incompatível");
                    connection.token = provisioned.getString("token");
                    sessions.save(connection.token);
                }
                String token = connection.token;
                ui.post(() -> {
                    authenticationInProgress = false;
                    if (isDestroyed()) return;
                    api.token = token; homeScreen(); startStream(); refresh();
                });
            } catch (Exception e) {
                ui.post(() -> { authenticationInProgress = false; if (!isDestroyed()) showMessage(e.getMessage() == null ? "Não foi possível conectar ao backend" : e.getMessage()); });
            }
        });
    }
    private void homeScreen() {
        baseScreen();
        // Priorizar o mapa como no HomeScreen do Namma Yatri: área geográfica principal
        // e ações em painel inferior, em vez de dividir a tela igualmente.
        if (!BuildConfig.MAPS_KEY.isEmpty()) {
            FrameLayout host = new FrameLayout(this); host.setId(View.generateViewId()); root.addView(host, new LinearLayout.LayoutParams(-1, 0, 3));
            MapFragment fragment = MapFragment.newInstance(); getFragmentManager().beginTransaction().add(host.getId(), fragment, "map").commit();
            fragment.getMapAsync(g -> { map = g; g.getUiSettings().setMapToolbarEnabled(false); startLocations(); drawMap(); });
        } else root.addView(label("Mapa indisponível: configure GOOGLE_MAPS_API_KEY no build Android.", 14));
        ScrollView scroll = new ScrollView(this); scroll.setFillViewport(false);
        scroll.setBackgroundColor(Color.WHITE);
        LinearLayout body = column(); body.setPadding(dp(16), dp(12), dp(16), dp(16));
        scroll.addView(body);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 2));
        tripForm = column(); body.addView(tripForm);
        if (!driver) {
            originButton = button(origin == null ? "Escolher origem" : origin.optString("address"), tripForm, () -> addressDialog(true));
            button("Usar minha localização como origem", tripForm, this::useGps);
            destinationButton = button(destination == null ? "Para onde você vai?" : destination.optString("address"), tripForm, () -> addressDialog(false));
            // Recupera as medidas do whereToButtonConfig histórico (altura 60dp, raio 8dp).
            android.graphics.drawable.GradientDrawable destinationSurface = new android.graphics.drawable.GradientDrawable();
            destinationSurface.setColor(Color.rgb(250, 250, 250));
            destinationSurface.setCornerRadius(dp(8));
            destinationSurface.setStroke(dp(1), Color.rgb(226, 226, 226));
            destinationButton.setBackground(destinationSurface);
            destinationButton.setGravity(android.view.Gravity.CENTER_VERTICAL | android.view.Gravity.START);
            destinationButton.setPadding(dp(16), 0, dp(12), 0);
            destinationButton.setTextSize(17);
            destinationButton.setTextColor(Color.rgb(44, 47, 58));
            destinationButton.setMinHeight(dp(60));
            // Ícone real da tela PureScript original; compõe o botão nativo sem alterar sua ação.
            try (java.io.InputStream iconStream = getAssets().open("original-ui/ny_ic_bent_right_arrow.png")) {
                android.graphics.Bitmap source = android.graphics.BitmapFactory.decodeStream(iconStream);
                if (source != null) {
                    android.graphics.drawable.BitmapDrawable icon = new android.graphics.drawable.BitmapDrawable(getResources(), source);
                    icon.setBounds(0, 0, dp(21), dp(16));
                    destinationButton.setCompoundDrawables(icon, null, null, null);
                    destinationButton.setCompoundDrawablePadding(dp(17));
                }
            } catch (java.io.IOException ex) {
                android.util.Log.w("YatriBrasil", "Ícone original de destino indisponível", ex);
            }
            button("Calcular rota e estimativa", tripForm, this::calculate);
            summary = label("Defina origem e destino para calcular a rota", 16); tripForm.addView(summary);
            requestButton = button("Solicitar corrida", tripForm, () -> { if (quote != null) { JSONObject selected = quote; run(() -> api.request("/v1/rides", json("quoteId", selected.getString("id"))), r -> { quote = null; refresh(); }); } });
            requestButton.setEnabled(false);
        }
        panel = column(); body.addView(panel);
        button("Histórico de corridas", body, this::history);
        button("Atualizar conexão", body, () -> { refresh(); startStream(); startLocations(); });

        startLocations(); refresh();
    }
    private void clearSession() {
        stopStream(); stopService(new Intent(this, DriverLocationService.class)); locations.removeUpdates(this); sessions.clear(); api.token = ""; cursor = "0"; active = null; quote = null; origin = null; destination = null; available = false; panel = null; provisionDevelopmentSession();
    }
    private void refresh() {
        if (api.token.isEmpty() || !syncing.compareAndSet(false, true)) return;
        lastRefreshAt = SystemClock.elapsedRealtime();
        run(() -> { try { return api.request("/v1/snapshot", null); } finally { syncing.set(false); } }, this::render);
    }
    private void render(JSONObject state) throws Exception {
        if (panel == null || api.token.isEmpty()) return;
        String previous = active == null ? null : active.optString("id");
        JSONArray rides = state.getJSONArray("rides"); active = rides.length() == 0 ? null : rides.getJSONObject(0);
        available = state.optBoolean("available");
        if (driver) {
            if ((available || active != null) && foreground && (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED)) startForegroundService(new Intent(this, DriverLocationService.class));
            else if (!available && active == null) stopService(new Intent(this, DriverLocationService.class));
        }
        panel.removeAllViews();
        tripForm.setVisibility(active != null ? View.GONE : View.VISIBLE);
        if (active != null) {
            String id = active.getString("id"), status = active.getString("status");
            panel.addView(label(statusLabel(status), 21));
            panel.addView(label(active.getJSONObject("origin").getString("address") + " → " + active.getJSONObject("destination").getString("address"), 16));
            panel.addView(label(routeSummary(active.getJSONObject("route"), active.getInt("fare_cents")), 16));
            if (driver) {
                panel.addView(label("Passageiro: " + active.getString("passenger_name"), 18));
                button(status.equals("in_progress") ? "Navegar até o destino" : "Navegar até a origem", panel, () -> navigate(status.equals("in_progress") ? "destination" : "origin"));
                if (status.equals("accepted")) button("Cheguei à origem", panel, () -> action(id, "arrive"));
                if (status.equals("arrived")) button("Iniciar viagem", panel, () -> action(id, "start"));
                if (status.equals("in_progress")) button("Concluir viagem", panel, () -> action(id, "complete"));
            } else if (!active.isNull("driver_id")) {
                panel.addView(label("Motorista: " + active.getString("driver_name") + "\n" + active.getString("model") + " · " + active.getString("color") + " · " + active.getString("plate"), 18));
            }
            if (!status.equals("in_progress")) button("Cancelar corrida", panel, () -> new AlertDialog.Builder(this).setMessage("Cancelar esta solicitação?").setNegativeButton("Voltar", null).setPositiveButton("Cancelar corrida", (d,w) -> action(id, "cancel")).show());
        } else if (driver) {
            LinearLayout statusRow = new LinearLayout(this);
            statusRow.setOrientation(LinearLayout.HORIZONTAL);
            statusRow.setGravity(android.view.Gravity.CENTER_VERTICAL);
            statusRow.addView(originalStatusIcon(available));
            TextView availabilityLabel = label(available ? "Disponível para receber corridas" : "Indisponível", 20);
            availabilityLabel.setTypeface(originalSemiBold);
            LinearLayout.LayoutParams statusTextParams = new LinearLayout.LayoutParams(-1, -2);
            statusTextParams.leftMargin = dp(12);
            statusRow.addView(availabilityLabel, statusTextParams);
            panel.addView(statusRow);
            button(available ? "Ficar indisponível" : "Ficar disponível", panel, () -> {
                if (!available && (gps == null || !fresh(gps))) { showMessage("Aguarde um sinal GPS recente para ficar disponível"); startLocations(); return; }
                boolean target = !available;
                run(() -> {
                    if (target) {
                        Location current = gps;
                        if (current == null || !fresh(current)) throw new Exception("GPS desatualizado. Aguarde uma posição recente e tente novamente.");
                        api.request("/v1/driver/location", json("lat", current.getLatitude(), "lng", current.getLongitude()));
                    }
                    return api.request("/v1/driver/availability", json("available", target));
                }, result -> refresh());
            });
            JSONArray offers = state.getJSONArray("offers");
            if (offers.length() == 0) panel.addView(label("Nenhuma oferta próxima neste momento", 16));
            for (int i=0;i<offers.length();i++) {
                JSONObject offer = offers.getJSONObject(i); String id = offer.getString("id");
                LinearLayout offerCard = originalRideCard(panel);
                TextView offerTitle = label("Nova solicitação", 14);
                offerTitle.setTypeface(originalSemiBold);
                offerCard.addView(offerTitle);
                TextView offerRoute = label(offer.getJSONObject("origin").getString("address") + " → " + offer.getJSONObject("destination").getString("address"), 18);
                offerRoute.setTypeface(originalSemiBold);
                offerCard.addView(offerRoute);
                offerCard.addView(label("Passageiro: " + offer.getString("passenger_name") + "\n" + routeSummary(offer.getJSONObject("route"), offer.getInt("fare_cents")), 16));
                button("Aceitar corrida", offerCard, () -> action(id, "accept"));
                button("Recusar oferta", offerCard, () -> action(id, "reject"));
            }
        }
        if (previous != null && active == null) run(() -> api.request("/v1/rides/" + previous, null), r -> showMessage(statusLabel(r.getString("status"))));
        drawMap();
    }
    private void action(String id, String action) { run(() -> api.request("/v1/rides/" + id + "/" + action, new JSONObject()), r -> { showMessage(r.has("status") ? statusLabel(r.getString("status")) : "Oferta recusada"); refresh(); }); }
    private String statusLabel(String status) {
        return switch (status) { case "searching" -> "Buscando motorista próximo…"; case "accepted" -> "Motorista a caminho"; case "arrived" -> "Motorista chegou"; case "in_progress" -> "Viagem em andamento"; case "completed" -> "Viagem concluída"; case "cancelled" -> "Solicitação cancelada"; default -> status; };
    }
    private String routeSummary(JSONObject route, int cents) {
        return String.format(new Locale("pt", "BR"), "%.1f km · cerca de %d min · R$ %.2f (informativo)", route.optDouble("distanceMeters")/1000, (int)Math.ceil(route.optDouble("durationSeconds")/60), cents/100.0);
    }
    private void history() {
        run(() -> api.request("/v1/rides", null), result -> {
            JSONArray trips = result.getJSONArray("rides"); StringBuilder text = new StringBuilder();
            for (int i=0;i<trips.length();i++) { JSONObject trip = trips.getJSONObject(i); text.append(statusLabel(trip.getString("status"))).append("\n").append(trip.getJSONObject("origin").getString("address")).append(" → ").append(trip.getJSONObject("destination").getString("address")).append("\n\n"); }
            new AlertDialog.Builder(this).setTitle("Histórico").setMessage(text.length() == 0 ? "Nenhuma corrida registrada" : text.toString()).setPositiveButton("Fechar", null).show();
        });
    }
    private void addressDialog(boolean from) {
        LinearLayout content = column(); content.setPadding(dp(16),0,dp(16),0);
        EditText search = field("Digite pelo menos 3 caracteres", content, false);
        TextView status = label("Busque e selecione um endereço", 14); content.addView(status);
        content.addView(label("Google Maps", 14));
        ListView list = new ListView(this); content.addView(list, new LinearLayout.LayoutParams(-1, dp(230)));
        ArrayList<JSONObject> results = new ArrayList<>(); ArrayList<String> titles = new ArrayList<>();
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, titles); list.setAdapter(adapter);
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle(from ? "Origem" : "Destino").setView(content).setNegativeButton("Voltar", null).create();
        final Runnable[] pending = {null}; final int[] generation = {0};
        search.addTextChangedListener(new TextWatcher() {
            public void beforeTextChanged(CharSequence s,int a,int c,int f) {} public void onTextChanged(CharSequence s,int a,int b,int c) {}
            public void afterTextChanged(Editable value) {
                int request = ++generation[0]; if (pending[0] != null) ui.removeCallbacks(pending[0]);
                results.clear(); titles.clear(); adapter.notifyDataSetChanged(); String query = value.toString();
                if (query.trim().length() < 3) { status.setText("Digite pelo menos 3 caracteres"); return; }
                pending[0] = () -> {
                    status.setText("Buscando…");
                    run(() -> api.request("/v1/places/autocomplete", json("input", query)), response -> {
                        if (!dialog.isShowing() || generation[0] != request) return;
                        JSONArray values = response.getJSONArray("suggestions");
                        for (int i=0;i<values.length();i++) { JSONObject place = values.getJSONObject(i); results.add(place); titles.add(place.getString("address")); }
                        adapter.notifyDataSetChanged(); status.setText(values.length() == 0 ? "Nenhum endereço encontrado. Tente outra busca." : "Selecione o endereço correto");
                    }, failure -> { if (dialog.isShowing() && generation[0] == request) status.setText(failure); });
                }; ui.postDelayed(pending[0], 450);
            }
        });
        list.setOnItemClickListener((a,v,index,id) -> {
            if (index >= results.size()) return; JSONObject selected = results.get(index);
            run(() -> api.request("/v1/places/details", json("placeId", selected.getString("placeId"))), response -> {
                JSONObject p = response.getJSONObject("location"); p.put("address", response.getString("address"));
                setPoint(from, p); dialog.dismiss();
            }, failure -> status.setText(failure));
        });
        dialog.setOnDismissListener(d -> { generation[0]++; if (pending[0] != null) ui.removeCallbacks(pending[0]); }); dialog.show();
    }
    private void setPoint(boolean from, JSONObject value) {
        if (from) { origin = value; originButton.setText(value.optString("address")); }
        else { destination = value; destinationButton.setText(value.optString("address")); }
        quote = null; requestButton.setEnabled(false); summary.setText("Calcule a rota com os endereços atualizados"); drawMap();
    }
    private void calculate() {
        if (origin == null || destination == null) { showMessage("Selecione a origem e o destino"); return; }
        JSONObject from = origin, to = destination;
        run(() -> api.request("/v1/quotes", json("origin", from, "destination", to)), response -> {
            if (origin != from || destination != to) return;
            quote = response; summary.setText(routeSummary(response.getJSONObject("route"), response.getInt("fareCents")));
            requestButton.setEnabled(true); drawMap(); showMessage("Rota calculada. Estimativa válida por 5 minutos.");
        });
    }
    private void useGps() {
        startLocations();
        if (gps == null || !fresh(gps)) { showMessage("GPS indisponível. Ative a localização ou pesquise a origem pelo endereço."); return; }
        try { setPoint(true, json("lat", gps.getLatitude(), "lng", gps.getLongitude(), "address", "Localização GPS selecionada")); showMessage("Confira o ponto de origem no mapa"); }
        catch (JSONException e) { showMessage("Localização inválida"); }
    }
    private boolean fresh(Location location) { long age = SystemClock.elapsedRealtimeNanos() - location.getElapsedRealtimeNanos(); return age >= 0 && age < 30000000000L; }
    private void startLocations() {
        if (api.token.isEmpty()) return;
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED && checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            if (!locationPermissionRequested) { locationPermissionRequested = true; requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, 10); }
            else showMessage("Sem permissão de localização. Autorize nas configurações ou pesquise sua origem.");
            return;
        }
        try {
            if (map != null) map.setMyLocationEnabled(true);
            for (String provider : Arrays.asList(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)) {
                if (locations.isProviderEnabled(provider)) {
                    locations.requestLocationUpdates(provider, 5000, 0, this);
                    Location last = locations.getLastKnownLocation(provider);
                    if (last != null && fresh(last) && (gps == null || last.getElapsedRealtimeNanos() > gps.getElapsedRealtimeNanos())) onLocationChanged(last);
                }
            }
        } catch (SecurityException e) { showMessage("Permissão de localização necessária"); }
    }
    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request == 10 && (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED)) startLocations();
        else showMessage("Localização não autorizada. O passageiro pode pesquisar a origem; o motorista precisa de GPS.");
    }
    @Override public void onLocationChanged(Location location) {
        if (!fresh(location)) return;
        boolean firstFix = gps == null; gps = location;
        if (!driver && origin == null && originButton != null) {
            try { setPoint(true, json("lat", location.getLatitude(), "lng", location.getLongitude(), "address", "Localização GPS atual")); }
            catch (JSONException e) { showMessage("Não foi possível selecionar a localização atual"); }
        } else if (firstFix) drawMap();
        // Periodic uploads belong to DriverLocationService: fixed-delay scheduling
        // prevents stale fixes accumulating in the UI request queue while offline.
    }
    @Override public void onProviderDisabled(String provider) { showMessage("GPS desativado. Ative a localização para atualizar sua posição."); }
    @Override public void onProviderEnabled(String provider) { startLocations(); }
    @Override public void onStatusChanged(String provider,int status,Bundle extras) {}
    private LatLng latLng(JSONObject p) throws JSONException { return new LatLng(p.getDouble("lat"), p.getDouble("lng")); }
    private void drawMap() {
        if (map == null) return;
        try {
            if (gps != null && active == null && origin == null && destination == null) map.moveCamera(CameraUpdateFactory.newLatLngZoom(new LatLng(gps.getLatitude(), gps.getLongitude()), 16));
            map.clear(); JSONObject from = active == null ? origin : active.getJSONObject("origin");
            JSONObject to = active == null ? destination : active.getJSONObject("destination");
            LatLngBounds.Builder bounds = new LatLngBounds.Builder(); int count = 0;
            if (from != null) { LatLng p = latLng(from); map.addMarker(new MarkerOptions().position(p).title("Origem")); bounds.include(p); count++; }
            if (to != null) { LatLng p = latLng(to); map.addMarker(new MarkerOptions().position(p).title("Destino").icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_GREEN))); bounds.include(p); count++; }
            JSONObject route = active == null ? quote == null ? null : quote.getJSONObject("route") : active.getJSONObject("route");
            if (route != null) {
                List<LatLng> points = decode(route.getString("encodedPolyline"));
                map.addPolyline(new PolylineOptions().addAll(points).color(Color.rgb(0, 120, 90)).width(dp(4)));
                for (LatLng p : points) { bounds.include(p); count++; }
            }
            if (active != null && !active.isNull("driver_lat") && !active.isNull("driver_lng")) {
                map.addMarker(new MarkerOptions().position(new LatLng(active.getDouble("driver_lat"), active.getDouble("driver_lng"))).title("Última localização do motorista").icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_AZURE)));
            }
            if (count == 1 && from != null) map.moveCamera(CameraUpdateFactory.newLatLngZoom(latLng(from), 15));
            else if (count > 1) { LatLngBounds fitted = bounds.build(); map.setOnMapLoadedCallback(() -> map.moveCamera(CameraUpdateFactory.newLatLngBounds(fitted, dp(40)))); }
        } catch (Exception e) { showMessage("Não foi possível desenhar a rota no mapa"); }
    }
    static List<LatLng> decode(String encoded) {
        List<LatLng> points = new ArrayList<>(); int index=0,lat=0,lng=0;
        while (index < encoded.length()) {
            int[] values = new int[2];
            for(int axis=0;axis<2;axis++) {
                int result=0,shift=0,b;
                do { if(index>=encoded.length() || shift>30) throw new IllegalArgumentException("Polyline inválida"); b=encoded.charAt(index++)-63; result|=(b&31)<<shift; shift+=5; } while(b>=32);
                values[axis]=(result&1)!=0 ? ~(result>>1) : result>>1;
            }
            lat+=values[0]; lng+=values[1]; points.add(new LatLng(lat/1e5,lng/1e5));
        }
        return points;
    }
    private void navigate(String key) {
        try {
            JSONObject p=active.getJSONObject(key);
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("google.navigation:q="+p.getDouble("lat")+","+p.getDouble("lng")+"&mode=d")));
        } catch (Exception e) { showMessage("Instale um aplicativo compatível com navegação Google Maps"); }
    }
    private void startStream() {
        if (api.token.isEmpty() || !foreground || !streamRunning.compareAndSet(false,true)) return;
        streamWorker.execute(() -> {
            try {
                while (foreground && !api.token.isEmpty() && !Thread.currentThread().isInterrupted()) {
                    try {
                        HttpURLConnection connection = api.connection("/v1/events"); stream = connection;
                        connection.setRequestProperty("Last-Event-ID", cursor); connection.setReadTimeout(15000);
                        int status = connection.getResponseCode();
                        if (status == 401) {
                            String rejectedToken = api.token;
                            ui.post(() -> { if (api.token.equals(rejectedToken)) { clearSession(); showMessage("Renovando a sessão de desenvolvimento…"); } });
                            break;
                        }
                        if (status!=200) throw new Exception("Eventos indisponíveis");
                        ui.post(() -> { showMessage("Conectado ao servidor"); refresh(); });
                        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), java.nio.charset.StandardCharsets.UTF_8))) {
                            String line;
                            while (foreground && (line=reader.readLine())!=null) {
                                if (line.startsWith("id: ")) cursor=line.substring(4);
                                if (line.startsWith("data: ")) ui.post(this::refresh);
                                if (line.startsWith(": heartbeat") && SystemClock.elapsedRealtime() - lastRefreshAt > 15000) ui.post(this::refresh);
                            }
                        }
                    } catch (Exception e) { if (foreground && !api.token.isEmpty()) ui.post(() -> showMessage("Reconectando ao servidor…")); }
                    finally { if (stream!=null) stream.disconnect(); stream=null; }
                    if (foreground && !api.token.isEmpty()) Thread.sleep(2000);
                }
            } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            finally { streamRunning.set(false); if(foreground && !api.token.isEmpty()) ui.post(this::startStream); }
        });
    }
    private void stopStream() { if (stream!=null) stream.disconnect(); }
    @Override protected void onResume() { super.onResume(); foreground=true; startStream(); startLocations(); refresh(); }
    @Override protected void onPause() { foreground=false; stopStream(); if(locations!=null) locations.removeUpdates(this); super.onPause(); }
    @Override protected void onDestroy() { foreground=false; stopStream(); worker.shutdownNow(); streamWorker.shutdownNow(); ui.removeCallbacksAndMessages(null); super.onDestroy(); }
}
