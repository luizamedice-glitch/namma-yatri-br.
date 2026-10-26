# Pesquisa de endereços — passageiro original

## Auditoria inicial (2026-10-22)

Foram lidos AGENTS.md, PROJECT_STATUS.md, ARCHITECTURE.md e ROADMAP.md antes da implementação. Baseline: commit bb13872b40, workflow 39852288044, APK artefato 12458705677, abertura/navegação no Android 29 aprovadas e marca visual conferida na captura home-online-1.png. O usuário confirmou que **não existe backend Yatri acessível**. O serviço Alce não é utilizado.

`Development.Passenger` já abre `HomeView.view` com o modelo original. `Components.SearchLocationModel.View` oferece campos nativos, debounce e a lista `LocationListItem`. Os eventos `SourceChanged`, `DestinationChanged`, `DebounceCallBack` e `LocationListItemActionController` são reutilizados; nenhum desses componentes foi reescrito. Os serviços originais dependem da autenticação/infraestrutura indiana e não são iniciados no controlador BR.

O backend Node brasileiro possui POST `/v1/places/autocomplete` (`{input,location?:{lat,lng}}` → `{suggestions:[{placeId,address}]}`) e POST `/v1/places/details` (`{placeId}` → `{placeId,address,location:{lat,lng}}`). Ambos exigem Bearer. `src/maps.mjs` usa Google Places New com `pt-BR`, BR e autocomplete restrito ao Brasil. `/v1/development/session` permite autenticar Fagner com a credencial específica do passageiro, já existente no backend. Não foi alterada a autenticação do servidor ou das variantes de produção.

## Implementação

- `Development.PlacesClient.mjs`: contrato do backend, autenticação de desenvolvimento restrita a Fagner, compartilhamento de sessão concorrente, renovação única após 401, validação de respostas/coordenadas. Sem resultados de fallback ou Google server key no APK.
- `Development.Places.{purs,js}`: FFI restrito a Android BR debug, transporte HTTP nativo existente (`JBridge.callAPI`/callbackMapper), timeout de 15s por requisição, cancelamento lógico e descarte de respostas antigas. As opções nativas dispensam CORS do WebView. O snapshot de diagnóstico não contém credenciais/tokens.
- `Development.Passenger`: mantém edição no EditText nativo; apresenta sugestões no componente original, pede detalhes antes da seleção, guarda texto/placeId/coordenadas nos campos originais, move a câmera e exibe marcador original. GPS continua sendo origem padrão e não sobrescreve origem manual. Voltar cancela requisições pendentes e mantém endereços selecionados durante a sessão.
- Android Gradle: gera arquivo de configuração dentro dos assets somente para BR debug; permite HTTP de rede privada apenas nessa variante. Originais e produção permanecem preservados. HTTP público e a função compartilhada Alce são recusados pelo cliente.

## Configuração necessária

No servidor Yatri privado: PostgreSQL/migrations existentes; `YATRI_DEVELOPMENT_MODE=true`, `YATRI_PASSENGER_DEV_KEY`, `YATRI_DRIVER_DEV_KEY` distintos (64 caracteres hexadecimais), configuração do veículo exigida pelo provisionador existente e `GOOGLE_MAPS_SERVER_KEY` com Places API New habilitada. Chave de servidor permanece no servidor. Backend não foi implantado nem alterado nesta etapa.

No build do APK:

- `YATRI_BACKEND_URL`: URL **exclusiva da Yatri**, HTTPS ou HTTP em rede privada de desenvolvimento; no Actions, repository variable de mesmo nome.
- `YATRI_PASSENGER_DEV_KEY`: repository secret ou variável de ambiente de build. Credencial de teste recuperável do APK, limitada à conta passageiro; não reutilizar credenciais de produção. Nenhuma chave de motorista é incorporada.
- `GOOGLE_MAPS_API_KEY`: chave Android existente, com Maps SDK habilitado e restrições de pacote/certificado corretas.

Sem servidor/credencial, a home continua acessível e a busca informa que o backend não está configurado. Isso **não** equivale a pesquisa operacional. A configuração deve ser fornecida ao compilar, sem telas manuais novas no APK.

## Verificação

`node --test Frontend/scripts/test-development-places.mjs`: fixtures explícitas de contrato e ponte nativa; não são prova de respostas reais Google. Cobre identidade, sessão concorrente/expirada, validação, GPS ausente, base64/URI, troca de campo, respostas atrasadas, cancelamento e bloqueio em release. O teste opcional `verify-places-provider.mjs` consulta Google real somente se houver GOOGLE_MAPS_SERVER_KEY no CI e registra `not_configured` quando ausente. Ele verifica o provedor, não substitui o teste Android→backend.

A compilação utiliza `cache_run_id=39835346434`, lotes de 25, limites de memória e guarda de progresso existentes. Sem alteração nos módulos compartilhados ou no HomeScreen original. Build incremental e testes Android desta implementação ainda em execução; resultados serão acrescentados ao concluir.

**Critério de aceitação real ainda pendente:** emulador/celular → backend Yatri com sessão real → Google Places → sugestão/seleção no componente original → mapa. Não há backend acessível informado. Não há implementação de corridas nesta etapa.

### Primeira compilação incremental

Run 39864104050: cache 39835346434 recuperado, sem compilação fria. Parou no lote 40/55 por ausência de Show/Loggable na ação local nova (erro de tipo, não OOM); instâncias adicionadas com logging vazio, preservando privacidade dos endereços. Provider real registrou `not_configured`: GOOGLE_MAPS_SERVER_KEY ausente no CI. Onze testes locais do adaptador passaram e o Webpack original compilou isoladamente o FFI em 2,27 s. Nova execução verificará a correção e os testes Android ampliados.

### Configuração Android e limpeza de seleção

Secret informada pelo usuário: `Google_Maps_API_Key` (nomes são insensíveis à caixa no GitHub). O workflow usa esse nome explicitamente e publica somente indicadores booleanos de presença de configuração. BR debug deixa de usar a chave histórica de fallback do projeto original; release mantém o comportamento anterior. O GPS não reescreve o campo enquanto a busca está aberta. Limpar uma seleção também limpa endereço estruturado, placeId, coordenadas e marcador correspondente, evitando reaproveitamento de um ponto anterior.

O controle de recentrar usa o GPS nativo com timeout de 8 s, sem apagar seleções manuais. Ao reabrir o mapa, a câmera respeita se a última seleção foi origem ou destino, mesmo quando ambos já estão definidos. O teste de contrato também cobre nova busca bem-sucedida após falha de conexão.

O arquivo que contém a configuração e a credencial de Fagner pertence exclusivamente ao source set `nyUserProdDebug`. Ele não é incorporado aos APKs do motorista nem às variantes release.

A permissão nativa de HTTP para testes em LAN também é um overlay exclusivo do `nyUserProdDebug`, ativado por `brTestMode`; o manifesto compartilhado do motorista não foi alterado por esta etapa.

A exigência da chave Android BR sem fallback histórico é aplicada por meta-data no mesmo overlay específico do passageiro; as configurações de mapas das outras variantes permanecem iguais às anteriores.

## Resultado de compilação e configurações efetivas

Fontes PureScript: commit `478901e0b2`, run `39866367286`, job PureScript aprovado. A execução completa foi cancelada depois desse job para evitar repetir o APK com configuração nativa anterior. Bundle e cache completos foram preservados. APK final: commit `76a6a0dd26`, run `39868182216`, reutilizando o mesmo bundle após comparação estrita dos fontes; não houve outra compilação PureScript nesse run.

| Verificação | Resultado |
| --- | --- |
| Adaptador de contrato/FFI | 11 testes aprovados; fixtures explícitas |
| Compilação incremental medida | 55 chamadas, **374,62 s (6 min 14,62 s)** |
| Módulos recompilados | somente Development.Places, Development.Passenger e Main |
| Pico de RSS do compilador | **8.346.884 KiB (7,96 GiB)** |
| Verificação final de cache completo | 41,33 s; nenhuma recompilação; 8.031.576 KiB |
| Comando original npm/PSA | aprovado, 41,85 s |
| Webpack original | aprovado, 267,61 s |
| Compilação Android final | aprovada, 197,35 s |
| Google Places real no CI | **NÃO CONFIGURADO**: GOOGLE_MAPS_SERVER_KEY indisponível |

O build final confirmou `GOOGLE_MAPS_API_KEY=true`, `YATRI_BACKEND_URL=false` e `YATRI_PASSENGER_DEV_KEY=false` (somente indicadores de presença, sem valores). A secret `Google_Maps_API_Key` informada pelo usuário foi disponibilizada à execução nova. O APK contém o arquivo de configuração, ainda sem servidor/credencial. Logo, **a pesquisa real de origem/destino não está aprovada de ponta a ponta**. O usuário confirmou que não há backend Yatri acessível; não foi implantado nenhum servidor público nem usado o backend Alce.

As três imagens principais e os cinco ícones por densidade extraídos do APK final são idênticos, por pixels, aos PNGs fornecidos. HomeScreen e componentes originais, backend e motorista foram comparados com a baseline e permanecem sem mudanças nesta etapa. A autenticação de produção permanece preservada.

APK: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39868182216/artifacts/12465491616 . SHA256 `2c1a87930e10ebc40e41886126bd58326540a7a6445aeaf57a1c558fb48283f0`, 128.341.644 bytes. Pacote `in.juspay.nammayatri.debug`. Certificado debug SHA-1 `2F:96:7F:CE:00:A5:3B:27:4B:40:AF:0B:BD:C0:EE:6B:4F:50:7D:C0`; use esse pacote/certificado para conferir restrições da chave Android. O certificado foi lido do APK; a validação criptográfica da instalação cabe ao Android no emulador. Assinaturas de builds debug anteriores podem diferir; nesse caso, é necessário desinstalar a versão anterior antes de instalar esta.

## Arquivos desta etapa

- `Development/Passenger.purs`: controlador BR, ações locais, sugestões/seleção, GPS, câmera e marcadores; a view é a original.
- `Development/Places.purs`, `Places.js`, `PlacesClient.mjs`: FFI, transporte nativo, contrato e sessão de desenvolvimento.
- `Frontend/android-native/app/build.gradle` e `app/src/brTest/passenger/AndroidManifest.xml`: configuração gerada e overlay exclusivos do passageiro BR debug.
- `.github/workflows/br-purescript-memory.yml`: testes, verificação opcional do provedor, injeção de configuração e diagnósticos sanitizados.
- `Frontend/scripts/test-development-places.mjs`, `verify-places-provider.mjs`: testes de contrato e consulta opcional ao Google real.
- `Frontend/scripts/test-original-home.py`, `inspect-original-webview.py`, `test-original-passenger.sh`: navegação/campos originais, diagnóstico somente de leitura e sanitização de logs.
- Este relatório, JSON em `Frontend/build-reports/passageiro-enderecos/`, `PROJECT_STATUS.md` e `ROADMAP.md`: resultados e pendências.

## Pendências para o aceite real

Disponibilizar um backend **exclusivo da Yatri** em rede privada acessível ao dispositivo, com PostgreSQL e provisionamento de desenvolvimento já existentes, habilitar Google Places New no servidor e fornecer `GOOGLE_MAPS_SERVER_KEY`. Definir URL e credencial do passageiro no build. Depois executar a seleção de origem e destino contra esse servidor real e conferir as coordenadas no mapa. O teste Android está preparado para exigir sugestões/seleção quando o backend estiver configurado; sem configuração ele registra explicitamente `not_validated`, mesmo que a navegação e o tratamento de erro passem.

Não foram implementadas corridas, rotas, normalização de componentes postais ou persistência de endereços após encerrar o processo. As seleções são preservadas durante a navegação da sessão. O cache evita a recompilação dos módulos históricos, mas um build frio continua com as limitações de memória documentadas em PURESCRIPT-MEMORIA.md.

## Teste Android final e evidências

**Run 39868182216: aprovado** no emulador Android 29 / google_apis / Pixel 2. A instalação Android validou o APK e o processo permaneceu vivo, sem FATAL EXCEPTION. Foram verificados abertura direta sem token/OTP offline e online, digitação integral de destino **Avenida Paulista, Sao Paulo**, digitação integral de origem **Praca da Se, Sao Paulo**, erro explícito de backend não configurado e retorno à home. As imagens `home-places-source-typed.png` e `home-places-return-1.png` foram inspecionadas: mostram campos originais, toast real de configuração ausente, logotipo fornecido e mapa com tiles.

Capturas/XML/logs: https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39868182216/artifacts/12465587491 . `places-acceptance.json` registra **acceptance: not_validated**, motivo **Backend Yatri/credencial não configurados no APK**. Esse resultado não foi convertido em aprovação de pesquisa real. Sugestões, seleção e reposicionamento após uma resposta real do backend ainda precisam do ambiente configurado; os testes de contrato não substituem essa prova.

Permanecem avisos legados não bloqueantes de configuração e Firebase-Installations (`API_KEY_INVALID` do projeto offline de teste). Eles não são falhas de autorização do Maps SDK e não impediram a home/mapa neste run. A remoção completa desses SDKs/serviços não foi realizada nesta etapa.

**Critério de conclusão da pesquisa real: NÃO ATINGIDO nesta execução**, por ausência do backend Yatri acessível e das configurações de servidor. Implementação, compilação, navegação, campos e tratamento do bloqueio foram entregues e verificados sem simular respostas.
