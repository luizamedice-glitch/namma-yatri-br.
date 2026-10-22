# Montagem do passageiro Android original

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

Resultado do teste de abertura: pendente de execução e inspeção das capturas.
