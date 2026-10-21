package br.com.namma.mobilidade;

import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;

final class Api {
    volatile String token = "";
    String base;
    Api(String base) { this.base = base; }
    JSONObject verifyBackend() throws Exception {
        JSONObject health = request("/health", null);
        if (!"namma-yatri-br".equals(health.optString("service")) || !"ok".equals(health.optString("status"))) {
            throw new Exception("Este endereço não corresponde ao servidor de mobilidade. Confira a configuração.");
        }
        return health;
    }
    HttpURLConnection connection(String path) throws Exception {
        if (base == null || base.trim().isEmpty()) throw new Exception("Configure o servidor de testes antes de entrar. O backend precisa estar em execução.");
        HttpURLConnection c = (HttpURLConnection) URI.create(base + path).toURL().openConnection();
        c.setConnectTimeout(10000); c.setReadTimeout(20000);
        c.setInstanceFollowRedirects(false);
        c.setRequestProperty("Accept", "application/json");
        if (!token.isEmpty()) c.setRequestProperty("Authorization", "Bearer " + token);
        return c;
    }
    JSONObject request(String path, JSONObject body) throws Exception {
        HttpURLConnection c = connection(path);
        try {
            if (body != null) {
                c.setRequestMethod("POST"); c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                try (var stream = c.getOutputStream()) { stream.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
            }
            int status = c.getResponseCode();
            var stream = status < 400 ? c.getInputStream() : c.getErrorStream();
            if (stream == null) throw new Exception("Servidor retornou HTTP " + status);
            String content;
            try (stream; var bytes = new java.io.ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192]; int count;
                while ((count = stream.read(buffer)) != -1) {
                    bytes.write(buffer, 0, count);
                    if (bytes.size() > 2000000) throw new Exception("Resposta do servidor excede o limite");
                }
                content = bytes.toString(StandardCharsets.UTF_8.name());
            }
            JSONObject data = new JSONObject(content);
            if (status == 401) throw new SessionExpired(data.optString("error", "Entre novamente"));
            if (status >= 400) throw new Exception(data.optString("error", "Erro HTTP " + status));
            return data;
        } catch (java.io.IOException e) {
            throw new Exception("Não foi possível conectar a " + base + ". Verifique se o backend está ligado e acessível pelo celular. O endereço 10.0.2.2 funciona somente no emulador.");
        } catch (org.json.JSONException e) {
            throw new Exception("O servidor retornou uma resposta inválida.");
        } finally { c.disconnect(); }
    }
    static final class SessionExpired extends Exception { SessionExpired(String message) { super(message); } }
}
