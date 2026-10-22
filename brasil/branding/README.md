# Identidade Alce Yatri Brasil

Recursos recebidos em `yatri-identidade-android.zip`. Os oito PNGs são preservados sem recorte, recompressão ou recriação. `sha256.json` permite verificar a integridade.

Aplicação no Android original: `Frontend/android-native/app/src/brTest/res`, carregado somente com `-PbrTestMode=true` e build `debug`. Os ícones de 48/72/96/144/192 pixels correspondem a mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi. Android 8+ usa ícone adaptativo com margem de segurança e a imagem fornecida de 512 pixels. O logotipo substitui os recursos locais usados pelo cabeçalho original; a imagem vertical é exibida na abertura com `fitCenter`, sem deformação. IDs de splash e callback Lottie são preservados.

Os layouts operacionais PureScript, navegação, backend e recursos de produção não são alterados. A imagem completa tem texto pequeno no cabeçalho de 93×32 dp original; eventual versão horizontal da marca deve ser fornecida como recurso próprio. Não foi inventada uma variante horizontal.

Para compilar apenas o Android, reutilizando o bundle PureScript já validado:

```sh
gh workflow run br-purescript-memory.yml --ref codex/issue-1-purescript-memory \
  -f aplicativo=passageiro -f modo=full -f bundle_run_id=39835346434
```

O workflow confere igualdade dos fontes PureScript antes de reutilizar o bundle. Build e teste Android aprovados no run 39852288044 (commit bb13872b40). Captura `home-online-1.png` confirma a nova marca no cabeçalho original. APK: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39852288044/artifacts/12458705677 . Os três PNGs principais e os cinco ícones dentro do APK foram comparados por pixels com os arquivos fornecidos, sem diferenças.
