# Entrada direta no passageiro original — desenvolvimento

A orientação atual é adiar a autenticação própria e abrir primeiro o núcleo do aplicativo. Esta etapa substitui, no build BR de desenvolvimento, a passagem obrigatória pelo onboarding descrita em [PASSAGEIRO-TELEFONE.md](PASSAGEIRO-TELEFONE.md).

## Implementação

- A flag `__YATRI_BR_DEVELOPMENT__` existe exclusivamente no HTML de `app/src/brTest/assets`, que o Gradle inclui somente no debug com `-PbrTestMode=true`.
- `Engineering.Helpers.DevelopmentMode` exige flag booleana explícita e pacote Android terminado em `.debug`. Erros de leitura fecham o gate. Configurações de preferências e parâmetros de URL não habilitam o modo.
- `Main` entra em `Development.Passenger` nesse modo. A execução normal mantém o fluxo histórico. Não altera a autenticação ou a autorização do backend.
- A tela é **`Screens.HomeScreen.View.view` original**, com seus componentes, estilos, mapa e animações. Não há outra implementação visual nem uma Activity Java substituta.
- O controlador de desenvolvimento não inicia OTP, validação de token, perfil, endereços salvos, histórico, ofertas, notificações push, pagamentos, segurança de viagem ou atualização remota. Estes serviços não são pré-condições para renderizar a home.
- O nome Fagner é uma preferência local de exibição. Não representa uma conta autenticada: nenhum ID de passageiro ou token é inventado ou gravado.
- A localização usa os métodos nativos existentes, solicita a permissão Android e atualiza origem/câmera somente com coordenadas válidas recebidas do serviço. Ausência de GPS não deve impedir a abertura da home.
- O botão central abre os campos originais de origem e destino, que permitem edição e retorno à home. Busca de endereços, seleção no mapa e corridas ainda não têm integração operacional neste controlador: ações correspondentes informam essa pendência, sem gerar sugestões, tarifas ou viagens fictícias.
- Os leitores e decoders originais de Remote Config foram restaurados, incluindo seus defaults e diagnósticos. A camada genérica adicionada na primeira tentativa foi retirada para investigar a regressão de compilação. Os serviços paralelos não são iniciados pelo controlador de desenvolvimento. Configuração ausente pode produzir avisos originais; esses avisos não são ocultados nem convertidos em respostas de API.
- O menu paralelo não oferece as opções que exigem serviços ainda desativados; seu componente original e a ação de fechar são mantidos.

## Verificação

`node Frontend/scripts/test-development-mode.mjs` testa o gate real usado pelo frontend: flag ausente, tipo incorreto, pacote release/staging, pacote debug e falhas da bridge. Passou localmente. O CI executa o mesmo comando.

O teste Android foi ampliado para verificar: home original sem token, abertura sem rede, ausência de telefone/OTP, botão `Where To` real, edição dos campos originais, retorno e nova abertura com rede. Publica PNG, hierarquia Android e logs sanitizados. O teste não interpreta o simples carregamento do mapa como validação de Places/Routes ou de uma corrida.

A primeira compilação deste modo, [execução 39791852321](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39791852321), fontes `725cd2fa712e01d289a4ed14865581fd329e5657`, atingiu o limite de 30 minutos na recompilação incremental: 500 de 529 módulos pendentes, último módulo anunciado `Screens.HomeScreen.Controller`. RSS máximo amostrado do processo `purs`: 14.073.572 KiB (13,42 GiB), heap limitado a 10 GiB. Não foi emitido diagnóstico de erro de código antes da interrupção. [Registro](build-reports/passageiro-entrada-direta/primeira-tentativa.json).

A auditoria e as tentativas interrompidas estão registradas em [RELATORIO-AUDITORIA-LOTES.md](RELATORIO-AUDITORIA-LOTES.md).

A compilação [39824204819](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39824204819), fontes `b62ef7c97d23455e67dec02f9f1480e1e3635c28`, recuperou o cache completo do job PureScript bem-sucedido `39785756375`. Os hashes de todos os módulos anteriores e dependências resolvidas coincidiram com essa referência, exceto `Main`; foram adicionados `Development.Passenger` e `Engineering.Helpers.DevelopmentMode`. Somente esses três módulos foram recompilados.

Os **55 lotes passaram** em 369,84 s acumulados, RSS máximo amostrado **8.244.840 KiB (7,86 GiB)**. A verificação Spago completa passou em 41,39 s sem recompilar módulos; o comando npm/PSA original também passou. Webpack/uglify passou em 4min57,34s. O APK dessa execução continha exatamente o bundle recompilado e a entrada BR. Isso não resolve o custo da compilação fria do controller: a entrega usa cache verificado pelo compilador e fontes novas efetivamente compilados, não um APK antigo modificado.

O primeiro teste Android abriu a home real durante 120 s, sem splash, sem token e sem OTP, mas seu seletor aceitava apenas `Where To : Button`. O layout original novo usa `Where are you going? : Button`; ambos estão no código histórico e agora são reconhecidos pelo teste. O reteste [39827816189](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39827816189) abriu os dois EditTexts originais, mas a captura depois da digitação falhou com `ERROR: could not get idle state`: avisos debug do decoder formavam uma fila de Toasts.

### Correções de digitação e diagnósticos

O reteste da execução `39829686085` preservou a home e os dois campos, mas revelou digitação truncada e a fila de diagnósticos ainda ativa. A tentativa de agregação em `MobilityCommonBridge.toast` não era chamada pelo caminho de toast desse SDK (nenhuma entrada esperada no log); foi retirada integralmente, incluindo o helper Java e a flag nativa. Nenhuma tela Java foi criada.

O contrato original do campo de endereço foi recuperado: `SourceChanged`/`DestinationChanged` chamam `JBridge.updateInputString` e mantêm o texto no EditText nativo durante a digitação. Reescrever `data.source/destination` a cada tecla, junto com `selectAllOnFocus`/`afterRender`, provocava perda de caracteres. O controlador de desenvolvimento agora segue o padrão original, sem iniciar pesquisa remota nem tratar texto digitado como endereço validado.

Alterar diretamente o FFI compartilhado em `39832410686` invalidou 336 módulos e voltou a exigir compilação fria de `HomeScreen.Controller`. A guarda interrompeu esse único alvo após 314,70 s, pico RSS 10.859.396 KiB. O GHC registrou 249,83 s em GC em 313,91 s totais (produtividade 20,4%). Não foi emitido erro de tipos antes da interrupção. A alteração compartilhada foi retirada.

O controle definitivo está em `Development/ConfigDiagnostics.js`, resolvido pelo Webpack **somente no empacotamento Android** para a interface `DecodeUtil/foreign.js`. Não há edição manual de bundle nem alteração dos tipos/arquivos originais usados pelo compilador. O adaptador reexporta os mesmos membros, preserva a identidade do decoder e encaminha todas as chamadas normais ao FFI original; apenas agrega os avisos de diagnóstico no modo BR Android `.debug`, mantendo cada mensagem em `console.error` e um aviso visível por contexto. Release, staging, iOS e mensagens operacionais mantêm o comportamento anterior.

O teste Node cobre oito cenários reais do adaptador e igualdade de exports. Outro teste usa o Webpack instalado no projeto com **o output real do compilador**, tanto pela entrada direta do foreign quanto pelo módulo PureScript compilado. Ambos passaram localmente com Node 18, sem instalar dependências novas. O CI exige ainda igualdade do FFI original em `output` e presença do adaptador no bundle. Contadores somente de leitura permitem verificar no contexto JOS que os diagnósticos foram recebidos e apenas um aviso foi apresentado.

O decoder permanece original, com seus defaults e diagnósticos. Os valores legados incompletos **não foram corrigidos nem declarados válidos**. Não há simulação de resposta de API. A política controla a apresentação repetitiva de diagnósticos internos de desenvolvimento; permissões, erros operacionais e autorização do backend continuam independentes.

A execução [39835346434](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39835346434), fontes `0412c314a090398adb21d35b000bbe929b8dd712`, usa o cache completo `39824204819`. Os arquivos compartilhados de `ui-common` e os arquivos Android são idênticos aos dessa referência; a correção de entrada está no controlador de desenvolvimento e a apresentação dos diagnósticos, no adaptador do empacotamento. A captura exige XML novo e válido, com até três tentativas limitadas; não aceita XML antigo nem remove as verificações funcionais.

## APK aprovado para esta etapa

- [Baixar APK — ZIP do artefato](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39835346434/artifacts/12451188384).
- [Capturas, XMLs e logs do Android](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39835346434/artifacts/12451452845).
- [Execução completa aprovada](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39835346434).
- [Registro técnico versionado](build-reports/passageiro-entrada-direta/39835346434.json).

Esta execução concluiu **todos os jobs com sucesso**. Foram 55 lotes, 290,45 s acumulados e RSS máximo amostrado **9.572.472 KiB (9,13 GiB)**. Somente `Development.Passenger` e `Main` foram recompilados; nenhum módulo original de tela precisou de compilação fria. A verificação completa passou em 32,86 s sem recompilação. Os testes do adaptador e do Webpack real, a igualdade do FFI original, o comando npm/PSA, o empacotamento e a identidade do bundle no APK passaram.

No Android 29 real emulado, a instalação/assinatura foi aceita, o processo permaneceu ativo durante 120 s e a splash terminou. Os controles nativos originais abriram sem token, telefone ou OTP, com rede desativada. O botão original abriu dois EditTexts, o destino recebeu **Avenida Paulista** inteiro, Voltar retornou à home e a reabertura com rede chegou novamente à home. Foram observados **124 diagnósticos e somente um aviso** no contexto JOS. Não houve `FATAL EXCEPTION` no log coletado. As capturas offline, search, typed, back e online foram produzidas; typed e online também foram inspecionadas visualmente.

O APK tem 126.296.403 bytes, SHA-256 `bc150dc65105b2c0d232d5b977e272996658fa4f565f32e00be16e7e62cc4b07`. Certificado debug SHA-256 `a25bc937bcb6f0e247ab81c154315df6a4e50a1853e174d8adaece03044c24cf`, SHA-1 `31e53a2e5122f044002f01add6efdb6a64b762cb`. A impressão digital identifica o certificado; a aceitação da assinatura foi verificada pela instalação Android.

### Instalação

Extraia o ZIP e instale `nyUserProd/debug/app-nyUser-prod-debug.apk`. A assinatura de desenvolvimento difere do APK anterior: desinstale a versão anterior para substituir o mesmo pacote. Essa remoção apaga suas preferências locais. Abra o aplicativo e conceda localização para usar o GPS; não é necessário informar telefone, OTP ou iniciar backend para abrir esta home de desenvolvimento.

Pacote `in.juspay.nammayatri.debug`; Activity `in.juspay.mobility.MainActivity`. Nome, marca e versões históricas permanecem: contêiner 3.0.39, bundle 3.0.118. A tradução/reidentificação completa e a comparação com a versão atual da Play Store não foram realizadas. Fagner é nome local de exibição, não uma conta de backend provisionada.

### Continuação de builds

Os fontes estão no PR #2, branch `codex/issue-1-purescript-memory`, baseada em `passageiro-pt-br`. O código do APK corresponde a `0412c314a090398adb21d35b000bbe929b8dd712`. Para repetir a compilação, selecione o workflow PureScript, `passageiro`, `full`, heap `10g` e `cache_run_id=39835346434`; requer runner com memória suficiente. O cache e os artefatos são temporários. Se a referência não existir, o workflow falha rapidamente; não há garantia de build frio dentro da guarda atual do controller. Não ampliar timeouts cegamente: investigar esse alvo isolado e preservar os checkpoints.

## Limites

O teste foi executado no Android 29 emulado, não no celular físico. A leitura de localização nativa forneceu coordenadas do emulador; precisão de GPS físico, carregamento de tiles Google Maps e integração Places/Routes não foram validados. HyperSDK/JOS e classes SDK originais continuam necessários ao contêiner de UI; não foi concluída a remoção de todos os SDKs nem uma auditoria completa do tráfego de terceiros.

Este modo libera o frontend para desenvolvimento do núcleo. Não autentica usuários e não permite operar contas do backend. Corridas, localização de motorista, rotas, sugestões reais e comunicação passageiro–motorista exigem integração posterior e não são declaradas operacionais.

A autenticação futura continuará no backend próprio, com autorização por conta. As permissões necessárias do Android continuam sendo solicitadas. Nenhum backend, serviço Alce ou ambiente de produção foi modificado ou publicado.
