# Identidade oficial do passageiro — 2026-10-23

## Escopo implementado

Pacote recebido: `alce_yatri_brasil_android_imagens.zip`. Originais, recursos preparados e instruções preservados em `brasil/branding/oficiais-2026-10-23/`, com SHA256 de cada arquivo em `sha256.json`. Nenhum PNG foi redesenhado, recortado ou recomprimido na aplicação dos recursos.

- `app/src/brTest/res/mipmap-*/ic_launcher_debug{,_round}.png`: símbolo estrada/pino, cinco densidades oficiais.
- `mipmap-*/br_launcher_foreground.png` e `mipmap-anydpi-v26/ic_launcher_debug{,_round}.xml`: foreground oficial de 108 dp, margem fornecida preservada, fundo `#0732B6`. Removido o inset adicional da versão anterior.
- `drawable-nodpi/br_splash.png`: arte completa azul, usada pelos layouts existentes `splash` e `splash_fallback` com `fitCenter`. IDs/callbacks mantidos; sem moldura ou distorção adicionada. A imagem 1536×1380 é proporcionalmente centralizada na tela vertical, com preenchimento azul nas áreas restantes; não é esticada para preencher o dispositivo.
- `drawable-nodpi/br_logo.png`: arte completa azul nos aliases do cabeçalho original (`ny_ic_logo_dark`, `ny_ic_logo_dark_my`) e splash. O cabeçalho original continua 93×32 dp: o logo completo é pequeno nesse espaço; nenhuma view foi substituída ou aumentada.
- `drawable-nodpi/br_logo_transparent.png`: texto transparente nos aliases `ny_ic_logo_light` e `ic_logo_name`.
- `app/build.gradle`: overlay de recursos exclusivamente em `nyUserProdDebug`, somente quando `brTestMode=true`. Recursos originais permanecem intactos; motorista e produção não recebem esta identidade.
- `capture-passenger-branding.py` e chamada em `test-original-passenger.sh`: captura do launcher instalado, vídeo e frames da abertura real. Não injeta UI nem substitui atividades; testes existentes offline/online e campos PureScript permanecem ativos.

Não houve alteração de fontes PureScript/PrestoDOM, backend, autenticação, configuração de serviços, lógica de corridas ou motorista. Atualizações documentais AWS feitas pelo proprietário foram incorporadas sem alteração da infraestrutura.

## Verificação local

- XML de todos os recursos do overlay parseados com sucesso.
- Os 17 arquivos recebidos conferem com o manifesto de integridade.
- Os 18 PNGs aplicados conferem byte a byte com os originais do pacote; dimensões dos ícones 48/72/96/144/192 px, foreground 108/162/216/324/432 px.
- Sintaxe Python e Bash válida; `git diff --check` sem erros.
- `Frontend/ui-customer`, `Frontend/ui-common` e `Frontend/packages.dhall` idênticos ao bundle aprovado do run 39866367286. Sem recompilação de módulos PureScript.

## Compilação e validação Android

**COMPILADO:** job Android do run [39881766117](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39881766117), fontes `38fc51ef40105640cd42b0f096d6768e1bcc36d5` (identidade implementada no commit `444a30247b`). Gradle: **201,76 s (3min21,76s)**; **zero módulos PureScript recompilados**, bundle do run 39866367286 reutilizado e igualdade dos fontes verificada. O RSS do processo pai Gradle não mede toda a JVM: não é apresentado como consumo total de memória.

[Baixar APK debug](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39881766117/artifacts/12470628951) — `app-nyUser-prod-debug.apk`, 128.289.399 bytes. SHA256 `44628e0e38d54c758fbe25aef2a25ac1b892b32a4661e0dc33f73ad7375f823a`. Os **18 recursos PNG empacotados** foram comparados por dimensão e pixels RGBA com os oficiais: nenhuma diferença.

**TESTADO EM ANDROID:** [run 39882870977 aprovado](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39882870977), automação `bb0f091743`, mesmo APK (SHA256 conferido), Pixel 2 / Android 10 (API 29), google_apis/x86_64. [Capturas, vídeo e diagnósticos](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39882870977/artifacts/12471133107).

Inspeção visual das imagens reais:

- `branding-launcher.png`: ícone estrada/pino reconhecível, pino inteiro, proporções preservadas, máscara circular real do Pixel Launcher. Nome completo confirmado no XML de acessibilidade (rótulo visual abreviado pelo próprio launcher).
- `branding-start-4.png` e `branding-start.mp4`: arte completa azul na splash, texto e pino inteiros, sem esticar/recortar nem adicionar borda. `fitCenter` deixa áreas azuis acima/abaixo por causa da diferença entre proporções da arte e do dispositivo.
- `home-online-1.png`: HomeScreen PureScript original, logo completo com fundo azul no cabeçalho, sem moldura adicionada; mapa com tiles, navegação e controles preservados.
- Abertura sem token/autenticação, 120 segundos de permanência, campos originais editáveis, retorno e Home offline/online aprovados. Nenhuma exceção fatal no diagnóstico da navegação.

**Ocorrências reais:** o primeiro run gerou o APK com sucesso, mas sua etapa de emulador falhou porque o gesto de automação partiu da barra Google e não abriu a gaveta. A segunda execução (39882486837) confirmou que tocar no indicador acessível também não abria a gaveta. Corrigido para gesto vertical a partir do indicador real; terceira execução aprovada. O APK não foi reconstruído a cada tentativa. Nenhum teste foi convertido em simulação ou dispensou localizar o ícone.

**Limites:** Android 12+ e outras máscaras/launchers não foram testados nesta execução; o sistema mostra uma breve janela branca antes da splash nativa no API 29. A área original do logo na Home é pequena (93×32 dp), preservada por escopo. A assinatura debug deste APK difere da entrega anterior: desinstalar a versão anterior antes de instalar esta. Relatório estruturado: `Frontend/build-reports/passageiro-identidade/39881766117.json`.

A aprovação visual não implica aprovação de Places/corridas. As limitações anteriores de integração permanecem independentes deste incremento de identidade.
