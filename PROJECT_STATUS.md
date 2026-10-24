# Yatri Brasil — situação do projeto

## Abertura animada AlceYatri — implementação em validação

- MP4 original do ZIP `AlceYatri_projeto_Android_animacao_original.zip` incorporado byte a byte, SHA256 `bf1ff534bcf0acc7aa9bb83a8a01c31ce3fa0d721ab8bf08666e45a7978c022c`, H.264 1280×720, 2,5 s, sem áudio. Asset exclusivo do passageiro BR debug.
- Reprodução local no layout nativo de abertura existente, com proporção integral, fundo rosa e espera pela HomeScreen PureScript original. Falha de vídeo libera o fluxo original; prazo máximo de 6 s evita bloqueio do decoder. Sem nova Activity, serviços remotos ou dependências.
- Teste Android ampliado: vídeo de 15 s, capturas durante a animação, verificação de SHA dentro do APK e evento real de reprodução concluída. COMPILADO/TESTADO EM ANDROID: pendentes neste registro.
- Ícone e logo rosa: pendentes dos PNGs originais em arquivo/ZIP. As imagens exibidas no chat não estão disponíveis como arquivos no executor. Não reconstruídos nem substituídos por aproximações; artes azuis anteriores ainda presentes neste incremento parcial.
- Não alterados backend, autenticação, mapas, motorista ou fontes PureScript. Bundle aprovado do run 40005145677 será reutilizado, com modo de mapas de teste preservado.

## Motor de mapas sem login — validado em Android

- Proprietário autorizou contornar autenticação nesta versão de teste, para
  validar o motor antes das demais funções. Escopo deste incremento: HomeScreen
  original do passageiro, autocomplete, seleção de origem/destino e rotas reais.
- Serviço de teste separado, sem banco/usuários/sessões. Somente POST
  `/v1/test/places/autocomplete`, `/v1/test/places/details` e `/v1/test/routes`.
  Reutiliza imagem da API existente, sem build e sem recriar a API principal.
  Caddy mantém as demais rotas operacionais bloqueadas. Janela de sete dias,
  limites compartilhados de 30 chamadas/minuto e 1000/dia (contadores em memória).
- APK BR debug recebe `mapsTestMode=true` e URL HTTPS; não incorpora credencial
  de passageiro e não chama endpoint de sessão. Release continua bloqueado pelo
  guard nativo/FFI existente. Views, PureScript, marca e motorista preservados.
- Build `ffi_only` exige cache de compilação aprovado e mesmos fontes PureScript,
  contratos FFI e manifestos. Atualiza bundle JavaScript sem chamar o compilador.
  Aceite no emulador agora pode exigir seleção real dos dois campos, recusando
  `not_validated` como sucesso quando o modo de teste é solicitado.
- Validação local: 26 testes passaram nas suítes de backend e adaptador, incluindo ausência de sessão/Bearer,
  isolamento de rotas, bloqueio em produção, expiração, limites, contratos e
  autorização original. Caddy: inserção idempotente e recusa de host ambíguo.
- Implantação APROVADA no run 40002766100: Google real por HTTPS sem Bearer,
  rotas operacionais 403 e ID do contêiner da API principal preservado.
- Bug encontrado no primeiro teste real: Google Details pode normalizar o ID da
  sugestão. Cliente corrigido em `3155e66` para aceitar ID canônico válido,
  preservando validação de coordenadas e descarte de respostas antigas.
- APK COMPILADO no run 40005145677, fontes `3155e664ceddeb5979ee1601c85e8233eda817c3`,
  zero recompilações PureScript, Gradle 3min35s. Asset BR debug confirmado com URL
  HTTPS, modo de mapas ativo e credencial vazia. SHA256 do APK:
  `ec9ada60615126b4efb68943895ee936c733fa7b343aad0ee3002e202ddeca05`.
- TESTADO EM ANDROID e VALIDADO DE PONTA A PONTA no emulador API 29:
  run 40005145677 aprovado, `places-acceptance.json` com `passed`. Destino
  Av. Paulista e origem Praça da Sé selecionados via Google real, coordenadas
  válidas e textos preservados ao reabrir a busca. Home sem login/OTP/token,
  offline/online e retorno aprovados. Capturas conferidas: tiles reais e câmera
  nas duas regiões de São Paulo, mantendo a marca e a interface original.
- APK 12524197861; capturas/aceite 12523888694. Relatório estruturado:
  `brasil/backend/reports/maps-test-2026-10-23.json`.
- Este aceite cobre mapas/endereços; fluxo completo de corrida e motorista
  permanece pendente. Janela do motor de teste até 2026-10-30T18:22:42.727971Z.

## Google configurado e validado no servidor — 2026-10-23

- `GOOGLE_MAPS_SERVER_KEY` configurada no arquivo de ambiente existente do
  Lightsail com a chave fornecida pelo proprietário. Transferência via envelope
  RSA-OAEP/SHA-256, decifrado somente no runner com a chave SSH já autorizada;
  nenhuma chave Google em texto foi incluída no Git/logs. Workflow e envelope
  temporários removidos após a aplicação.
- Run 40000022140 aprovado: somente API recriada, sem build; health saudável e
  chave presente no processo. Banco, imagem da API, Caddy e portas preservados.
- Consultas REAIS a partir do servidor: Places autocomplete HTTP 200, Places
  details HTTP 200 com coordenadas e Routes HTTP 200 com distância positiva.
  Coordenadas usadas são um cenário de teste explícito em São Paulo.
- Script `brasil/backend/ops/configure-google-key.py`: atualização atômica,
  backup protegido, rollback se a API não voltar saudável e logs sem credenciais.
  Verificações locais com fixtures cobriram preservação do arquivo, permissões,
  rollback e recusa de chave malformada antes de executar no servidor.
- Integração no APK original ainda NÃO VALIDADA: continuam pendentes sessão
  segura e liberação revisada dos endpoints. Sucesso Google no servidor não
  comprova seleção de origem/destino no Android nem corrida completa.

## Acesso SSH confirmado com arquivo original — 2026-10-23

- Arquivo PEM original fornecido pelo proprietário validado localmente sem
  imprimir seu conteúdo. Atualização de `AWS_SSH_KEY` concluída via Actions
  usando `IMPORT_GH_PAT` e envelope sealed-box para a chave pública do GitHub;
  run 39995775818 aprovado. Nenhuma chave privada foi incluída no Git/logs.
- SSH como `ubuntu` confirmado no run 39988466255, job 120559029577, aprovado.
  Conexão via runner de Actions dispensa alterar as configurações de rede do
  aplicativo mobile. Workflows/envelope de transferência temporários removidos.
- Inspeção somente leitura aprovada no run 39996011605: checkout remoto
  `113121de63dcfe7c5754e5af495e9711aca32d1d`; API ativa e health local OK;
  PostgreSQL saudável, sem porta publicada; Caddy ativo. API publicada somente
  em `127.0.0.1:8080`. Banco/convite configurados, contas automáticas desabilitadas.
- `GOOGLE_MAPS_SERVER_KEY` ausente na API em execução. Esse é um bloqueio
  confirmado para Places/Routes reais. A conexão Android ainda depende do desenho
  de sessão e da liberação revisada de endpoints descritos em
  `AWS-DESENVOLVIMENTO.md`. Nenhuma imagem ou rota pública foi alterada.

## Retomada do acesso ao servidor existente — 2026-10-23

- Documentação localizada na branch `codex/issue-1-purescript-memory`:
  `AWS-DESENVOLVIMENTO.md` informa `https://52-67-246-31.sslip.io`,
  `/opt/yatri-brasil` e Caddy instalado no host. Consulta HTTPS nesta execução
  confirmou `/health` com `status=ok` e `service=namma-yatri-br`.
- PR #4 fechado sem merge: a implantação paralela proposta sobre a branch antiga
  `passageiro-pt-br` não deve ser usada para substituir o ambiente existente.
- Workflow SSH existente passa a usar IP público `52.67.246.31` e usuário
  `ubuntu` como fallback dos secrets opcionais `AWS_HOST`/`AWS_USER`.
  `AWS_SSH_KEY` continua somente em Actions. Isso remove o bloqueio anterior
  sem cadastrar novos secrets nem alterar a instalação do servidor.
- A alteração disparou somente `whoami && hostname`. Run
  https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39984936982
  alcançou o servidor na porta 22, mas falhou com `Permission denied (publickey)`.
  A chave em `AWS_SSH_KEY` foi aceita pelo parser OpenSSH, porém o servidor
  recusou sua autenticação como `ubuntu`. Nenhum comando remoto foi executado.
  Próximo passo: configurar no secret a chave privada correspondente a uma chave
  pública autorizada para `ubuntu` nessa instância, ou autorizar a chave pública
  correspondente via console administrativo do Lightsail. Nenhuma implantação,
  alteração de secrets ou liberação de rotas realizada.

## Teste SSH via GitHub Actions — 2026-10-23

- IMPLEMENTADO: `.github/workflows/br-lightsail-ssh.yml`, commit `c25f8146d4`, usa `AWS_SSH_KEY`, `AWS_HOST` e `AWS_USER` para executar somente `whoami && hostname` na porta 22. Chave temporária fora do checkout, permissão 600, remoção ao sair, sem impressão do conteúdo; sem checkout ou permissões de token GitHub. Timeout SSH 45 s / job 3 min.
- Validação local: YAML, sintaxe Bash e recusa de secret ausente aprovados. Execução real [39981618638](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39981618638) interrompida antes do SSH: `AWS_SSH_KEY` disponível, `AWS_HOST` e `AWS_USER` vazios. A validade da chave e a conexão remota NÃO foram verificadas.
- Tentativa de cadastrar o host informado recusada pela integração GitHub (HTTP 403 ao obter chave pública de criptografia de secrets); nenhum secret alterado. Proprietário precisa disponibilizar Repository secrets `AWS_HOST=52.67.246.31` e `AWS_USER=ubuntu`, depois repetir o job falho.
- Primeira conexão usa OpenSSH `accept-new` (TOFU por runner efêmero). Secret opcional `AWS_SSH_KNOWN_HOSTS`, com linha conferida por canal independente, ativa verificação estrita. Não foi obtida nem inventada a identidade SSH do servidor.
- Workflow manual e push limitado ao próprio arquivo na branch de trabalho, permitindo a primeira execução sem modificar `main`. Nenhuma implantação, banco, firewall ou aplicativo alterado.

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

## Novo APK com imagens corrigidas no repositório — 2026-10-23

- Fontes do APK: `87ac794971`, incluindo as correções de identidade publicadas pelo proprietário: splash vertical com `centerCrop`, cabeçalho com texto transparente e ícones atualizados. Nenhuma imagem foi gerada ou modificada nesta execução; usados os PNGs já commitados.
- COMPILADO/TESTADO EM ANDROID: workflow 39890948539 **success**, Gradle 195,68 s, PureScript reutilizado do run 39866367286 sem recompilação. Pixel 2/API 29: abertura/Home offline e online, campos editáveis e retorno aprovados.
- Conferência visual: splash cobre a área do aplicativo sem o retângulo anterior; logo/pino visíveis, texto transparente no cabeçalho original, ícone corrigido no launcher. Os 18 PNGs dentro do APK correspondem por pixels aos recursos atuais da branch. A captura revisada da Home tem área de mapa branca: tiles não confirmados nesta execução; mapas e integrações não foram alterados ou aprovados por este incremento.
- APK: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39890948539/artifacts/12474108786 . SHA256 `3eccf4987964f52ef082678cfd591c358e85ae45cf87c9d0b09aafd21f2740df`.
- Evidências: artefato 12474822465 do mesmo run. Relatório estruturado: `Frontend/build-reports/passageiro-identidade/39890948539.json`. A nova assinatura debug difere da anterior; desinstalar o APK anterior para instalar este.
- Esta versão substitui visualmente a entrega 39881766117. Backend, autenticação, lógica de corridas, fontes PureScript e motorista permanecem sem alterações nesta execução. Pesquisa real/Android 12+ continuam fora da validação.

## Integração com o Lightsail — preparação e testes em 2026-10-23

- Servidor existente confirmado por HTTPS: `/health` 200, rotas operacionais 403.
- IMPLEMENTADO/TESTADO: implantação por commit com imagem identificável, checagem PostgreSQL somente leitura, bloqueio de migrations diferentes e retorno à imagem anterior. Commit `45f32bdf3a`; procedimentos em `brasil/backend/ops/README.md`.
- CI aprovado: backend run 39974516114 e integração run 39974511131. Dez testes unitários, três suítes PostgreSQL, inicialização CLI, build Docker Node 22, atualização e rollback em Compose descartável aprovados. Banco/registro preservados no rollback; guard de migrations testado com recusa antes de recriar API.
- REMOTO: **NÃO IMPLANTADO nesta execução**. Acesso SSH/identidade AWS ainda indisponíveis; conexão AWS solicita reautenticação. Proprietário configurará acesso no ambiente. Nenhum segredo, Caddy, firewall, banco remoto ou endpoint público foi alterado.
- APK conectado/Places reais: **NÃO VALIDADO**. Evidência estruturada: `brasil/backend/reports/lightsail-2026-10-23.json`. Detalhes e próximo passo em `AWS-DESENVOLVIMENTO.md`.

## Abertura rosa e marca AY — 2026-10-23

- Autorizado pelo proprietário: animação fornecida com os **2,5 segundos originais**, fundo rosa sólido em toda a tela, sem moldura/degradê; novo ícone AY/BR e conjunto ícone/texto transparente no cabeçalho da Home original.
- Implementação: sequência do MP4 convertida para GIF local com fundo uniformizado `#FF00BE`, desenhada por `android.graphics.Movie` sobre Canvas da mesma cor, sem player/surface retangular. MP4 e PNGs recebidos preservados em `brasil/branding/abertura-rosa-2026-10-23/`; conversão reproduzível em `Frontend/scripts/build-br-pink-opening.py`.
- Somente recursos `nyUserProdDebug` + `brTestMode`; ícones legados nas cinco densidades e foreground adaptativo com margem de segurança. Aliases originais do cabeçalho resolvem para o novo PNG transparente. Nenhuma dependência adicionada, nenhum fonte PureScript ou servidor AWS alterado.
- VALIDADO: fontes do APK `3205157dc5a7e7b86811dc7b12bdc5bd8ac4cf49`, run **40040469420** aprovado: build Android e teste em Pixel 2/API 29; reprodução concluída, ícone instalado, logo transparente no cabeçalho, busca/seleção real e retorno à Home aprovados. Conferência visual confirma rosa uniforme sem moldura/degradê e restauração do fundo branco/barra inferior ao sair da splash. GIF com 2500 ms e fundo uniforme verificado localmente; zero recompilações PureScript.
- APK: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40040469420/artifacts/12539172465 ; SHA256 `7d0825b5d8cb3b9bff15ee3aa26e0b52d572b4aa39a84af5af48d8e1c9e1cc2e`. Evidências: artefato **12539816223**. Relatório: `Frontend/build-reports/passageiro-identidade/40040469420.json`. Android 12+ ainda sem validação visual; assinatura debug pode exigir remover a versão anterior. Recursos/callbacks de produção e motorista preservados.

## Ajuste de entrada e presença da marca — 2026-10-24

- Solicitado: reduzir a percepção de tela rosa ociosa e ampliar a marca no cabeçalho da Home.
- Implementado: janela de lançamento já mostra o primeiro quadro visível da marca; Android 12+ recebe o monograma no splash do sistema. Fade inicial adiantado em aproximadamente 267 ms, redistribuindo o restante da sequência para preservar 2500 ms totais. Fundo continua rosa sólido.
- Logo da Home BR debug passa de 93×32 dp para 136×44 dp (116×44 dp em telas menores que 380 dp), por adaptador Android restrito ao cabeçalho original (imagem 93×32 dp ao lado do botão Navigation). Produção mantém dimensões anteriores. Fontes PureScript e bundle preservados.
- Diagnóstico: alterar a view PureScript acionou recompilação de Flow, interrompida por falta de progresso após pico de aproximadamente 11 GB de RSS no run 40043513972. A alteração PureScript foi revertida; escolhido ajuste Android para reutilizar o bundle validado sem aumentar limites/timeouts.
- VALIDADO: fontes do APK `42a52876f0f0ac8d1725c840bb0e50a90ddeed50`, build e aceite Android 10 no run **40044877082**; Android 12 completo no run **40045220239**. Logo medido em 357×116 px (136×44 dp), sem sobreposição do botão lateral; reprodução concluída e Home branca preservada. Busca/seleção real de endereços também aprovada no Android 10.
- Captura Android 12 pelo ícone real, com animações do sistema ativas: run **40046208335**, artefato **12541437594**; AY visível já na splash inicial, sem moldura/degradê. Captura via comando `am start` com animações desativadas não representa a apresentação normal do ícone do sistema; mantida como evidência funcional separada.
- APK: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40044877082/artifacts/12541475126 ; SHA256 `d8a9b24376885d35eaec0608f55be497f770a12c15bf8c814a31d6a3757badfe`. Evidências Android 10: **12541092689**; Android 12: **12541207353**. Relatório: `Frontend/build-reports/passageiro-identidade/40044877082.json`. Ramo compacto 116 dp ainda sem teste em dispositivo separado. Ícone do APK e servidor AWS preservados.

## Localização pt-BR do passageiro — 2026-10-24

- Implementada tradução inicial de 1.789 mensagens do catálogo central (125 com funções/parâmetros), 1.815 correspondências de literais de apresentação e 111 recursos Android. Revisão manual de 295 mensagens centrais, rótulos de acessibilidade e recursos nativos; demais textos têm tradução inicial e exigem revisão dos fluxos secundários antes de sua ativação.
- O adaptador Webpack mantém contratos/output PureScript, substitui apenas o catálogo de apresentação no contexto BR e traduz literais em propriedades PrestoDOM/toasts. Contexto Android configurado para pt-BR; motorista, produção e idioma do dispositivo preservados. Datas passam a reconhecer PT_BR no formatador de apresentação. Nenhum serviço de tradução ou modelo é incluído no APK.
- Validação local: cobertura total de chaves, parâmetros, HTML, símbolos monetários e isolamento de produção/WEB aprovados. Compilação e testes Android em português pendentes. Documentação/proveniência em `Frontend/ui-customer/src/Localization/README.md`.

## Continuação da tradução — 2026-10-24

- Corrigidas 14 mensagens adicionais e literais associados: avaliação, solicitação, aceite automático, veículo e cancelamento; 309 mensagens centrais revisadas manualmente. Cobertura das 1.789 chaves, parâmetros/HTML/moedas e isolamento de produção aprovados localmente.
- Run 40051436076: bundle e APK aprovados; teste interrompido ao ler dump ausente no launcher, antes de abrir o app. Captura agora tenta obter XML válido três vezes e preserva screenshot em falha, mantendo aceite obrigatório.
- Nova compilação/validação Android pendentes neste registro. Textos secundários traduzidos automaticamente ainda requerem revisão contextual; não se declara revisão humana integral de funcionalidades desativadas.

- COMPILADO/TESTADO EM ANDROID: commit `a181256b8e`, run **40057802186** aprovado. Zero módulos PureScript recompilados; Gradle 174,94 s. Emulador API 29: `portuguese-acceptance.json` aprovado com 1.789 mensagens, Home e busca em português; seleção Google real de Av. Paulista/Praça da Sé e persistência aprovadas. Capturas da Home e resultados conferidas visualmente, marca preservada.
- APK: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40057802186/artifacts/12546092608 . SHA256 `66b601fcbb2713d3b0662615e637b2109e99380832f9b24f0f8b337fc3b56b60`. Evidências **12546645793**. Relatório: `Frontend/build-reports/passageiro-portugues/40057802186.json`.
- Limites: tiles ausentes na captura Home revisada; busca/seleção real aprovada não comprova renderização dos tiles. Android 12 não repetido neste incremento. Revisão contextual das traduções automáticas secundárias permanece pendente.

## Navegação inferior do passageiro — em desenvolvimento

- Barra em PureScript/PrestoDOM no controlador exclusivo de desenvolvimento: Início, Carteira, Perfil. Home original e estado de origem/destino preservados; rodapé oculto durante pesquisa.
- Perfil reutiliza a view original sem registrar seus eventos globais de autenticação/API. Nome local de teste já existente; edição sinalizada como indisponível.
- Carteira sem serviço financeiro: informa indisponibilidade, sem saldo ou movimentações simuladas.
- Compilação e aceite Android pendentes; alteração concentrada em Development.Passenger para evitar recompilar HomeScreen.View/Flow, cujo pico de memória já foi documentado.


## Navegação inferior — aceite Android em 2026-10-24

- IMPLEMENTADO/COMPILADO/TESTADO EM ANDROID: APK fontes `22d096a03e`, run **40063516106** aprovado, API 29. Barra fixa de 64 dp, três colunas com ícones e rótulos Início/Carteira/Perfil; indicação de aba ativa. Oculta durante pesquisa. Menu superior retirado por adaptação restrita ao cabeçalho BR existente, preservando margem da marca.
- HomeScreen e Perfil reutilizam views PureScript/PrestoDOM originais. Navegação restrita ao controlador de desenvolvimento; nenhum template Java, backend, autenticação de produção ou motorista alterado. Perfil mostra nome local Fagner, sem buscar perfil indiano; edição exibe indisponibilidade. Carteira informa ausência de serviço financeiro, sem saldo/transações simulados.
- Aceite real: pesquisa Google, seleção de origem/destino, troca das três abas, retorno pelo botão Voltar e preservação integral dos endereços aprovados. Capturas de Home, Carteira e Perfil conferidas visualmente; tiles visíveis na captura de retorno à Home.
- Regressão detectada no run 40062130214: pesquisa não abriu após trocar a raiz da árvore ao esconder o rodapé. Corrigida mantendo a raiz PrestoDOM estável e alterando somente a visibilidade do rodapé; teste completo repetido com sucesso.
- Compilação em lotes/cache do run 40062877489: apenas Development.Passenger e Main recompilados, 242,98 s e pico RSS 8,32 GiB. HomeScreen.View/Flow preservados. Build final reutiliza esse bundle sem repetir PureScript.
- APK: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40063516106/artifacts/12548038010 . SHA256 `8f45bc57acad0738a048b8e241b197236775753bafe9e9d544ec3751913d3e38`. Evidências **12547754406**. Relatório `Frontend/build-reports/passageiro-navegacao/40063516106.json`.
- Limites: navegação nova exclusiva de BR debug; carteira financeira, persistência/edição de perfil e validação Android 12 desta alteração permanecem pendentes. APK debug pode exigir desinstalar a versão anterior por diferença de assinatura.

## Motorista original de testes — auditoria e implementação inicial

- Painel original PureScript/PrestoDOM reutilizado via Development.Driver, entrada Webpack de teste separada, sem alterar Main/Flow de produção. Conta local de apresentação Giselo, inicialização Offline; disponibilidade só muda após resposta real do backend.
- Cliente operacional com sessões válidas provisionadas no armazenamento privado do dispositivo, nunca incorporadas ao APK: snapshot, disponibilidade, GPS e ações de corrida. Sem servidor/sessão configurados, erro explícito; nenhum saldo, oferta ou corrida fabricada.
- Isolado o pedido de token Firebase feito pelo afterRender original, apenas no pacote motorista BR debug. Configurações nativas/identidade separadas do passageiro.
- Backend remoto atual permite apenas mapas de teste; rotas operacionais continuam bloqueadas. Integração remota ainda não validada e nenhuma rota pública foi alterada.
- Workflow dedicado compila a dependência transitiva de Development.Driver em lotes de 25, separando módulos pesados, com timeout/guard de RSS e cache recuperável. Flow indiano não entra no bundle de teste. Compilação/Android e ofertas no layout original ainda pendentes.

### Motorista — compilação e diagnóstico Android, 2026-10-24

- COMPILADO: bundle original no run `40103387972`, 30 lotes recuperáveis, 74,92 s somados de compilador e pico RSS amostrado de 4,07 GiB com cache. APK motorista produzido nos runs `40104037177`, `40105100413` e `40106690472`; isso ainda não aprova abertura/operação.
- TESTADO EM API/BANCO: cliente usado pelo motorista passou no ciclo HTTP Fagner/Giselo com PostgreSQL, isolamento por papel e emissão privada de sessão por 24h. Google Routes usa fixture explícita apenas nesse teste de contrato. Regressão do backend: 13 testes básicos e 3 de integração aprovados, incluindo concorrência e SSE; não são testes de duas interfaces Android.
- Corrigido crash inicial de FirebaseApp ausente: contêiner local de compatibilidade restrito a BR debug motorista, coleta/push desativados. Não utiliza credenciais Firebase operacionais.
- Emulador `40106690472`: Activity viva, mas splash persistente. Diagnóstico CDP revelou `window.__PROXY_FN.set is not a function`: Core2 original copia o registro objeto do SDK após a entrada ter marcado seu tipo como Map. Correção `5fa252f6d8` sincroniza o indicador após imports, preservando callbacks; quatro testes do adaptador aprovados. Novo aceite Android em execução, sem declarar este APK funcional antecipadamente.
- Próximo critério: painel original sem login → GPS enviado à API real local → disponibilidade confirmada no banco. Ofertas/ações de viagem nas views e integração remota permanecem pendentes. Instruções de sessão fora do APK em `Frontend/ui-driver/DRIVER-BR-TEST.md`.


### Motorista — APK inicial aprovado em Android, 2026-10-24

- Retomado o trabalho original da branch no commit `22231670d6`. O run `40108916888` já havia aprovado abertura e disponibilidade, mas as capturas revelavam avisos de decodificação sobre a interface. Corrigidos os envelopes/defaults de quatro configurações opcionais usando os valores originais do PureScript; recursos opcionais permanecem desativados e nenhuma credencial operacional foi incorporada.
- COMPILADO/TESTADO EM ANDROID: fontes `7e9bbc20b29bef38a18c0217cbf5b8bfc334a5fe`, workflow **40111273590 success**, variante `nyDriverProdDebug`, pacote `in.juspay.nammayatripartner.debug`. Sete testes de cliente/API/PostgreSQL aprovados. Pixel 2/API 29: painel original sem login, GPS e disponibilidade confirmados pela API/banco locais reais. Captura online conferida visualmente: tiles de São Paulo visíveis, controles sem sobreposição e nenhum aviso Config Decode Failed.
- Primeiro ajuste de tradução deixou o indicador de localização longo; corrigido para “Sem atualização” e repetido o aceite Android antes da entrega. O indicador legado de horário ainda não reflete a confirmação do novo cliente operacional.
- APK (ZIP): https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40111273590/artifacts/12566278284 . Evidências: **12567042032**. Relatório: `Frontend/build-reports/motorista-original/40111273590.json`; o hash registrado é do ZIP do artefato, não do APK interno.
- Limites: teste com API/PostgreSQL locais descartáveis; Lightsail e passageiro preservados. Uso operacional no celular exige backend acessível com rotas de motorista e sessão privada provisionada fora do APK, conforme `Frontend/ui-driver/DRIVER-BR-TEST.md`. Ofertas e ações de corrida ainda não ligadas às views originais; não se declara integração entre os dois APKs. Menus secundários, tradução integral do motorista e Android 12+ permanecem sem aceite.


### Motorista no Lightsail — fronteira HTTPS configurada, 2026-10-24

- IMPLEMENTADO/IMPLANTADO: serviço separado e restrito `driver-pilot`, run **40113362115 success**, fontes `9afffb8eb3`. API principal, PostgreSQL e maps-test mantiveram seus IDs; sem migration, alteração de firewall ou conta automática. Janela de sete dias até 31/10/2026 16:50 UTC.
- TESTADO: regressão backend/API/PostgreSQL, guard do piloto por perfil/UUID/expiração e configuração Caddy aprovados no workflow. Verificação externa: health 200; snapshot, GPS e disponibilidade 401 sem sessão; cadastro, desenvolvimento/session e POST de corridas 403. Valores de credenciais não publicados.
- BLOQUEIO DE DADOS: Giselo e veículo não existem no servidor; solicitados placa, modelo/cor reais e método de provisionamento do Android. Comando privado de cadastro preparado, sem preencher veículo fictício.
- APK no servidor: **NÃO VALIDADO**; falta cadastrar motorista/veículo, emitir/provisionar sessão privada e repetir GPS/disponibilidade no Android por HTTPS. O APK anterior continua aprovado somente contra API local. Ofertas/corridas e integração passageiro-motorista seguem pendentes.
- Operação em `AWS-DESENVOLVIMENTO.md`; evidência estruturada `brasil/backend/reports/driver-lightsail-2026-10-24.json`.


### Motorista — ativação pelo celular e aceite no Lightsail, 2026-10-24

- Dados reais do veículo recebidos do proprietário e aplicados ao cadastro privado de Giselo, sem publicar placa/modelo/cor em código/logs. Provisionamento **40115687810 success**; API/PostgreSQL/maps-test existentes preservados. Piloto atualizado até **2026-10-31T17:25:38.646713+00:00**.
- IMPLEMENTADO: `BrDriverSetupActivity`, restrita a DRIVER + debug + BR mode + pacote motorista esperado. Na primeira abertura, recebe código de conexão de uso único, troca por sessão HTTPS e grava somente no store privado `godel`. Código e sessão expiram em 24h. Nenhum token/chave bootstrap é incorporado ao APK. UI passageiro e versões de produção preservadas.
- Backend acrescenta somente POST `/v1/driver/pair` à allowlist do piloto e ao Caddy. Código aleatório de 128 bits armazenado por hash com namespace separado; troca transacional consome o código e emite sessão privada. Não é token Bearer. Testes PostgreSQL verificam consumo, rejeição de reutilização e isolamento por perfil.
- COMPILADO/TESTADO EM ANDROID: APK fontes `aa071bd55c4be8b782ebce80a8fb5deeca40873f`, run **40116465299 success**, com bundle PureScript anterior reaproveitado. APK **12569640452**. Aceite remoto **40117202534 success**, Pixel 2/API 29: código preenchido pela tela nativa → sessão gravada pela interface → painel original → GPS do emulador enviado por HTTPS → disponibilidade confirmada no banco Lightsail. Motorista retornado a indisponível após o teste. Captura online revisada: mapa com tiles e sem aviso de configuração. Evidências **12569606867**.
- Primeiro aceite remoto parou no seletor do botão transformado em maiúsculas pelo tema; corrigida somente a automação e repetido com o mesmo APK, sem novo build. Concorrência separada por build/artefato para o aceite não cancelar a origem.
- APK: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40116465299/artifacts/12569640452 . Relatório `Frontend/build-reports/motorista-original/40117202534.json`; hash informado refere-se ao ZIP do artefato.
- Limites: uso no celular físico depende de instalar e ativar o APK/conceder localização; sessão do piloto dura 24h e depois requer novo código. Oferta/aceite/ciclo de corrida entre os APKs, indicador legado do horário GPS e telas secundárias permanecem pendentes. Nenhuma simulação de resposta operacional foi usada no aceite remoto.

### Continuação do marco do proprietário — chamada entre os APKs

- CONFIRMADO: fontes `f0bfa4f447`, run `40121323902` aprovado, incluindo os dois builds e emulador API 29. Evidência `12572126227/acceptance.json`: ativação dos dois perfis, Places/Routes Google reais, pedido persistido, oferta correspondente, aceite de Giselo, dados do motorista/veículo recebidos pelo passageiro e cancelamento pela interface. APK passageiro `12572535133`, motorista `12572405256`. Este marco não exercitou chegada, início ou conclusão.
- Incremento seguinte IMPLEMENTADO, ainda SEM ACEITE ANDROID: botões de chegada/início/conclusão e respectivos estados nos componentes PureScript existentes; consulta do registro encerrado e recuperação por ID privado após recriação dos processos. Respostas antigas de snapshot são descartadas para impedir regressão visual do estado confirmado.
- Testes locais: cliente com resposta fora de ordem/recriação/conclusão aprovado; piloto HTTP/PostgreSQL verifica sequência completa e rejeita início antes de chegada e ações do passageiro. Fixtures Google continuam explícitas somente nos testes de contrato. O aceite Android foi ampliado para executar cancelamento e depois um segundo pedido até conclusão, sem simular estados.
- Atualização do piloto preparada: somente três ações autenticadas adicionais nas allowlists existentes. Migrations/contas/portas/serviços principais preservados; atualização recusa viagens ativas e conserva a expiração já configurada. Implantação/aceite remoto deste incremento pendentes neste registro.

- IMPLANTADO: run `40131046069` aprovado, fontes `5777475bd9`; serviços existentes preservados e janela mantida em `2026-10-31T18:16:18.740028+00:00`. Verificação externa das três novas ações sem sessão: 401; cadastro público: 403; health: 200. Não houve provisionamento de contas, migration ou alteração de portas.
- Auditoria da recriação do passageiro identificou falta de acesso à viagem quando a seleção de endereços em memória se perdia. Home passa a exibir “Acompanhar viagem” para ID salvo com sessão debug válida; o detalhe é consultado no backend. Teste de guard/retomada aprovado localmente, aguardando APK final.

- Run `40131968906` aprovado, fontes `8f8a477af8`: pedido, oferta, aceite, chegada, início e conclusão confirmados nos dois APKs/Google/Lightsail, incluindo cancelamento anterior e recuperação dos processos. Zero exceções fatais/ANRs no diagnóstico resumido. Porém a captura de retorno do motorista ainda mostrava a confirmação, e o teste não verificava seu desaparecimento; retorno ao painel não foi considerado aprovado nesse marco.
- Reforçado o aceite para confirmar o painel original visível após fechar a confirmação. Teste local reproduziu evento síncrono reentrante no `dismissTrip`; controlador passa a concluir sua própria mudança visual e recebe a próxima consulta assincronamente. Novo build poderá reutilizar o bundle passageiro aprovado por comparação estrita das fontes, compilando somente o motorista. Aceite Android dessa correção pendente neste registro.

### Ciclo completo e retorno ao painel — aprovado em 24/10/2026

- COMPILADO/TESTADO EM ANDROID: fontes `32d7e1d4963e2f890f3a009119b0ea256288a686`, run **40134223066 success**, Pixel 2/API 29. Duas instalações reais, ativação privada pela interface, Google Places/Routes e API/PostgreSQL Lightsail. Pedido → oferta correspondente → aceite → chegada → início → conclusão exibidos/confirmados nos dois aplicativos. Cancelamento e recriação dos processos também aprovados. `driver_returns_to_dashboard=true`; captura final conferida, com painel e mapa visíveis sem modal. Zero exceções fatais e ANRs.
- Regressão reproduzida no mesmo APK anterior no run `40133735562`: “O motorista não retornou ao painel”. Corrigida sem simular mudança operacional: fechamento local do modal pelo controlador e próxima atualização assíncrona, sem evento reentrante. Aceite completo repetido com sucesso.
- Lotes/cache: somente `Development.Driver` recompilado na rodada final, **46,74 s**, pico RSS amostrado **2,20 GiB**, 30 lotes. Bundle passageiro aprovado do run `40131968906` reaproveitado após comparar fontes/dependências; nenhum compilador passageiro executado nessa rodada. Na rodada fonte: 247,75 s/8,23 GiB, somente Development.Booking/Passenger/Rides e Main; HomeScreens originais preservadas do cache.
- APK passageiro: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40134223066/artifacts/12576033149 . SHA256 do APK: `eafe8f4b18668e6e0aa90242503f356c2394deea140197e631f91f9f132ca218`.
- APK motorista: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40134223066/artifacts/12575763574 . SHA256 do APK: `7627dab851d31f5c3c1824b92367c5c91f08103410b7722d8a455fe61f8b1609`. ZIPs e bundles conferidos; os hashes acima são dos APKs internos.
- Evidências **12576283319**: acceptance.json, diagnóstico resumido e capturas sem código/placa. Sem publicação de logcat bruto. Relatório: `Frontend/build-reports/ciclo-completo/40134223066.json`.
- Backend continua nas fontes `5777475bd9`, implantadas no run `40131046069`, sem nova migration/conta/porta e sem renovar a janela (`2026-10-31T18:16:18.740028+00:00`). Ao terminar o teste, nenhuma viagem ativa e motorista indisponível.
- Limites: aceite em um emulador alternando os APKs, sem teste de dois celulares físicos/Android 12+. Navegação/trajeto ao vivo, operação em segundo plano, menus secundários e indicador legado do horário GPS seguem pendentes. Sessão/ativação de desenvolvimento dura 24h; sem pagamento real. Não se declara plataforma de produção nem fidelidade exata à Play Store.

### Entrega privada de conexão — 24/10/2026

- A pedido do proprietário, emitidas novas ativações dos perfis motorista e passageiro nos runs `40136475509` e `40136477122`, ambos aprovados. Somente job activate; implantação e provisionamento não executados.
- Entrega RSA por chave pública temporária opcional, sem substituir a pública do operador no repositório. Arquivos decifrados e chave privada permanecem fora do Git; nenhum código/sessão foi publicado em logs ou documentação. Formato, perfil e expiração conferidos sem consumir os códigos.
- Validades UTC: motorista `2026-10-25T21:57:46.819Z`, passageiro `2026-10-25T21:58:05.108Z`. Códigos de uso único; arquivo privado disponibilizado diretamente ao proprietário. Não são credenciais SSH.
