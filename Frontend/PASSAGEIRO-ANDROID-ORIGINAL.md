# Montagem do passageiro Android original

**Resultado verificado em 22/10/2026:** o frontend PureScript original foi empacotado num APK Android, instalado no emulador Android 29 e inicializado com seu runtime JOS original. A splash foi encerrada e a interface original de ausência de conexão foi renderizada durante o teste sem rede. Não houve recriação de telas Java nem alterações no backend.

- [Baixar APK de teste em ZIP](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39779316975/artifacts/12426905099).
- [Capturas, hierarquia, CDP e logs sanitizados](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39779316975/artifacts/12425964864).
- [Execução validada](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39779316975).
- [Resumo verificável em JSON](build-reports/passageiro-android/resultado.json).

A integração brasileira, navegação online, autenticação, mapas, Places, Routes e corridas ainda não foram validados neste APK. O idioma e a identidade continuam os da variante histórica. O motorista não foi compilado ou testado nesta etapa.

Esta montagem continua a recuperação documentada em [PURESCRIPT-MEMORIA.md](PURESCRIPT-MEMORIA.md). Usa `ui-customer`, `ui-common` e o container `android-native` históricos; não utiliza as telas Java de `brasil/android` e não modifica o backend.

## Pipeline

O workflow `br-purescript-memory.yml`, no PR #2, executa:

1. Compilação PureScript 0.15.14 com Node 18.20.8 e Spago 0.21.0, usando o cache validado do mesmo PR.
2. Comando original `npm run bundle:android`, com Webpack 4 e Uglify declarados no projeto. O provedor OpenSSL legado é habilitado somente neste processo de build para compatibilidade com Webpack 4 no Node 18.
3. Validação sintática do bundle e publicação de `yatri-passageiro-bundle-original`, com SHA-256.
4. Cópia do bundle para `app/src/user/nammaYatri/assets/juspay/index_bundle.js` e execução do gerador histórico `userJuspayAssets.sh nammaYatri`.
5. Tentativa de `:app:assembleNyUserProdDebug` com Gradle 8.0, AGP 8.0.2 e JDK 17. O modo `-PbrTestMode=true`, já existente na branch, desativa os plugins Firebase sem exigir `google-services.json`.
6. Publicação do APK somente se a compilação concluir; publicação do log Android mesmo em caso de falha.

`GOOGLE_MAPS_API_KEY` é fornecida pelo secret homônimo, quando disponível. O arquivo local gerado no runner usa os valores vazios do `local-temp.properties` histórico; não configura servidores indianos nem inventa um backend acessível. O resultado é um build de depuração da variante histórica, não uma entrega de operação brasileira validada.

## Limites de execução

O container original continua dependendo das bibliotecas nativas HyperSDK 2.1.33-nammayatri.17. Seu `MobilityServices` carrega `v1-assets_downloader.jsa`; `config.json` contém referências históricas a recursos Juspay. Copiar um bundle novo para o APK não comprova que o carregador o executa. A origem efetiva do JavaScript precisa ser verificada em execução antes de atestar a abertura da interface original.

A inicialização também conserva referências Firebase e configurações de merchant. O modo de teste preexistente não comprova isolamento de todos esses serviços. Não foram substituídos por respostas fictícias.

Não existe backend exclusivo de desenvolvimento acessível aos celulares informado nesta sessão. A função Supabase `alce-mobilidade` também atende ao Alce e permanece intocada. Nenhum sucesso de compilação deve ser interpretado como validação de autenticação, mapas, localização, solicitação ou conclusão de corridas.

## Execução iniciada

- Commit inicial desta etapa: `c784507de5f3bb7f03011f88371249ea4bc10b0f`.
- Run: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39712511569
- PureScript e comando npm original: passaram novamente.
- `npm run bundle:android`: passou, 4min22,91s, pico de RSS 4.689.108 KiB (4,47 GiB), código de saída 0.
- Bundle publicado: artefato `yatri-passageiro-bundle-original`, ID `12397574619`.
- SHA-256: `8591e6e33441dad82a1eb3243b8fd89cd0d89ba0a9d0ed80fc14c2ef62f81ad6`.
- O primeiro job Android falhou na preparação do SDK: a action tentou instalar o pacote removido `tools`. Correção: lista explícita `platform-tools platforms;android-34 build-tools;34.0.0`.
- Corrigido também o diretório usado para conferir o SHA-256 baixado: o arquivo contém o caminho relativo `dist/android/index_bundle.js` e deve ser verificado a partir de `ui-customer`.
- Acrescentada verificação de igualdade dos bytes do bundle no APK e medição GNU time da compilação Android.

## APK gerado e conferido

Execução bem-sucedida: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39713548999

- Fontes do build: `6e7add54325287f396d230da1c9ae5f3a56f120a`.
- PureScript, bundle e compilação Android: passaram.
- Variante: `nyUserProdDebug`, pacote `in.juspay.nammayatri.debug`.
- APK: `app-nyUser-prod-debug.apk`, 126.281.483 bytes.
- Artefato: `yatri-brasil-passageiro-original-apk`, ID `12399050340`.
- SHA-256 APK: `021b5608dfdd65d542a260bae936ac53e0392ae3e9b75a416843877c537b709d`.
- O bundle extraído do APK é idêntico ao publicado pelo job PureScript: SHA-256 `8591e6e33441dad82a1eb3243b8fd89cd0d89ba0a9d0ed80fc14c2ef62f81ad6`. Verificação repetida localmente após baixar o artefato.
- Gradle: `BUILD SUCCESSFUL in 2m 51s`, exit 0. O GNU time mediu 2min51,53s. O RSS de 155.344 KiB é do cliente Gradle, não representa o pico total do daemon de compilação.
- O AAPT emitiu seis avisos com texto `string too large to encode using UTF-8 ... STRING_TOO_LARGE`; o build terminou com sucesso. É necessário investigar seu efeito nos recursos e nas capturas.

## Validação de abertura

Foi adicionado `br-passageiro-original-emulator.yml`, que reutiliza um APK previamente compilado, exige igualdade dos fontes Android/PureScript com o build de origem e captura tela, hierarquia e logs no Android 29. O teste inicia sem rede para verificar a abertura sem depender de recursos indianos. Chaves Google são removidas dos logs publicados. Processo ativo não é tratado como prova de interface operacional.

Primeiro teste: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39772477919 . A instalação passou, mas a abertura falhou com `Unable to create application ... The Crashlytics build ID is missing`, durante `FirebaseApp.initializeApp` em `MainApplicationConsumer.java:27`. O processo morreu; as capturas mostram o launcher Android, não a interface do passageiro. Artefato de evidências: `12422882488`.

A correção em validação aplica um manifesto adicional somente ao debug com `-PbrTestMode=true`: remove os registradores de Crashlytics, Sessions, Performance e In-App Messaging e desativa coleta/registro automático. Não cria um build ID fictício. O SDK continua no classpath para compatibilidade com o código histórico. O bootstrap de promoções/CleverTap é desativado nesse modo para não exigir credenciais de analytics. Telas, layouts, componentes PureScript/PrestoDOM e backend permanecem intactos.

O teste de emulador passa a ser chamado pelo mesmo workflow após publicar o APK, garantindo que valide o artefato desta execução. Mesmo um processo ativo ainda exige inspeção das capturas; não comprova fluxo de corridas.

Também foi confirmado que `STRING_TOO_LARGE` existe no XML compilado de Remote Config, para valores históricos longos. A migração desses valores para arquivos não compilados continua pendente; não foi mascarada como fidelidade integral.


## APK com isolamento de telemetria

Execução: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39773571962

- Fontes: `5a2659696ccfbefbff63ca79ee235a29ee4f833c`.
- PureScript, comando npm, bundle e build Android: passaram.
- Gradle: `BUILD SUCCESSFUL in 3m 12s`.
- A verificação do manifesto mesclado confirmou ausência de `CrashlyticsRegistrar` e coleta Crashlytics desativada.
- APK: 126.281.523 bytes, SHA-256 `f91cf480e015bf3a7ed11c0c3045a13c636c9f4da404293097db36cca0a52448`.
- [Artefato APK](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39773571962/artifacts/12423628757), um ZIP contendo `nyUserProd/debug/app-nyUser-prod-debug.apk`.
- O bundle embutido permanece idêntico ao frontend recompilado, SHA-256 `8591e6e33441dad82a1eb3243b8fd89cd0d89ba0a9d0ed80fc14c2ef62f81ad6`. Download e conferência repetidos localmente.
- ABIs incluídas: arm64-v8a, armeabi-v7a, x86 e x86_64. APK debug para Android 7/API 24 ou posterior; não é um APK de publicação em loja.
- O nome, identificador e números de versão continuam os da variante histórica, incluindo sufixo `.debug`. Não foi realizada comparação visual com a versão atual da Play Store.

Resultado: instalação e inicialização fria passaram (8.688 ms para apresentar a Activity), processo ativo por 120 segundos e nenhum `FATAL EXCEPTION`. Os três jobs desta execução concluíram com sucesso. Entretanto, a inspeção visual das quatro capturas confirmou permanência na splash original. Portanto, isso **não** valida a renderização das telas PureScript nem o funcionamento do passageiro. [Capturas e logs](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39773571962/artifacts/12424241976).

O log chega a `initiate_result: SUCCESS` do HyperSDK, mas não registra execução de `INDEX_BUNDLE_START` ou `DUI_READY`. A investigação passa a coletar, por CDP, contextos JavaScript, scripts carregados e mensagens do console do WebView, sem injetar interface ou respostas de APIs. O diagnóstico reutiliza o APK já conferido; não requer recompilar fontes sem alterações.


## Investigação do carregamento local

O diagnóstico CDP inicial chegou ao WebView `about:blank`, mas o coletor usou incorretamente o cliente WebSocket como context manager. O coletor foi corrigido para fechar a conexão com `contextlib.closing`.

O `MobilityServices.java` histórico continha explicitamente o comentário `update index_bundle.js to share apk`, mas continuava carregando o downloader `.jsa`. No modo `BR_TEST_MODE`, o bootstrap passa a carregar o bundle local pelo mesmo `JBridge.loadFileInDUI`; a sequência original de produção é mantida. Essa alteração precisa de validação em execução: não pressupõe que os contextos JOS estejam prontos.

O workflow recebeu a opção `bundle_run_id` para iterar somente no Android, baixando um bundle já compilado. Antes de reutilizá-lo, exige sucesso do job PureScript de origem, igualdade dos fontes/manifestos/configuração PureScript e checksum do bundle. A execução completa permanece o padrão. Isso evita repetir a compilação e minificação quando apenas o bootstrap nativo ou os testes mudam.


## Correção da sequência de runtime

O teste de carregamento direto (`39777289547`, APK `940474c3c2c852caca96ae1b3d23eb48bf7773049789aba01e36728089a59c13`) confirmou execução de `INDEX_BUNDLE_START`, mas o CDP registrou `TypeError: Cannot read property 'self' of undefined` e `josType: undefined`. Portanto, apenas trocar o arquivo da raiz não resolve: o frontend requer o contexto JOS criado pelo runtime original.

A próxima execução restaura essa arquitetura: a raiz inicia `v1-boot_loader.jsa`, fornecido pelo próprio SDK já presente no APK; o runtime cria o iframe da aplicação e seu objeto JOS. O entrypoint `becknbase.html` original é reutilizado num overlay BR, alterando a seleção do script para o `index_bundle.js` recompilado. O payload usa as opções históricas `use_local_assets=true` e `attempt_recovery=false` para não atualizar aplicações de servidores indianos.

Não foi fabricado um objeto JOS, substituída interface ou simulado callback de API. O `boot_loader.js` legível preservado no repositório foi usado como referência da arquitetura; a execução usa a versão do runtime distribuída junto ao SDK, para evitar combinar interfaces de versões diferentes.

O teste foi reforçado: exige a versão do frontend original e seu callback `onEvent'` no contexto JOS, ausência da splash na hierarquia final e controles textuais Android da aplicação. Processo ativo sozinho deixa de ser suficiente para sucesso dessa validação.


## Resultado final da abertura original

A execução `39779316975`, com fontes `ba93999d9daae3472ab70cbd0f37c9af7d94a665`, passou no build nativo e no teste reforçado de renderização. O bundle foi reutilizado da execução `39773571962`, após comprovar igualdade dos fontes PureScript. O build nativo levou 3min13,46s. O RSS registrado pelo GNU time é do cliente Gradle, não do conjunto de processos do build.

O APK final tem 126.281.431 bytes, SHA-256 `75ad87b594614eb821e553a0a05994c4b08215e72e2b8808f7509d3ac149aa4a`. O download foi conferido localmente: bundle e `becknbase.html` correspondem exatamente aos arquivos esperados. Os APKs das tentativas anteriores são evidências de diagnóstico; o link no início deste relatório aponta para o resultado final.

O CDP confirmou um iframe `about:srcdoc`, `JOS.self = in.yatri.consumer`, frontend `3.0.118`, configuração `1.0.0` e callbacks `onEvent` / `onEvent'` definidos. O runtime fornecido pelo SDK identifica-se como `3.6.2-nammayatri.01`. Não foi usado um objeto JOS artificial nem transplantado o bootloader antigo `2.1.3` preservado em `js/juspay`.

A hierarquia final não contém `:id/splash` e inclui os controles originais. As capturas foram inspecionadas: mostram **You're Offline**, o texto original sobre ausência de conexão e **Try Again**. Esse é um resultado de tratamento real de falta de rede, não uma tela criada para o teste. A rede foi desligada intencionalmente; não houve simulação de endereços, rotas, login ou corridas.

### Limitações observadas

- Os valores extensos em Remote Config continuam sujeitos a `STRING_TOO_LARGE` no XML compilado. A migração desses dados para assets permanece pendente.
- O CDP registrou 44 exceções referentes a hooks `onEvent'` e `onSharedPreferenceChanged` ainda indisponíveis durante a inicialização. Elas não encerraram o processo nem impediram a renderização offline; outros estados e transições não foram exercitados.
- Bibliotecas HyperSDK e Firebase permanecem no APK para compatibilidade. Crashlytics, Sessions, Performance e In-App Messaging deixam de se registrar no modo BR; há referências e listeners históricos de Remote Config em outros módulos. Isso não equivale a ter removido toda a dependência desses SDKs.
- O backend brasileiro não foi alterado e não foi conectado ao protocolo histórico dos aplicativos. Não há operação brasileira validada ou sessão Fagner automaticamente provisionada por este APK.
- Não houve validação de mapa, localização física, sugestões de destino, rotas, motorista ou corridas. Nenhum serviço foi implantado publicamente.

### Repetir a montagem

O workflow `br-purescript-memory.yml` executa o caminho completo por padrão. Para iterar apenas no Android com os mesmos fontes PureScript, é possível dispará-lo na branch de trabalho com `bundle_run_id=39773571962`, `aplicativo=passageiro` e `modo=full`. O artefato de origem deve continuar disponível; a retenção configurada é de 14 dias. Se os fontes PureScript mudarem ou o artefato expirar, execute novamente o caminho completo sem `bundle_run_id`.

Para instalar o resultado validado por USB, extraia o ZIP e execute `adb install -r nyUserProd/debug/app-nyUser-prod-debug.apk`. O APK abre a aplicação histórica; não fornece backend brasileiro ou autenticação operacional por si só.
