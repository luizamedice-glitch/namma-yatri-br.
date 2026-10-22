# Yatri Brasil — roadmap técnico

Cada fase deve entregar resultado verificável. O trabalho pode ser organizado em incrementos curtos, mas não se considera uma fase concluída sem os critérios abaixo.

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
