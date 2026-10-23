# Identidade Alce Yatri Brasil

## Pacote anterior (histórico)

Recursos recebidos em `yatri-identidade-android.zip`. Os oito PNGs são preservados sem recorte, recompressão ou recriação. `sha256.json` permite verificar a integridade.

Aplicação no Android original: `Frontend/android-native/app/src/brTest/res`, carregado somente com `-PbrTestMode=true` e build `debug`. Os ícones de 48/72/96/144/192 pixels correspondem a mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi. Android 8+ usa ícone adaptativo com margem de segurança e a imagem fornecida de 512 pixels. O logotipo substitui os recursos locais usados pelo cabeçalho original; a imagem vertical é exibida na abertura com `fitCenter`, sem deformação. IDs de splash e callback Lottie são preservados.

Os layouts operacionais PureScript, navegação, backend e recursos de produção não são alterados. A imagem completa tem texto pequeno no cabeçalho de 93×32 dp original; eventual versão horizontal da marca deve ser fornecida como recurso próprio. Não foi inventada uma variante horizontal.

Para compilar apenas o Android, reutilizando o bundle PureScript já validado:

```sh
gh workflow run br-purescript-memory.yml --ref codex/issue-1-purescript-memory \
  -f aplicativo=passageiro -f modo=full -f bundle_run_id=39866367286
```

O workflow confere igualdade dos fontes PureScript antes de reutilizar o bundle. Build e teste Android aprovados no run 39852288044 (commit bb13872b40). Captura `home-online-1.png` confirma a nova marca no cabeçalho original. APK: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39852288044/artifacts/12458705677 . Os três PNGs principais e os cinco ícones dentro do APK foram comparados por pixels com os arquivos fornecidos, sem diferenças.

## Artes oficiais recebidas em 2026-10-23

`oficiais-2026-10-23/` preserva integralmente o novo ZIP `alce_yatri_brasil_android_imagens.zip`: três originais, ícones preparados e instruções. Seu `sha256.json` registra os bytes recebidos. Os arquivos anteriores permanecem como referência histórica.

O overlay passa a ser exclusivo de **nyUserProdDebug + brTestMode**, sem efeito no motorista ou em produção. Os ícones debug/round legados usam as cinco densidades fornecidas; Android 8+ usa a camada foreground de 108 dp já preparada por densidade, sem um segundo inset. Fundo adaptativo: `#0732B6` conforme pacote. As máscaras circular e demais formatos ficam a cargo do launcher.

Splash e fallback exibem a arte completa azul com `fitCenter`, preservando proporção, IDs e callbacks existentes. A HomeScreen original resolve os aliases `ny_ic_logo_dark` e `ny_ic_logo_dark_my` para a mesma arte completa azul, sem moldura adicionada. O cabeçalho original de 93×32 dp permanece intacto; a imagem inteira aparece proporcionalmente pequena nesse espaço. `ny_ic_logo_light` e `ic_logo_name` usam o logotipo de texto transparente fornecido.

Não há alterações em PureScript/PrestoDOM, navegação, autenticação, backend, configuração Maps ou corridas. Bundle reutilizável atualizado: `39866367286` (substitui o exemplo histórico acima). O teste Android captura o ícone instalado no launcher, vídeo/frames da abertura real e mantém os testes existentes da HomeScreen offline/online e campos originais. Resultados desta nova versão serão registrados após a execução; presença de recursos não é aprovação visual.

Resultado do novo pacote: Android compilado em 201,76 s no job do run 39881766117; inspeção dos 18 PNGs empacotados sem diferenças. Validação Android e inspeção visual aprovadas no run 39882870977. Relatório completo em `Frontend/PASSAGEIRO-IDENTIDADE-OFICIAL.md`, incluindo capturas, APK e as falhas de automação corrigidas.

## Atualização posterior no repositório — APK atual

Os commits até `87ac794971` substituíram os PNGs Android e os aliases: splash vertical com `centerCrop` para eliminar o retângulo/faixas, texto transparente no cabeçalho e ícones corrigidos. O run **39890948539** compilou diretamente esses arquivos, sem executar novamente o gerador e sem recompilar PureScript. Compilação e teste Android API 29 aprovados; captura visual confirma a nova splash sem retângulo e o cabeçalho transparente. Os 18 PNGs do APK correspondem aos recursos desse commit, não aos PNGs iniciais do ZIP.

APK: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39890948539/artifacts/12474108786 . Evidências: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39890948539/artifacts/12474822465 . Relatório: `Frontend/build-reports/passageiro-identidade/39890948539.json`. Os registros anteriores neste documento são históricos.
