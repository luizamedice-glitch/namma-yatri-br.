Relatório de 24/10/2026 — Alce Yatri Brasil, ciclo operacional de testes

Retomada do código do proprietário em `f0bfa4f447`. APKs validados nas fontes
`32d7e1d496`, branch `codex/issue-1-purescript-memory`.
O [workflow 40134223066](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40134223066)
terminou aprovado. Dados estruturados, arquivos alterados, hashes dos APKs e dos
ZIPs estão em [40134223066.json](40134223066.json).

| Entrega | Artefato |
| --- | --- |
| Passageiro, Fagner | [APK debug em ZIP](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40134223066/artifacts/12576033149) |
| Motorista, Giselo | [APK debug em ZIP](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40134223066/artifacts/12575763574) |
| Aceite e capturas | [Evidências Android](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40134223066/artifacts/12576283319) |

As etapas chegada, início e conclusão foram ligadas ao backend e às interfaces
PureScript existentes. Os aplicativos mostram os estados recebidos do servidor;
viagens encerradas são consultadas por ID, pois o snapshot lista somente as
ativas. O passageiro pode retomar pelo botão “Acompanhar viagem” após recriar o
processo. IDs são guardados no armazenamento privado, sem credenciais estáticas
incorporadas ao APK. HomeScreens, marca, licenças e autenticação de produção
foram preservadas.

O teste utilizou dois APKs em Pixel 2/API 29, alternando o primeiro plano:
ativação privada dos dois perfis → endereços Google reais → estimativa → pedido
persistido → oferta correspondente → aceite → chegada → início → conclusão.
Também verificou cancelamento, dados do motorista/veículo no passageiro,
recuperação dos processos e retorno efetivo ao painel. Banco PostgreSQL e API
Lightsail reais; nenhum fixture Google nesse aceite. Diagnóstico: zero exceções
fatais/ANRs. Capturas do motorista e da Home final conferidas visualmente; sem
publicar código de ativação, placa ou logcat bruto.

A revisão visual do primeiro aceite revelou retorno ao painel não coberto pelo
teste. O run `40133735562` reproduziu a falha no mesmo APK. A correção evita um
evento síncrono reentrante durante o clique de fechamento e deixa o controlador
concluir sua própria mudança visual. O teste ampliado passou no APK final.

Compilação final: somente `Development.Driver` recompilado, 46,74 s somados de
compilador, pico RSS amostrado de 2,20 GiB, lotes de até 25 módulos e guardas de
tempo/RSS. Passageiro reutilizado do run `40131968906`, com comparação estrita
das fontes e dependências e igualdade do bundle no APK; zero compilação
passageiro nessa rodada. Medição da rodada fonte: 247,75 s/8,23 GiB, apenas
Development.Booking/Passenger/Rides e Main. As HomeScreens originais ficaram no
cache. Esses tempos não incluem Webpack, Gradle ou o emulador.

Backend nas fontes `5777475bd9`, implantação `40131046069`: três ações
autenticadas acrescentadas ao piloto existente. Sem migrations, criação de
contas, novas portas ou troca dos serviços principais. Atualizações recusam
viagens ativas e preservam a janela até **31/10/2026 18:16 UTC**. Ações anônimas
retornaram 401; cadastro público, 403. Ao terminar o aceite, nenhuma viagem ativa
e Giselo indisponível. A ativação/sessão privada continua com duração de 24h.

Validações adicionais aprovadas: 10 testes unitários de clientes/adaptadores,
13 testes básicos do backend, três suítes de integração do backend, quatro
testes de piloto/HTTP/PostgreSQL e três testes Python de implantação. Fixtures
de Google são explícitos apenas nos contratos isolados. Foram testadas
autorização por perfil, sequência das transições, concorrência, persistência,
resposta fora de ordem e ausência de evento reentrante no fechamento.

Permanecem pendentes: dois celulares físicos e Android 12+, operação em segundo
plano, mapa/trajeto do motorista durante a viagem, navegação, indicador legado
do horário GPS, menus secundários e tradução integral do motorista. Atualizações
usam polling em primeiro plano (3s passageiro, 5s motorista). SDKs nativos de
compatibilidade e quatro ABIs continuam empacotados, sem otimização de tamanho;
há bibliotecas Firebase/HyperSDK, mas seus serviços operacionais não são
necessários ao fluxo aprovado. Sem pagamento real e sem alegação de fidelidade
visual exata à Play Store ou homologação de produção.

Para teste local/provisionamento e ativação por perfil, consulte
`Frontend/ui-driver/DRIVER-BR-TEST.md` e `AWS-DESENVOLVIMENTO.md`. Não envie códigos,
sessões ou chaves privadas ao chat/repositório.
