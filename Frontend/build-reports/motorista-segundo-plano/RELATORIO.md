# Motorista — GPS e chamadas em segundo plano

## Escopo autorizado

Proprietário autorizou um caminho de teste sem Firebase nesta etapa.
`BrDriverService` usa foreground service Android do tipo `location` enquanto
o motorista está online ou em corrida. O serviço publica GPS real e consulta
ofertas nas rotas autenticadas existentes. Gera notificação Android de chamada,
sem aceitar corrida automaticamente. Firebase continua para uma etapa posterior.

Este é um serviço nativo de localização com alerta obtido por consulta periódica;
não é push remoto FCM. Não desperta um aplicativo forçado a parar nas configurações
do Android. Não inicia por boot, não compartilha GPS offline em segundo plano
sem corrida ativa e não abre Activities automaticamente. O usuário inicia pelo botão de disponibilidade;
uma notificação permanente informa o compartilhamento em segundo plano.

## Arquivos

- `Frontend/android-native/app/src/main/java/in/juspay/mobility/BrDriverService.java`:
  LocationManager, worker HTTP separado do WebView, canais e notificações.
- `Frontend/android-native/mobility-driver/src/main/java/in/juspay/mobility/driver/MobilityDriverBridge.java`:
  autorização nativa, permissões por ação explícita e início/parada do serviço.
- `Frontend/android-native/app/src/driver/nammaYatriPartner/AndroidManifest.xml`:
  serviço não exportado, habilitado somente com recurso do piloto.
- `Frontend/ui-driver/src/Development/Driver.js`:
  coordenação com disponibilidade/viagem, GPS sem publicação duplicada pelo
  WebView, retomada ao recuperar foco/rede. Telas/contratos PureScript intactos.
- `Frontend/scripts/test-driver-background.py` e
  `.github/workflows/br-driver-background.yml`: build e aceite reproduzível.

## Proteções

Guard em Java exige build debug BR/piloto, pacote motorista e sessão privada;
manifest desabilita o serviço em produção. Permissionamento de localização
precisa e notificações acontece no botão online. A retomada periódica não
repete prompts. O serviço não expõe componente externo nem depende de OTP,
login público, Firebase legado ou dos endpoints operacionais indianos.

GPS com no máximo 30 segundos; posição antiga não é republicada como nova.
HTTP com timeout, limite de corpo e redirects desativados; sessão/URL apenas
em armazenamento privado. Não salva coordenadas/histórico nem imprime respostas.
Ofertas deduplicadas por ID privado e canceladas quando saem do snapshot.
Notificação usa texto genérico com visibilidade privada, sem passageiro/endereço.
401/403 e expiração local encerram o serviço; falhas transitórias permitem
nova consulta. Offline sem corrida encerra o compartilhamento.
Notificação permanente só é atualizada quando muda o texto; chamadas não
repetem alertas a cada consulta. Notificações são despachadas na thread principal
com guard de encerramento, impedindo respostas tardias de recriar avisos após parar.

## Build e aceite

PureScript foi reaproveitado do cache `40143012209` após comparar
todas as fontes/configurações do motorista e ui-common com `5900d9a2ab53`,
excetuando os três JavaScript explícitos e mantendo as assinaturas FFI.
Não é permitido reutilizar APK quando o código nativo mudar.

16 testes Node aprovados, incluindo bloqueio da disponibilidade sem permissão,
propriedade nativa do GPS, continuidade após fechar a tela e preservação da
variante debug antiga sem o serviço de piloto.

- APK final: fontes `61d9290c43f531b97211692d4724283f276f2082`, build
  [40222415126](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40222415126),
  aprovado; artefato `12609817713`.
- SHA256 APK: `68931dfa6d1c73922e909d8e86c5fe2f400bc83977cdcb430bd62714675834e7`.
- SHA256 ZIP: `3beef757257004c4098c95f9ce88dafc3039acc2bd78f55c38cf8ed7a587caa8`.
- Android 16/API 36: [40222825183](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40222825183)
  aprovado; evidência `12609688521`, 15 uploads/15 snapshots, um alerta, zero
  erros nativos/fatais; serviço parado no final.
- Android 10/API 29: [40222827520](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40222827520)
  aprovado; evidência `12609579193`, 22 uploads/22 snapshots, um alerta, zero
  erros nativos/fatais; serviço parado no final. Mesmo SHA256 do Android 16.
- Capturas conferidas: chamada na área de notificações e oferta original com
  mapa/rota Google e botões Aceitar/Recusar.

Ambos os aceites usaram API/PostgreSQL isolados, GPS do emulador com Activity
parada e tela bloqueada, oferta real, notificação deduplicada, toque que abre
a oferta e aceite pelo app sem recriar o processo. Uma segunda posição foi
consultada pela sessão passageiro na API; não houve segundo APK passageiro
em execução nesse roteiro. Foram confirmados seis uploads nativos durante
o bloqueio, GPS recebido pela API após o aceite e parada ao ficar offline.
Sem debugger/CDP para acordar JavaScript, sem GPS injetado por HTTP. Sensor
emulado fornece uma posição fresca a cada 5 s. Rotas usam Google real.
Nenhuma corrida dessa validação foi criada no Lightsail. Permissões de runtime
foram concedidas pelo instalador do emulador; o pedido interativo precisa de
confirmação no aparelho físico.

O build final reaproveitou somente o bundle embutido no APK `40221057214`,
após exigir build aprovado e fontes completas dos frontends idênticas.
Zero execução de npm/PureScript na revisão nativa; Gradle 3 min 55 s.
O APK antigo não foi reutilizado após alterar Java. A revisão anterior
`77fcbb481c` passou no Android 16 (`40221627217`); no Android 10, GPS/alerta
passaram, mas o dump de SystemUI não encontrou idle (`40221629956`). A
notificação permanente era atualizada a cada consulta; a revisão final
remove essa repetição e passou no mesmo roteiro, sem alterar a automação.

Ativação privada motorista emitida em `40220103819`, uso único até
`2026-10-26T18:12:18.992Z`. Apenas emissão de código, sem deploy/provisionamento;
arquivo privado fora do Git e sem consumo do código na validação.

## Continuação

Instalar somente o motorista e validar no celular físico. O APK
passageiro Geoapify atual permanece compatível; nenhuma atualização de servidor
é necessária para este transporte. Validação física, economia de bateria de
fabricantes e Firebase/push remoto são critérios distintos; o piloto não
homologa esses cenários automaticamente. Após “Forçar parada” nas configurações
do Android é necessário reabrir o aplicativo; Firebase também não remove esse
limite do sistema operacional.
