# Yatri Brasil — roadmap técnico

## Marco atual — queda de banco e backup, 25/10/2026

Queda/retorno real de PostgreSQL isolado e restauração de dump real do Lightsail
aprovados em `40241759979`/`40241777998`. Backup cifrado diário e monitor local
ativos; cópia externa verificada. PR #5 autorizado e incorporado: cron externo
ativo na main para backup diário e saúde a cada 15 minutos.
Nenhuma troca de banco ativo ou reconstrução completa do servidor foi executada.
Detalhes: `brasil/backend/ops/RECOVERY-REPORT-2026-10-25.md`.

Próximos: carga/concorrência sustentada em ambiente isolado, duração prolongada
em dois celulares e assinatura persistente. Medir RTO em instância alternativa
com configurações/secrets revisados. Pagamentos/Firebase/autenticação definitiva
permanecem adiados; proteção atual mantida.

## Marco atual — recuperação operacional, 25/10/2026

Backend `f585ad66f82e` implantado em `40236965537`: reenvios após resposta perdida
não duplicam transições/eventos; PostgreSQL/API com SIGKILL de Node aprovados.
Motorista recupera rede/GPS e preserva intenção online sem ofertas com GPS antigo.
APK `40236963482` aprovado em Android 16/10 (`40237490959`/`40238396498`).
Proprietário confirmou a versão anterior operacional; falta confirmação física
desta recuperação nova em corrida completa com dois celulares e tela bloqueada.

Depois: duração prolongada/bateria/Doze/OEM, falha/retorno do PostgreSQL,
backup/observabilidade, carga isolada e assinatura persistente. Pagamentos,
Firebase e autenticação definitiva ficam para os ajustes finais por orientação
explícita; não retirar a proteção das sessões/perfis de teste existentes.

## Marco atual — piloto em segundo plano, 25/10/2026

Motorista com GPS e alertas nativos independente do WebView aprovado em Android
16/10: `40222825183`/`40222827520`, APK build `40222415126`. Proprietário optou
por consulta periódica nativa para testes e adiou Firebase. Fonte de verdade
permanece no backend existente; sem novas rotas/migrations/deploy.

Próximo aceite: instalar motorista atualizado, conceder localização precisa e
notificações, ficar disponível, bloquear a tela e testar chamada/deslocamento
em dois celulares contra Lightsail. Confirmar mapa do passageiro, retorno pela
notificação e parada ao ficar offline. O aceite emulador validou a posição pela
API de passageiro; não substitui esse teste físico. Depois: bateria/Doze/OEM,
reconexão nativa, assinatura debug persistente e Firebase/push remoto. Forçar
parada pelo sistema exige reabrir o app e não é corrigido por Firebase.

## Marco atual — Geoapify e mapa, 25/10/2026

Geocoding reverso autenticado, endereço GPS real e revisão dos marcadores/
enquadramento do passageiro aprovados em Android 16 (`40213953987`) e
implantados no Lightsail (`40215991172`); consulta real do provedor no serviço
aprovada (`40216101093`). Preservadas as correções de runtime/reconexão.
Próximos passos: confirmar o novo endereço GPS no aparelho físico, teste de rua
em dois celulares, assinatura debug persistente e operação em segundo plano/push.
Não confundir geocoding com substituição de Google Maps/Places/Routes.

Cada fase deve entregar resultado verificável. O trabalho pode ser organizado em incrementos curtos, mas não se considera uma fase concluída sem os critérios abaixo.

## Incremento autorizado em 2026-10-23 — motor sem login no APK de teste

Infraestrutura e Google reais disponíveis. Proprietário autorizou contornar
autenticação na versão de teste: motor isolado de mapas sem banco/sessão, três
rotas POST temporárias e APK passageiro BR debug sem credencial embutida.
Implantação validada no run 40002766100; APK compilado no run 40005145677,
reutilizando output PureScript validado. Aceite Android de busca/seleção real
APROVADO em API 29: origem Praça da Sé e destino Av. Paulista, mapa correspondente
e endereços preservados ao reabrir a busca, sem login/OTP. Evidências no artefato
12523888694. Esse marco precede corridas, motorista e autenticação definitiva.

## Fase 1 — Auditoria e baseline
**Entregas:** inventário de módulos, dependências externas, backend brasileiro e CI; matriz de funcionalidades com estados comprovados; APK baseline identificado por commit.
**Aceite:** documentação aponta o SHA exato, como reproduzir o build, o que funciona em Android e o que falta.

## Fase 2 — Compilação e feedback rápidos
**Entregas:** compilação incremental com cache persistente, separação entre bundle e APK, métricas de tempo e falha; processo para testes de mudanças no frontend.
**Aceite:** uma alteração simples é recompilada sem build completo do zero; resultados e limitações medidos em CI ou ambiente de desenvolvimento.

## Fase 3 — HomeScreen e navegação do passageiro
**Entregas:** abertura debug da HomeScreen, mapa, localização, edição de origem/destino, pesquisa e retorno sem travamentos.
**Aceite:** roteiro de testes em Android com evidências; produção não pode ignorar autenticação.

## Fase 4 — Serviços brasileiros e primeira solicitação
**Entregas:** adaptadores de API para busca de endereço, rotas, ETA, tarifa, autenticação brasileira e estados de corrida; erros reais tratados.
**Aceite:** uma corrida de teste sai da tela do passageiro, é persistida no backend escolhido e seu estado é consultável; nenhuma resposta fictícia em ambiente operacional.

## Fase 5 — Motorista
**Entregas:** aplicativo motorista original adaptado, disponibilidade, ofertas, aceite, localização, estados de embarque/conclusão.
**Aceite:** corrida de teste solicitada por passageiro chega a motorista, é aceita e sincroniza estados, com controle de concorrência.

## Fase 6 — Robustez e operação
**Entregas:** cancelamentos, falhas de rede, reconexão, push, localização em segundo plano, logs e métricas, segurança, integridade de estado e testes de carga.
**Aceite:** fluxos críticos passam em testes de integração e cenários negativos documentados.

## Fase 7 — Preparação comercial
**Entregas:** builds release sem bypass, revisão de segurança e LGPD, licenciamento AGPL, publicação, monitoramento, suporte e piloto controlado.
**Aceite:** checklist de lançamento aprovado e piloto operacional monitorado.

## Priorização imediata
Executar Fase 1 em paralelo ao diagnóstico de build da Fase 2. Concentrar intervenções de produto na Fase 3 até haver evidência real de navegação. Não antecipar recursos cosméticos ou comerciais que dependam de fluxos ainda não integrados.

## Incremento atual — endereços reais antes de corridas

Prioridade imediata: conectar os campos/lista originais ao contrato brasileiro de autocomplete/detalhes, manter origem GPS/manual, persistir seleção durante a navegação e mover mapa/marcadores. Adaptador implementado e compilado; testes de navegação/campos/erro de configuração no Android aprovados no run 39868182216. Onze testes de contrato passaram; a pesquisa real não foi aprovada. Sem backend Yatri acessível informado, o aceite de pesquisa real permanece pendente; testes de contrato não substituem o fluxo com Google e servidor reais. Corridas e motorista ficam fora deste incremento. Identidade aprovada no run 39852288044 deve ser preservada.


Próximo aceite obrigatório: servidor exclusivo Yatri acessível com sessão de Fagner e Google Places New configurados → sugestões reais no componente original → seleção de origem e destino → texto/coordenadas preservados → mapa correspondente. `places-acceptance.json` permanece `not_validated` até esse fluxo ocorrer; o build verde atual cobre navegação e bloqueio explícito, sem simulações. Não avançar para corridas com base somente neste APK.

Identidade atualizada por solicitação do proprietário (2026-10-23): novo pacote oficial aplicado exclusivamente ao passageiro debug, sem alterar prioridades de integração. APK do run 39881766117, validação visual/funcional Android aprovada no run 39882870977; relatório `Frontend/PASSAGEIRO-IDENTIDADE-OFICIAL.md`. Preservar estas artes (ícone estrada/pino, splash completa azul, Home com logo completo azul sem moldura). Próximo aceite de Places continua pendente, independente desta validação de identidade.

Preparação do servidor (2026-10-23): atualização e rollback da API implementados e testados em Compose isolado, preservando PostgreSQL e bloqueando migrations diferentes. Aplicação no Lightsail aguarda acesso remoto configurado pelo proprietário. Depois da inspeção/atualização real, concluir desenho de sessões e revisar endpoints necessários à pesquisa; não considerar `/health` 200 como aceite da integração Android.


Português do passageiro (2026-10-24): catálogo e interface BR empacotados sem recompilar PureScript; Home, busca e seleção real aprovadas em Android API 29 no run 40057802186. Revisar traduções secundárias ao habilitar seus fluxos; preservar identidade e isolamento das variantes de produção. Relatório em `Frontend/build-reports/passageiro-portugues/40057802186.json`.


Navegação inferior do passageiro (2026-10-24): Início/Carteira/Perfil, views originais e estado preservado, aprovados em Android API 29 no run 40063516106. Carteira permanece explicitamente indisponível e perfil usa dados locais de teste. Integrar serviços reais e edição somente após desenho de sessão; validar Android 12 e navegação de produção em incremento próprio. Relatório `Frontend/build-reports/passageiro-navegacao/40063516106.json`.

Motorista de testes, autorizado em 2026-10-24: reutilizar HomeScreen original por entrada debug isolada; sem login/OTP/KYC, mantendo sessão de Giselo validada pelo backend e provisionada fora do APK. Bundle/APK já compilados e cliente operacional validado em PostgreSQL/HTTP. Prioridade imediata é resolver e aprovar abertura, GPS e disponibilidade no emulador. Depois ligar ofertas e estados de viagem às views originais e testar os dois APKs. O teste HTTP com fixture de Routes não comprova esse aceite. Preservar produção e passageiro; não liberar rotas operacionais públicas do Lightsail automaticamente.


## Incremento motorista — painel original de testes (2026-10-24)

APK inicial do motorista compilado e aprovado em Pixel 2/API 29 no run
40111273590: abertura sem login, mapa com tiles, GPS e disponibilidade
confirmados na API/PostgreSQL locais. Defaults opcionais completos eliminam os
avisos de configuração do painel. Detalhes em PROJECT_STATUS.md e no relatório
Frontend/build-reports/motorista-original/40111273590.json. A Fase 5 continua
aberta: faltam ligar ofertas e ações de viagem às views originais, integrar
solicitação do passageiro, sincronizar os dois APKs e validar backend remoto
com sessões privadas provisionadas. Não há alteração do Lightsail neste marco.


### Motorista — conexão remota do painel validada

Em 24/10/2026, cadastro real privado de Giselo/veículo e conexão pelo celular
via código de uso único concluídos. APK 40116465299; aceite Android API 29
contra Lightsail 40117202534 aprovado: tela nativa de ativação, GPS do emulador
e disponibilidade confirmados na API/PostgreSQL reais. A Fase 5 permanece
aberta para ofertas e ações de viagem nas views originais, solicitação pelo
passageiro e sincronização dos dois APKs.

Marco confirmado `40121323902` (fontes `f0bfa4f447`): chamada real entre os dois APKs aprovada até aceite e cancelamento, com Google e Lightsail. Continuação imediata: chegada → início → conclusão, recuperação após recriar os processos e confirmação dos mesmos estados nas duas interfaces. Implementação e contratos locais preparados; falta aprovar os novos APKs no Android e a fronteira HTTPS atualizada. Sem pagamentos e sem ampliação de funcionalidades paralelas.

Marco **40134223066 aprovado**, fontes `32d7e1d496`: ciclo pedido/oferta/aceite/chegada/início/conclusão confirmado nos dois APKs e no PostgreSQL Lightsail; cancelamento, recuperação após recriar processos e retorno efetivo ao painel aprovados em Android API 29. A implementação das etapas usa os componentes PureScript existentes. Backend implantado no piloto autenticado, sem renovar sua janela. Relatório em `Frontend/build-reports/ciclo-completo/40134223066.json`.

Próximo incremento da Fase 5: mapa/trajeto e localização do motorista durante a viagem, navegação até o embarque, indicador de horário GPS, segundo plano e validação em dois celulares físicos/Android 12+. Manter controles financeiros e menus secundários fora do escopo operacional aprovado; não considerar o teste de estados uma homologação de produção.

Próximo incremento autorizado: acompanhamento no mapa durante o ciclo completo,
com rota Google até o embarque, geometria da viagem e GPS real do Android enviado
pelo aplicativo motorista. Aceite deve comprovar o traçado nos dois APKs e a
posição atualizada no passageiro, preservando conclusão, cancelamento e retomada.
Após este aceite, priorizar operação em segundo plano/push e teste de campo em
dois celulares; pagamentos reais seguem fora do piloto.

25/10/2026: ciclo completo com rota e posição do veículo aprovado nos dois
APKs contra Google/Lightsail, run 40145108191. Próximos passos: teste de rua
com dois celulares; corrigir a chave legada de limpeza dos pinos de origem;
operação em segundo plano/push. Relatório em
Frontend/build-reports/mapa-corrida/RELATORIO.md. Pagamentos e navegação curva
a curva continuam fora do aceite.

25/10/2026: bloqueio na primeira busca reproduzido no API 36 e corrigido pelo
roteamento original de callbacks do SDK. APK `40155730331` aprovado no Android
16 com 330 s em espera e ciclo completo sem reabrir; mesmo APK aprovado no
Android 10 e com corte efetivo/recuperação da conexão (`40156836847`). Confirmar
este APK no celular do proprietário antes do próximo teste de campo. Preservar
mapas/rotas atuais; segundo plano/push e limpeza de pinos permanecem pendentes.
Relatório: `Frontend/build-reports/passageiro-atualizacao/RELATORIO.md`.

Incidente reaberto em 25/10: A07/Android 16 ainda bloqueia UI na abertura fria.
Runtime fortalecido e diagnóstico local entregues nas fontes 735cfdd21e;
controles/retomada/processo frio/exportação aprovados em API 29 e 36. Próximo
critério: confirmar no Samsung ou coletar o diagnóstico durante o bloqueio,
antes de encerrar o incidente. Não usar o aceite do emulador como prova física.
Relatório: Frontend/build-reports/passageiro-cold-runtime/RELATORIO.md.

25/10/2026: proprietário confirmou resolução do bloqueio no Samsung A07 com
o runtime entregue. Teste de rua adiado por indisponibilidade dos dois aparelhos.
Próximo incremento verificável: reconexão do passageiro com aviso persistente,
recuperação da cotação e reconciliação de solicitações cuja resposta se perdeu,
sem reenvio automático. Preservar runtime, mapas e produção. Aceite: testes
negativos e Android com corte real de transporte, mesma Activity/processo,
retomada dos estados e remoção do aviso após reconectar.

Reconexão aprovada em 25/10: Android 16 `40202387656` validou cotação offline,
perda parcial da resposta de POST com um único envio, dois cortes de transporte
e recuperação dos estados com mesmo PID. Android 10 `40201809248` validou
controles e processo frio no mesmo APK. Fontes `5833a5d5cb`, relatório
Frontend/build-reports/passageiro-reconexao/RELATORIO.md. Próximo ajuste de
distribuição: assinatura debug persistente para evitar reinstalações; depois
pinos legados e teste de rua quando houver dois aparelhos disponíveis.


26/10/2026: ícone exclusivo do motorista (arte vinho Driver) compilado no run
40257355937 e aprovado em Android 16 no 40258541630, incluindo cinco casos
operacionais de recuperação/GPS/oferta/aceite/parada. Fontes recentes preservadas,
76 assets/bundle intactos; zero compilação PureScript. Assinatura persistente e
teste físico prolongado continuam pendentes. Relatório
Frontend/build-reports/motorista-icone/RELATORIO.md.
