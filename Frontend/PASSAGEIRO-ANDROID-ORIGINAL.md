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
- Nova execução necessária para validar o SDK e o build nativo; ainda não há APK desta montagem.
