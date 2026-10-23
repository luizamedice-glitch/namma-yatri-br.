# Yatri Brasil — situação do projeto

Atualizado em: 2026-10-22. Este documento registra o histórico reportado durante o desenvolvimento; os itens assinalados como pendentes requerem auditoria do estado atual.

## Diretrizes confirmadas
- Yatri Brasil é a frente principal de desenvolvimento.
- Alce App permanece um piloto independente, sem alterações nem integração automática.
- Reutilizar a base Namma Yatri, minimizando reescritas.
- Não confundir protótipo de interface com operação de mobilidade validada.

## Histórico técnico reportado
- Código original do frontend passageiro em PureScript/PrestoDOM recuperado e compilado em uma execução anterior.
- APK com interface original já gerado; posteriormente foi relatado protótipo funcional do passageiro.
- Controlador de desenvolvimento reportado em `Frontend/ui-customer/src/Development/Passenger.purs`, visando abrir `Screens.HomeScreen.View.view` sem telefone/OTP no APK debug.
- Branch de trabalho usada: `codex/issue-1-purescript-memory`.
- Compilações PureScript longas e encerradas com exit 124 em execuções anteriores, entre elas #39791852321 e #39797933448.
- Ajustes de timeout/cache e modo de compilação staged foram reportados nos commits `a687e40` e `dd0b7ec`. Sua eficácia na execução atual **ainda deve ser comprovada**.
- Dependência de debug LeakCanary foi identificada anteriormente; não há confirmação aqui de sua remoção.
- Backend brasileiro e fluxo operacional completo ainda não foram comprovados como integrados à UI original.

## Confirmar na auditoria inicial
- SHA atual do código e versão exata do APK testado.
- Se HomeScreen, mapa, campo de destino, edição de origem e retorno realmente funcionam no dispositivo Android.
- Qual workflow gera o APK atual, se o modo staged é usado e quanto tempo demanda com cache frio e quente.
- Se o bypass de autenticação é exclusivo de debug; verificar release.
- Inventário dos serviços indianos chamados pela HomeScreen e dependências nativas.
- Endpoints e banco efetivamente existentes do backend Yatri Brasil.
- Estado do aplicativo do motorista, dos mecanismos de segurança, geolocalização em segundo plano e notificações.
- Licenças e obrigações de distribuição da base derivada.

## Regra de evidência
Use os estados `IMPLEMENTADO`, `COMPILADO`, `TESTADO EM ANDROID` e `VALIDADO DE PONTA A PONTA` separadamente. Sem prova (run, testes, logs ou vídeo/screenshot verificável), marque `NÃO VALIDADO`.

## Próximo marco
Obter uma versão reproduzível do APK passageiro com HomeScreen original e navegação funcional, acompanhada de diagnóstico das dependências e de um ciclo incremental de compilação. Em seguida: origem/destino reais, rota/cotação e primeiro fluxo de corrida com backend brasileiro.

## Identidade recebida em ZIP — 2026-10-22

- IMPLEMENTADO: recursos Alce Yatri Brasil fornecidos pelo usuário, sem edição dos PNGs, em `brasil/branding` e overlay `brTest/res` do Android original. Ícones por densidade, adaptativo Android 8+, abertura e aliases dos logotipos originais.
- Escopo: somente `brTestMode=true` + `debug`. Nenhuma tela PureScript, backend ou projeto Alce externo foi alterado.
- Validação local: integridade dos oito arquivos do ZIP, dimensões PNG e XML dos recursos. COMPILADO e TESTADO EM ANDROID: run 39852288044, commit bb13872b40; abertura sem login, digitação e retorno offline/online aprovados. Captura home-online-1.png confirma o logotipo no cabeçalho e mapa com tiles. APK: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39852288044/artifacts/12458705677 . SHA256 75d8785b21fb6284ffe0af08b915d5d50264cc3ee460a728c464a65d8f671c78. PureScript reutilizado sem recompilação.

## Pesquisa de origem/destino BR — implementação em verificação

Auditoria e decisões em `Frontend/PASSAGEIRO-ENDERECOS-BR.md`. Usuário confirmou ausência de backend Yatri acessível. Endpoints compatíveis de autocomplete/detalhes e sessão de desenvolvimento foram encontrados no backend Node e preservados. Adaptador BR implementado usando campos/listas/câmera/marcadores originais; 11 testes de contrato/FFI passaram localmente (fixtures explícitas, sem alegação de Google real). PureScript graph e compilação aprovados no run 39866367286: 3 módulos recompilados, 374,62 s, pico 7,96 GiB. APK e teste Android aprovados no run 39868182216: home sem login offline/online, origem e destino digitados integralmente, mapa com tiles, retorno e erro explícito de backend ausente. Código do APK 76a6a0dd26. Pesquisa real de ponta a ponta: **NÃO VALIDADA**, depende de backend exclusivo configurado e credenciais Places. Nenhuma corrida ou alteração no motorista.


## Entrega de pesquisa BR verificada — 2026-10-22

- IMPLEMENTADO/COMPILADO: adaptador para endpoints brasileiros existentes, detalhes, armazenamento da seleção nos campos originais e comandos de câmera/marcadores; sem alterar as views originais, backend, motorista, dependências ou autenticação de produção.
- TESTADO EM ANDROID: run 39868182216, APK artefato 12465491616; captura/diagnóstico artefato 12465587491. Onze testes de contrato/FFI aprovados; não são prova de Google real.
- CONFIGURAÇÃO CONFIRMADA: chave Android da secret `Google_Maps_API_Key` presente no build; URL do backend e credencial passageiro ausentes. Google Places de servidor não configurado no CI.
- PONTA A PONTA: **NÃO VALIDADO / critério não atingido**. `places-acceptance.json` registra explicitamente a falta do backend/credencial. Não houve sugestões, seleção de endereço ou viagem simuladas.
- Relatório e métricas: `Frontend/PASSAGEIRO-ENDERECOS-BR.md`, `Frontend/build-reports/passageiro-enderecos/39868182216.json`. Cache completo reaproveitável do job PureScript bem-sucedido do run 39866367286; a execução geral foi cancelada depois desse job para compilar somente o Android atualizado.
- Pendências: backend Yatri privado acessível, provisionamento/sessão real, Google Places New e GOOGLE_MAPS_SERVER_KEY; depois executar a seleção real no emulador/celular. Avisos não bloqueantes de SDKs legados/Firebase continuam documentados.

## AWS Lightsail — backend de desenvolvimento implantado
- Servidor de testes em São Paulo, backend Node.js 22 + PostgreSQL 16 via Docker, Caddy HTTPS; endereço `https://52-67-246-31.sslip.io`.
- `/health` respondendo HTTP 200 por HTTPS e demais rotas 403 segundo testes comunicados pelo proprietário. **APK ainda não conectado e fluxos operacionais externos não validados.**
- Especificações, caminhos, medidas de segurança e plano de integração em `AWS-DESENVOLVIMENTO.md`; segredos permanecem somente no servidor.

## Identidade oficial do passageiro — 2026-10-23

- IMPLEMENTADO: novo pacote `alce_yatri_brasil_android_imagens.zip` preservado integralmente; ícone estrada/pino nas cinco densidades, camadas adaptativas com margem oficial; splash e logo da Home completos com fundo azul, sem moldura adicionada; texto transparente nos demais aliases apropriados. Overlay exclusivo de `nyUserProdDebug` com `brTestMode=true`; nenhum fonte PureScript, backend, autenticação, corridas ou motorista alterado.
- COMPILADO: commit do APK `38fc51ef40`, implementação `444a30247b`, job Android do run 39881766117 aprovado, Gradle 201,76 s, zero recompilações PureScript. Os 18 PNGs do APK são idênticos por pixels aos oficiais.
- TESTADO EM ANDROID: run 39882870977 **aprovado**, Pixel 2/API 29; ícone no launcher, splash inteira proporcional, Home com logo azul sem borda, mapa/navegação offline/online preservados. Capturas inspecionadas visualmente; artefato 12471133107. As duas primeiras tentativas falharam na automação de abertura da gaveta, corrigida sem reconstruir o APK.
- APK: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39881766117/artifacts/12470628951 ; SHA256 `44628e0e38d54c758fbe25aef2a25ac1b892b32a4661e0dc33f73ad7375f823a`.
- Limites: outras máscaras/Android 12+ não testados, logo proporcionalmente pequeno no cabeçalho original; breve janela inicial do sistema branca antes da splash nativa. Assinatura debug diferente da entrega anterior exige desinstalar a anterior. Pesquisa Places/corridas não foram aprovadas por esta tarefa; configuração do backend permanece ausente neste APK.
- Relatório: `Frontend/PASSAGEIRO-IDENTIDADE-OFICIAL.md` e `Frontend/build-reports/passageiro-identidade/39881766117.json`.
