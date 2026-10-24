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
