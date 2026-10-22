# Yatri Brasil — matriz inicial de substituição de dependências (22/10/2026)

**Escopo:** auditoria documental, sem alteração de código ou do backend. Branch `auditoria/dependencias-abertas` é independente do trabalho do APK na `codex/issue-1-purescript-memory`.

## Fontes reais no repositório
- `Frontend/android-native/app/build.gradle`: `in.juspay:hypersdk:$jpSDKversion`, `in.juspay:hyperqr:$jpSDKversion`, `in.juspay:hypersmshandler:$jpSDKversion`, sendo `jpSDKversion = '2.1.33-nammayatri.17'`; Firebase, CleverTap, HyperVerge, Google Maps/Places, Freshchat, socket.io.
- `Frontend/android-native/mobility-app/build.gradle`: dependência independente de `in.juspay:hypersdk:2.1.33-nammayatri.17` e Firebase.
- `Frontend/android-native/build.gradle`: repositórios Maven Juspay para HyperSDK e assets.
- `Frontend/PASSAGEIRO-ANDROID-ORIGINAL.md` (branch de trabalho Codex): `MobilityServices`, `v1-assets_downloader.jsa`, `config.json`; existência de um bundle não comprova que foi executado no dispositivo.

## Matriz de candidatos (não equivalência já validada)

| Dependência / função | Candidato aberto | Fonte e licença de referência | Estratégia | Prioridade |
| --- | --- | --- | --- | --- |
| PrestoDOM e DSL PureScript | Preservar a implementação original licenciada, auditar forks `juspay/presto-ui` e `juspay/purescript-presto` | https://github.com/juspay/presto-ui ; https://github.com/juspay/purescript-presto | Reutilizar código permitido; não reescrever telas | Máxima |
| HyperSDK Android, carregador e ponte Juspay | Adaptador próprio Kotlin/Java + runtime PrestoDOM **somente após mapear chamadas e proveniência** | SDK binário: `in.juspay:hypersdk`; verificar permissões/licença do artefato específico | Primeiro inventariar classes, métodos, callbacks, assets, inicialização e referências de rede; implementar compatibilidade de contrato | Máxima |
| HyperQR / leitura QR | ZXing (Java/Android), Apache-2.0 | https://github.com/zxing/zxing | Substituir **somente** funções QR identificadas; não presumir equivalência a HyperQR completo | Média |
| HyperSMSHandler / SMS OTP | APIs Android de SMS/User Consent ou serviço de autenticação no backend | https://developers.google.com/identity/sms-retriever/overview | Adotar após teste e permissões; fluxo OTP pode ficar fora do primeiro APK de teste | Baixa no teste |
| Google Maps SDK / Places | MapLibre Native, BSD-2-Clause, com provedor de tiles; geocodificação separada | https://github.com/maplibre/maplibre-native ; https://github.com/maplibre/maplibre-native/blob/main/platform/android/LICENSE.md | Não trocar no APK inicial; adaptar funções de mapa, busca de endereço e rotas em etapas distintas | Alta posteriormente |
| Firebase analytics, crash, perf, Firestore, auth | Backend Node/PostgreSQL existente; OpenTelemetry para telemetria e Sentry self-hosted como opção (licença própria a auditar) | https://github.com/open-telemetry/opentelemetry-java ; https://github.com/getsentry/sentry | Trocar por função; não prometer substituição 1:1 de Firebase Messaging | Média |
| Firebase Messaging (push) | UnifiedPush + servidor compatível, onde clientes Android suportarem; FCM pode seguir como opção | https://github.com/UnifiedPush | A entrega confiável em segundo plano depende de SO, cliente e distribuidor; validar antes de migrar | Posterior |
| CleverTap campanhas e analytics | PostHog (licenças e recursos específicos a verificar) ou coleta própria por APIs | https://github.com/PostHog/posthog | Não necessário para primeiro APK de teste; retirar só quando chamadas forem identificadas | Baixa |
| Freshchat suporte | Chatwoot (licença do projeto e implantação a verificar) | https://github.com/chatwoot/chatwoot | Adaptar API/tela de suporte; não é drop-in replacement | Baixa |
| HyperVerge KYC | Solução própria/documental sob regras LGPD e verificação profissional, ou fornecedor alternativo | Não selecionar biblioteca de reconhecimento facial automaticamente | Postergar; alto risco regulatório e operacional | Posterior |

## Plano de execução
1. **Congelar referência do APK original**: não modificar a branch Codex enquanto houver build Android em andamento.
2. Gerar inventário real do `Frontend/android-native` com todas as dependências Gradle e cadeia transitiva (`dependencies` e `dependencyInsight` por variante), separando componentes presentes dos *efetivamente chamados*.
3. Buscar referências estáticas a `HyperServices`, `Juspay`, `JBridge`, `hyperqr`, `hypersmshandler`, `MobilityServices`, `v1-assets_downloader.jsa`; relacionar assinaturas e telas de origem.
4. Validar licenças para **cada versão de artefato**; repositório público de um plugin não equivale a licença aberta do binário usado no APK.
5. Criar protótipo de compatibilidade isolado para uma chamada nativa de baixo risco, com testes de equivalência e sem desativar o carregador original prematuramente.
6. Só depois substituir componentes do container um por vez e validar abertura de telas, navegação, ciclo de vida e montagem do APK.
7. Preservar log de atribuições de copyright, NOTICE e obrigações das licenças.

## Critérios para escolha
- Código-fonte auditável e licença comercial/redistribuição compatível.
- Manutenção recente e capacidade de compilar em Android com stack histórica.
- API adaptável aos contratos PureScript/JBridge originais.
- Operação sem conta Juspay ou conexão obrigatória com domínio Juspay.
- Ausência de reescrita generalizada das telas.

**Estado atual:** candidatos preliminares, sem integração ou validação funcional. A existência de alternativa aberta não prova substituição direta.
