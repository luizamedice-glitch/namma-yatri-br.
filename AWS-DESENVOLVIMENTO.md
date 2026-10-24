# Ambiente AWS de desenvolvimento — Alce Yatri Brasil

## Motor de mapas sem autenticação para testes — 2026-10-23

Autorização explícita do proprietário nesta sessão para contornar autenticação
na versão de teste. Serviço `maps-test` separado implantado e validado no run
40002766100: chamadas HTTPS sem Bearer a autocomplete, detalhes e rotas reais
aprovadas. API principal não foi recriada; banco/usuários/sessões preservados.
Caddy agora permite também os três POST `/v1/test/places/autocomplete`,
`/v1/test/places/details` e `/v1/test/routes`; rotas operacionais continuam 403.

Expiração automática em 2026-10-30T18:22:42.727971+00:00. Controles e operação em
`brasil/backend/ops/MAPS-TEST.md`. APK sem sessão compilado no run 40005145677,
fontes `3155e66`; teste Android API 29 aprovado com `places-acceptance.json=passed`:
origem Praça da Sé e destino Av. Paulista reais, coordenadas preservadas e mapa
recentralizado, sem login/OTP/token. Capturas conferidas visualmente com tiles
reais. Evidências 12523888694; APK 12524197861. Corrida completa não foi validada.

## Chave Google aplicada e verificada — 2026-10-23

`GOOGLE_MAPS_SERVER_KEY` configurada no arquivo existente
`/opt/yatri-brasil/secrets/backend.env`, sem exibir o valor. Somente API recriada
para carregar a variável; imagem, banco/volumes, Caddy e portas preservados.
Backup com permissão 600 mantido no diretório de secrets. O procedimento restaura
a configuração anterior e recria a API se a verificação de saúde falhar.

Run https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40000022140
aprovado: API saudável, chave carregada, Places autocomplete 200, Places details
200 com coordenadas e Routes 200 com distância positiva, em consultas reais a
partir do servidor. Envelope RSA-OAEP/SHA-256 e workflow de transferência
removidos após aplicação; nenhuma chave em texto foi registrada em Git/logs.

O bloqueio de chave Google ausente está resolvido. O APK original permanece
pendente de sessão segura, liberação revisada de endpoints e teste Android
de seleção real de origem/destino. Nenhuma rota pública foi liberada nesta etapa.

## Inspeção remota confirmada — 2026-10-23

Acesso SSH como `ubuntu` confirmado via Actions após configurar `AWS_SSH_KEY`
com o PEM original fornecido pelo proprietário (run 39988466255, job
120559029577). Atualização criptografada do secret aprovada no run 39995775818;
não houve exposição de chave privada em código/logs. O workflow temporário de
transferência e seu envelope selado foram removidos da árvore atual.

Inspeção somente leitura no run 39996011605 confirmou: checkout remoto
`113121de63dcfe7c5754e5af495e9711aca32d1d`, API ativa com health OK, PostgreSQL
saudável e Caddy ativo. Banco e convite configurados; contas automáticas
desabilitadas. `GOOGLE_MAPS_SERVER_KEY` ausente na API em execução. Nenhuma
imagem, porta, regra de firewall, arquivo de secrets do servidor ou rota foi alterado.
Próximos passos: configurar a chave Google de servidor e concluir sessão segura
e liberação revisada de endpoints antes de conectar o APK original.

Atualizado em 2026-10-22/23 (horário do Brasil). Registro da implantação conduzida manualmente pelo proprietário; não contém segredos.

## Identificadores públicos

- Repositório: https://github.com/luizamedice-glitch/namma-yatri-br.
- Clone: https://github.com/luizamedice-glitch/namma-yatri-br..git
- Branch de trabalho: `codex/issue-1-purescript-memory` (confirmar HEAD antes de implantar).
- AWS: **Lightsail**, região **São Paulo `sa-east-1`**, zona `sa-east-1a`.
- Instância: `yatri-brasil-dev`, Ubuntu 24.04 LTS, 2 vCPU, **2 GB RAM**, SSD 60 GB.
- IPv4 estático: `52.67.246.31`.
- URL HTTPS provisória: **https://52-67-246-31.sslip.io**.
- Teste público autorizado: **GET https://52-67-246-31.sslip.io/health**.
- Diretório no servidor: `/opt/yatri-brasil`.
- Checkout Git: `/opt/yatri-brasil/projeto` (sparse checkout `brasil/backend`).
- Implantação Docker Compose: `/opt/yatri-brasil/compose.yaml`; backend em `projeto/brasil/backend`.

## Estado reportado da implantação

- Docker 29.1.3 e Compose 2.40.3.
- Contêiner `postgres`: PostgreSQL 16-alpine, volume persistente, healthcheck saudável; não publica a porta 5432.
- Contêiner `api`: Node.js 22 (imagem do Dockerfile existente), migrações executadas antes da inicialização, vinculação ao host somente em `127.0.0.1:8080`.
- `curl http://127.0.0.1:8080/health`: respondeu HTTP 200 com `{"status":"ok","service":"namma-yatri-br"}`.
- Caddy instalado no Ubuntu, proxy HTTPS apontando para `127.0.0.1:8080`.
- Certificado TLS emitido para `52-67-246-31.sslip.io`, conforme logs do Caddy.
- No Caddyfile atual, somente **`/health`** é encaminhado; as demais rotas retornam **403**. Usuário confirmou sucesso nos testes de 200 e 403, sem disponibilizar logs integrais.
- Firewall Lightsail IPv4: 22 (SSH), 80 (HTTP), 443 (HTTPS) liberados. **Auditar/restringir SSH e revisar regras IPv6 antes de qualquer liberação adicional.**
- Não há domínio próprio cadastrado neste ambiente.

## Segurança — NÃO COMITAR

- Senha PostgreSQL local em `/opt/yatri-brasil/secrets/postgres_password`.
- Variáveis sensíveis da API em `/opt/yatri-brasil/secrets/backend.env` (incluem `DATABASE_URL` e `TEST_INVITE_CODE`).
- **Nunca ler, exibir, copiar para PRs, logs, tickets ou mensagens o conteúdo de secrets.**
- `YATRI_DEVELOPMENT_MODE=false` no ambiente inicial; não habilitar contas automáticas sem desenho de segurança. `NODE_ENV=development` reportado; isso **não significa ambiente seguro para exposição pública**.
- `GOOGLE_MAPS_SERVER_KEY` não confirmada. Busca real Places/rotas **não validada**.
- HTTPS válido **não autoriza** abrir cadastro, sessões, GPS, corridas ou SSE ao público sem auditoria dos controles de acesso.
- O IP estático é um identificador público, não uma credencial.
- O Codex **não tem acesso SSH automático à instância** por ler este documento; execução remota exige acesso explicitamente configurado e autorizado pelo proprietário.

## Próximos passos recomendados ao Codex

1. Ler `AGENTS.md`, `PROJECT_STATUS.md`, `ARCHITECTURE.md`, `ROADMAP.md` e este arquivo.
2. Auditar contratos em `brasil/backend/openapi.json`, middleware em `src/http.mjs`, autenticação, autorização por perfil, rate limiting, CORS, migrações e cenários de abuso. Executar testes sem alterar serviço remoto.
3. Preparar testes de integração da API em ambiente isolado e evidências de migrações, persistência e acesso por usuário.
4. Desenhar autenticação de desenvolvimento **sem incorporar segredos estáticos no APK**; aprovar e implementar antes de liberar endpoints.
5. Propor alterações mínimas de Caddy/Compose e procedimentos reversíveis. **Solicitar autorização antes de alterar firewall, secrets, banco de produção ou portas públicas.**
6. Validar HTTPS e rejeição de rotas não autorizadas; integrar primeiro a pesquisa brasileira de endereços ao APK debug, mantendo PureScript/PrestoDOM original.
7. Atualizar a documentação com commits, testes e evidências (não apenas expectativas).

## Comandos de inspeção seguros (somente quando houver acesso ao host)

```bash
cd /opt/yatri-brasil
sudo docker compose ps
sudo docker compose logs --tail 50 api
curl -i --max-time 15 https://52-67-246-31.sslip.io/health
curl -s -o /dev/null -w '%{http_code}\n' https://52-67-246-31.sslip.io/v1/rides
```

**Não executar comandos que imprimam `backend.env`, `postgres_password` ou outros segredos.** A exposição do backend ao app dependerá de liberar rotas autenticadas e configurar a URL na variante brasileira de teste; a URL publicada no GitHub por si só não efetua essa conexão.

## Preparação verificada pelo Codex — 2026-10-23

A consulta externa nesta execução confirmou `/health` 200 e rotas operacionais 403. O estado interno do host e seu commit implantado ainda não foram inspecionados: o ambiente não tem chave SSH/vínculo AWS configurados nem concessão TCP para o host; a conexão do aplicativo AWS exige reautenticação. O proprietário informou que configurará o acesso no ambiente. **Nenhuma atualização remota foi executada.**

Commit preparado: `45f32bdf3a185c2a889ba0bc7f4f8c0d4c2e20e3`. Instruções completas em `brasil/backend/ops/README.md`.

- `ops/deploy-lightsail.sh`: atualiza apenas a imagem `api` no Compose existente, por SHA fixo, sem substituir o checkout do operador. Preserva volumes, arquivos de segredos, portas e Caddy. Migrations precisam ser idênticas às da imagem em execução; caso contrário, interrompe antes da alteração. Inspeciona o banco sem modificar usuários e exige contas automáticas desabilitadas. Em falha, restaura a imagem anterior.
- `src/deployment-check.mjs`: diagnóstico sem valores de credenciais, consulta somente leitura do esquema/migrations e estado de configuração de Google.
- Imagem Docker com etiqueta do commit e `HEALTHCHECK`. CA opcional de proxy de desenvolvimento é montada apenas durante o build, sem desativar TLS.
- Usar `compose.api-image.json` junto ao Compose existente após sucesso; não executar o Compose local de testes no servidor.

Testes: 10 unitários, 3 suítes com PostgreSQL real, inicialização CLI, build Node 22 e troca de imagem em Compose isolado aprovados. Falha intencional de startup provocou rollback; API anterior voltou saudável, contêiner PostgreSQL e dado de teste preservados. Mudança de migration foi rejeitada antes de recriar API. Workflows [backend](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39974516114) e [integração](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39974511131) aprovados. Evidências resumidas: `brasil/backend/reports/lightsail-2026-10-23.json`.

Próximo passo após disponibilizar acesso: inspecionar o host, projeto Compose e bindings sem imprimir segredos; conferir commit/migrations e aplicar a atualização revisada em janela sem viagens. A conexão do APK e eventual liberação externa de endpoints exigem o desenho de sessões e revisão previstos acima; não são consequência automática da atualização da imagem.


## Piloto remoto do motorista — implantado em 2026-10-24

Run **40113362115 aprovado**, fontes `9afffb8eb3bf354e51652b89d1f8a591aa5b2b4e`.
Serviço separado `driver-pilot` em `127.0.0.1:8082`, janela até
**2026-10-31T16:50:03.171005+00:00**. `compose.driver-pilot.json` complementa o
Compose existente; recebe somente DATABASE_URL em arquivo privado, sem chave
Google nem credencial bootstrap. O runtime Node 22 já instalado é reutilizado
somente quando as dependências conferem com o lockfile; fontes atuais em imagem
separada identificada por commit. SQL das migrations precisa ser idêntico;
nenhuma migration ou criação automática de conta é executada na implantação.

Caddy encaminha somente GET `/v1/snapshot` e POST `/v1/driver/location` e
`/v1/driver/availability` ao piloto. Os três retornam 401 sem sessão. A sessão
precisa pertencer ao UUID de Giselo e ao papel driver; outro perfil recebe 403.
Cadastro, login de desenvolvimento e POST de corridas continuam 403 na borda.
Health 200 e IDs dos contêineres API/PostgreSQL/maps-test preservados, confirmados
no servidor; respostas HTTPS também conferidas de fora. Nenhuma porta de firewall
foi alterada. Rollback automático restaura arquivos e Caddy em falha.

**Pendente para operar no APK:** inspeção confirmou Giselo e veículo ausentes,
variáveis do veículo ausentes e zero corridas ativas. Foram solicitados placa,
modelo/cor reais e método de acesso ao Android. Não criar veículo fictício.
`src/provision-driver-pilot.mjs` recebe um arquivo privado com `plate`, `model`,
`color`, cadastra somente Giselo/veículo e rejeita divergência com cadastro já
existente; não cria passageiro nem substitui veículo existente. Após receber
os dados, emitir sessão privada e provisionar o dispositivo; nunca publicar
o arquivo de sessão, incorporar token ao APK ou imprimir os valores.
Aceite Android autenticado contra Lightsail: **NÃO VALIDADO**, aguarda cadastro
e provisionamento. Relatório: `brasil/backend/reports/driver-lightsail-2026-10-24.json`.
