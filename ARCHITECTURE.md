# Yatri Brasil — mapa arquitetural inicial

Este documento é uma hipótese de trabalho a verificar no código. Não é declaração de que todas as integrações funcionam hoje.

## Camadas
- **Frontend passageiro:** base original Namma Yatri, PureScript/PrestoDOM; componente de interesse: `Screens.HomeScreen.View`. Controlador debug relatado: `Frontend/ui-customer/src/Development/Passenger.purs`.
- **Android / ponte nativa:** empacotamento, permissões, APIs de localização e integração entre runtime nativo e frontend. Inspecionar variantes debug/release e JBridge/HyperSDK.
- **Frontend motorista:** código original a inventariar e validar antes de alterar.
- **Camada adaptadora brasileira (a especificar):** tradutores entre ações/estados originais e contratos HTTP/eventos do backend brasileiro.
- **Backend Yatri Brasil (a auditar):** identidade/autenticação, pesquisa, tarifa, corrida, despacho, estados, persistência e eventos. Confirmar endpoints e fonte única de verdade antes de qualquer conexão.
- **Serviços de infraestrutura externos:** mapas/geocodificação/rotas, notificações, pagamentos, monitoramento; nenhum fornecedor deve ser presumido como já operacional.

## Limites e princípios
1. A interface original não deve conhecer detalhes de infraestrutura brasileira além dos contratos adaptadores.
2. Uma única autoridade para estado de corridas e aceite do motorista.
3. Localização, histórico e pagamentos não devem ser simulados silenciosamente como funcionais.
4. Bypass de login, dados de teste e logging detalhado são exclusivamente de desenvolvimento.
5. Mudanças na ponte Android precisam de teste nativo; mudanças PureScript podem usar compilação incremental, quando disponível.
6. O projeto Alce não é dependência nem parte deste repositório.
7. Analisar cuidadosamente integrações com serviços originais indianos antes de escolher substituição.

## Fluxo-alvo incremental
HomeScreen -> pesquisa de origem/destino -> rota e ETA -> cotação -> solicitação persistida -> oferta ao motorista -> aceite -> eventos de corrida -> conclusão.

## Itens para detalhar após auditoria
Caminhos reais de módulos, entrypoints e scripts; endpoints/contratos; esquema do banco; provedores de localização/mapa; distribuição dos eventos; autenticação; status de integração do motorista; dependências externas e licenças.

## Integração verificada em 24/10/2026

O mapa inicial acima é histórico. O run `40134223066` validou o ciclo completo de estados nos dois APKs e no Lightsail/PostgreSQL, sem homologar produção ou navegação ao vivo.

- Entradas debug: `Development.Passenger`/`Development.Booking`/`Development.Rides` no passageiro e `Development.Driver` no motorista. HomeScreens originais preservadas; etapas usam os componentes existentes `PrimaryButton` e `SourceToDestination` via `Development.PilotTrip`. Produção mantém seu fluxo de autenticação.
- Transporte Android: `Frontend/ui-driver/src/Development/NativeTransport.mjs`, também utilizado pelo passageiro, adapta a ponte HTTP original. Não exige CORS aberto para a origem opaca do WebView. Configurações/sessões ficam no store privado nativo, fora do APK; conexão de desenvolvimento por código de uso único/24h.
- Autoridade operacional: `brasil/backend/src/mobility.mjs` e PostgreSQL existentes. `driver-pilot.mjs` restringe o serviço temporário aos perfis/IDs de Fagner e Giselo, janela vigente e rotas explícitas. Transições e concorrência são verificadas no servidor. Não há dois bancos ou estado de corrida simulado no cliente.
- Atualizações: passageiro consulta a cada 3s e motorista a cada 5s enquanto o painel está ativo. Snapshot contém viagens ativas; GET da própria viagem recupera conclusão/cancelamento e IDs privados permitem retomada após recriar processos. Respostas antigas do motorista são descartadas; fechamento visual não despacha eventos síncronos reentrantes durante a avaliação do clique.
- Google Places/Routes e tiles Maps reais aprovados no emulador. Permanecem pendentes mapa/trajeto do motorista durante a viagem, navegação, segundo plano e dois aparelhos físicos. SDKs nativos de compatibilidade continuam no APK; isso não significa uso obrigatório dos serviços indianos, Firebase Push, KYC ou pagamentos no fluxo de testes.

## Mapa da corrida — incremento em validação

`Development.PilotTrip` define o modelo visual compartilhado e um contêiner
PrestoDOM para o mapa nativo existente. `TripMapRuntime.js` usa `showMap`,
`drawRouteV2` e `showMarker` da ponte Android; `TripMap.mjs` decodifica a geometria
Google sem substituí-la por linhas retas. O runtime recebe o mapper do frontend,
sem depender de instalação npm em ui-common.

Passageiro consulta estado a cada 3 s; motorista publica GPS e consulta a cada
5 s enquanto o app está ativo. Marcador só aparece como atualizado com GPS de
menos de 60 s. GET autenticado `/v1/rides/:id/navigation` verifica a associação
persistida antes de consultar/cachear a rota motorista→embarque; ambos os perfis
compartilham uma consulta por 30 s. Durante a viagem usa a rota da cotação.
A menos de 25 m do embarque não solicita uma rota Google de distância zero.
Não há migration, cobrança financeira nem navegação curva a curva neste incremento.

## Cadência do passageiro — corrigida e verificada em 25/10/2026

No passageiro BR debug, `MobilityCustomerBridge.PassengerClock` acorda o cliente
a cada 3 s com a Activity retomada. O script usa `window.callUICallback`, cujo
roteador original do SDK entrega o ID ao consumidor PureScript; variáveis de
callbacks do consumidor não devem ser procuradas diretamente no contexto host.
`nativeTicks` conta o recebimento, separado dos disparos/scheduling Android.
API 36 confirmou 130/130 entregas sem reinício e parada ao voltar à Home.

A autoridade continua sendo a API autenticada/PostgreSQL: o relógio só solicita
uma leitura, sem carregar URL, credencial ou resposta operacional. Estados são
publicados sem aguardar Google Routes, e respostas antigas mantêm os guards
existentes. Gate exclusivo do pacote passageiro debug, recurso de piloto e
sessão privada. Produção, motorista e navegação visual permanecem preservados.

## Robustez e diagnóstico do runtime passageiro BR debug

A entrada do passageiro preserva JBridge sem decorá-lo com telemetria Firebase
no modo brasileiro. O dispatcher resolve callbacks por propriedade ou Map,
incluindo outro contexto JS; o indicador do mapper acompanha o registro real
sem substituí-lo. Produção mantém a instrumentação anterior.

Rides envia somente contadores/fase a uma memória diagnóstica nativa filtrada.
Três eventos Volume+ rápidos, exclusivamente no passageiro BR debug, exportam
esse snapshot por clipboard/arquivo privado. Nenhum dado é enviado a serviços.
A idade da observação JS distingue um snapshot antigo de uma resposta recente.
A investigação do Samsung A07 continua aberta; os aceites de ciclo frio em
emulador não substituem a confirmação nesse aparelho.
