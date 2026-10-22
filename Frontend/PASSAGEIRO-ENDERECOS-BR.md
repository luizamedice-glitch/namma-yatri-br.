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
