# Recuperação operacional — 25/10/2026

Fonte de execução `f585ad66f82e12c230f3b2f627333560ba96aa28`. Pagamentos,
Firebase e autenticação definitiva adiados pelo proprietário. Sessões/perfis
atuais preservados. Sem migrations ou novas dependências.

## Comportamento

Repetir chegada/início/conclusão/cancelamento no estado de destino confirma
a gravação sem incrementar versão/eventos. Autorização é verificada antes
do reconhecimento. Comandos de outra etapa continuam recusados; reenvios
da mesma cotação recuperam a mesma corrida. A atribuição permanece exclusiva.

Snapshot distingue `online` (escolha persistida) de `available` (elegibilidade,
incluindo GPS recebido há menos de 60 s). Perda de GPS não apaga a escolha nem
mantém ofertas elegíveis com posição antiga. Driver.js usa a intenção para
manter o serviço; BrDriverService recupera rede/provedores e indica “GPS sem
atualização” ou “Sem conexão com o servidor” na notificação permanente.

## Backend

Falha reproduzida antes da correção: resposta truncada após COMMIT de chegada,
reinício de Node e repetição retornavam 409. `test/recovery.test.mjs` usa API
HTTP em processo filho e PostgreSQL real: trunca a resposta real após COMMIT,
encerra Node com SIGKILL, reinicia e repete pedido/aceite/chegada/início/conclusão/
cancelamento. Verifica IDs/status/versões/eventos, reenvios concorrentes e recusa
de terceiros. Google é fixture declarada nesse teste; não comprova Google/Android.

Dezessete testes unitários de backend, quatro suítes PostgreSQL e contratos de
piloto/clientes passaram localmente e no CI. Dezesseis testes de adaptador/mapa
aprovados no build Android. PostgreSQL local temporário encerrado após os testes.

Implantação [40236965537](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40236965537)
aprovada, revisão `f585ad66f82e`, sem corrida ativa durante a troca. API principal,
PostgreSQL e maps-test preservados; sem provisionar contas/veículos, alterar
portas ou renovar a janela até `2026-10-31T18:16:18.740028+00:00`.
Fronteira de autorização e rotas não relacionadas verificadas pelo deploy.

## Android

Build [40236963482](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40236963482)
aprovado, APK artefato `12615302753`. Gradle 3 min 47 s; PureScript reaproveitado
após comparação estrita, FFI/bundle atualizados.

- SHA256 APK: `bd01032f34172576c0b279350da26faad006abae5b451effdcc98a7cddd2043f`.
- SHA256 ZIP: `9c45893a1365cd4ab519b322a2ba40bb31b4fca2725dbe5f242bad9b0b1fd760`.
- API 36/Android 16: run `40237490959` aprovado, evidência `12615303630`;
  24 uploads/36 snapshots, um alerta, um erro intencional do corte e zero fatal.
- API 29/Android 10: run `40238396498` aprovado, evidência `12615844008`;
  mesmos bytes, 31 uploads/43 snapshots, um alerta, um erro intencional e zero fatal.
- Serviço parado ao final em ambos; cinco casos passaram sem recriar o PID:
  corte TCP/retorno da rede, GPS desligado até vencer as janelas de 30/60 s e
  reativado, chamada/notificação com tela bloqueada, toque/aceite na view original
  e parada offline. Posição conferida pela sessão passageiro na API, sem segundo
  APK passageiro nesse roteiro. Sensor emulado, sem GPS injetado por HTTP/CDP.
  Rotas Google reais; nenhuma corrida de teste criada no Lightsail.

API 29 `40237493320` passou rede/GPS, mas SystemUI não reportou idle ao dump XML.
Somente a automação mudou: PNG preservado e fallback restrito ao Pixel 2/API 29,
após conferir notificação real (pacote/ID/título), tocando a primeira chamada.
Captura final inspecionada: (540,634) pertence à chamada; aceite posterior
confirmou oferta/aceite e mesmo PID. Sem novo APK/deploy para esse ajuste.

Ativação privada motorista `40237536697`, uso único até
`2026-10-26T21:52:54.398Z`, fora do Git e não consumida. Atualizar somente motorista.

## Limites

Proprietário confirmou a versão anterior operacional. Esta recuperação nova
ainda requer confirmação física. API/PostgreSQL isolados, permissões concedidas
pelo instalador de testes. Não comprova 30–60 minutos de Doze/OEM, falha do próprio
PostgreSQL, recuperação de backup, GPS em rua ou carga de usuários no Lightsail.
Sessões de piloto continuam temporárias; não é homologação de produção.
