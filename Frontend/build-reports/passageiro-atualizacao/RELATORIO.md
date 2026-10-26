Relatório de 25/10/2026 — atualização automática do passageiro

Correção nas fontes `6dd0c19d83`, preservando os ajustes de mapa/rotas do
proprietário até `647a945dca`. A interface PureScript/PrestoDOM, a autenticação,
o backend e o aplicativo motorista foram mantidos. Dados completos e arquivos
alterados: [40155730331.json](40155730331.json).

O bloqueio foi reproduzido no Android 16/API 36 no run `40154207135`: o banco
já registrava o aceite, mas a tela permanecia em “Procurando motorista”. O
relógio Android registrou 14 disparos; o frontend permaneceu em um tick e duas
leituras, sem erro de API e sem ação pendente. O script nativo procurava o
callback em variáveis do contexto do SDK. O callback estava registrado no
contexto consumidor da tela.

A ponte passou a utilizar `window.callUICallback`, a entrada original do SDK
que encaminha o identificador ao iframe consumidor. O frontend conta os
callbacks efetivamente recebidos. O teste Android exige esse contador, além
dos estados visíveis. Um teste de contrato executa o roteador original do
`boot_loader.js` e o callback original do passageiro em dois contextos JS:
falha com a ponte anterior e passa com a corrigida. O cálculo assíncrono de
aproximação Google e os mecanismos de recuperação do proprietário foram mantidos.

| Verificação | Resultado |
| --- | --- |
| Android 16/API 36, run [40155730331](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40155730331) | Busca → aceite → chegada → início → conclusão, mesmo PID, sem reabrir; 330 s em Motorista a caminho; 130 callbacks Android e 130 recebidos. |
| Android 10/API 29, run [40156371386](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40156371386) | Mesmo ciclo sem reinício; 20 callbacks recebidos. |
| Rede real interrompida, API 29, run [40156836847](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40156836847) | Túnel ADB removido e sockets HTTP existentes fechados; quatro erros observados pelo passageiro; recuperação automática, conclusão e retorno à Home. |
| Contratos Node | 25 aprovados localmente e no aceite API 29 atualizado; inclui roteamento entre contextos, concorrência de respostas, recibos, GPS e geometria. |
| Compilação incremental | Só Development.Rides recompilado; 22 lotes com cache, 16,64 s de compilador e 406,81 MiB RSS amostrado. Sem repetir HomeScreen/Main. |

O teste usa o APK real, API HTTP e PostgreSQL 16 isolados, sessões distintas e
Google Places/Routes reais. O ator motorista opera a API autenticada enquanto
o passageiro permanece em primeiro plano. Coordenadas de emulador/ator e
veículo TST1A23 são fixtures explícitos desse banco. Não houve operação de
corrida nas contas do servidor Lightsail durante estes testes. Capturas de
aceite, chegada e conclusão foram conferidas; o mapa e o traçado continuam
visíveis. O relógio é desativado ao voltar à Home.

A primeira verificação de reconexão removia somente o túnel ADB: conexões
persistentes poderiam sobreviver, e o contador ficou em zero erros. O teste
foi reforçado para fechar os sockets da API isolada por SIGUSR2 e exigir erro
observado no cliente. O resultado de quatro erros pertence ao segundo aceite
API 29, sem nova compilação. A espera de 12 s é provocada pelo teste; os tempos
em acceptance.json incluem automação de UI e não representam um SLA de rede.

[APK debug do passageiro](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40155730331/artifacts/12584645727),
127.819.163 bytes; SHA256 do APK interno:
`c55ecc33cae835219d1605596158c29de09dec39e8462a6266b4caa046e137be`.
Bundle dentro do APK conferido byte a byte; mesmo hash nos três aceites.
[Capturas Android 16](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40155730331/artifacts/12585156286)
e [rede API 29](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40156836847/artifacts/12584806510).

O certificado debug difere da referência anterior conferida. Uma instalação
sobre outra assinatura pode exigir reinstalar somente o passageiro. Novo
código privado de conexão de Fagner emitido no run `40156602394`, válido até
26/10/2026 03:00:54 UTC, entregue fora do Git e não consumido no teste. Jobs de
implantação/provisionamento não executados; corridas e sessões existentes do
motorista preservadas. Nenhum código, token ou chave privada aparece aqui.

Permanecem pendentes confirmação no celular físico do proprietário, teste de
rua, operação em segundo plano/push e limpeza dos pinos verdes legados. As
capturas ainda mostram esses pinos; este incremento corrige a atualização dos
estados. Duas WebViews auxiliares não responderam ao diagnóstico CDP no API 36;
o contexto principal entregou os contadores, e a UI nativa confirmou o ciclo.
Não houve atualização de dependências nem alteração de backend nesta correção.
