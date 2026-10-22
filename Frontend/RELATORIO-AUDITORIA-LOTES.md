# Auditoria dos lotes PureScript — 22/10/2026

## Resultado dos commits auditados

- `a687e4065f`: ampliou timeouts; não introduziu divisão de compilação.
- `dd0b7ecc4f`: selecionou modo staged com tamanho 150, mas o helper usava prefixos cumulativos e acrescentava uma compilação Spago completa ao final. O tamanho 150 não limitava os arquivos passados ao compilador.
- Evidência: execução [39812098618](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39812098618), artefato `12442652286`. Prefixos: 369, 393, 543, 693, 843, 993, 1143 e 1193 módulos. Cinco chamadas terminaram; a sexta terminou com código 124 após 1510,26 s, incluindo encerramento do grupo de processos. Última mensagem: `[83 of 95] Compiling Screens.HomeScreen.Controller`. Pico observado por amostragem: 12.765.432 KiB (12,17 GiB). A mensagem indica início do módulo, não sua conclusão.

## Correções locais

O modo staged agora agrupa até 25 novos alvos por chamada, adicionando somente as dependências transitivas desses alvos. Controllers pesados, HomeScreen.View, Flow, Main e Development.Passenger são alvos isolados. Não adiciona mais uma compilação completa silenciosa no final. O workflow executa uma verificação posterior com `--require-cache`, que interrompe se aparecer nova compilação.

Cada chamada publica RSS, tempo e tempo sem saída a cada 30 segundos. O workflow limita cada chamada a 600 s, ausência de saída a 300 s e RSS amostrado a 12.288 MiB. Violação interrompe o grupo e impede os próximos lotes; logs, motivo e pico observado ficam registrados. `plan.json` registra os alvos e todas as dependências antes da primeira compilação. Código 124 indica timeout absoluto; 125 indica guarda de memória, ausência de saída ou recompilação inesperada.

Essas guardas não provam deadlock: um módulo legítimo pode ficar muito tempo sem emitir mensagens. São limites deliberados para evitar espera improdutiva; o módulo deve então ser investigado isoladamente. RSS é amostrado e pode ultrapassar o limite entre amostras. O limite não equivale ao heap GHC.

## Verificações executadas

- Dois testes de regressão do planejador passaram: ramos independentes não entram cumulativamente em lotes posteriores; controller pesado fica isolado.
- Planejador aplicado ao grafo real de 1193 módulos: 55 lotes, cobertura completa, ordem preservada, máximo de 25 alvos e dependências presentes em cada lote. Maior fechamento: 1015 módulos; HomeScreen.Controller sozinho: 698. Portanto, quantidade de alvos não garante consumo fixo de memória.
- `py_compile`, `actionlint` e `git diff --check` passaram.

Não foi disparado outro build Android nem declarada resolução do pico do controller. O novo planejamento e as guardas precisam ser medidos no runner com memória suficiente. O frontend, suas dependências e o backend não foram alterados nesta auditoria. Não há novo APK aprovado por esta auditoria.


## Build acompanhado: 39820258245

Executado a pedido do usuário no commit `9dde1ada54`: [execução e artefatos](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39820258245). Job de 17:10:12 a 17:17:33 UTC em 22/10/2026 (7 min 21 s). O resultado foi **failure controlada**, sem APK; os jobs Android e emulador foram corretamente ignorados.

Dos 55 lotes planejados, 36 concluíram com código zero em 37,57 s acumulados, com aproveitamento do cache. O lote 37 tinha um único alvo novo, `Screens.HomeScreen.Controller`, e 698 módulos no fechamento de dependências. O compilador anunciou somente `[1 of 1] Compiling Screens.HomeScreen.Controller`; não emitiu erro de tipos ou conclusão antes da interrupção.

A guarda de ausência de saída encerrou o lote com `no_compiler_output`, código 125, após 322,10 s incluindo inicialização e encerramento. Pico RSS amostrado: **10.859.976 KiB / 10,36 GiB**. RSS aproximado aos 30/60/180/300 s: 6,82 / 8,11 / 8,66 / 10,20 GiB. A memória continuava crescendo; ausência de saída não comprova deadlock. O limite de 12 GiB não foi atingido.

O cache foi salvo com sufixo `39820258245-1`. O artefato `12445420144` contém plano, comandos, logs e amostras. Resumo versionado: `build-reports/passageiro-lotes/39820258245.json`. A compilação medida durou 359,67 s acumulados. Os valores desta tentativa e da anterior não constituem comparação controlada de desempenho, pois os alvos pendentes e o cache diferem.

Também foram verificados localmente: reutilização de cache com três módulos reais no compilador 0.15.14; guardas de ausência de saída, recompilação inesperada e RSS com processos controlados. Essas guardas encerraram os processos com código 125 e o motivo esperado. Os processos controlados não representam o frontend nem uma integração de corridas.

Conclusão desta tentativa: a divisão e a interrupção funcionaram, mas o controller ainda não concluiu. A próxima investigação deve medir esse módulo isoladamente e examinar suas dependências e alterações, preservando o cache; não repetir o grafo inteiro nem ampliar cegamente os timeouts. Não foi iniciada outra execução após esta falha.


## Entrega posterior validada

O APK e a navegação passaram na execução [39835346434](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39835346434): 55 lotes, 290,45 s acumulados, pico RSS 9.572.472 KiB (9,13 GiB), apenas Development.Passenger e Main recompilados; verificação completa em 32,86 s sem recompilação. A entrada direta, os campos originais, a digitação inteira de Avenida Paulista, o retorno e a reabertura online foram testados no APK real em Android 29. Detalhes, links e limites em [PASSAGEIRO-ENTRADA-DIRETA.md](PASSAGEIRO-ENTRADA-DIRETA.md).

A alteração de um FFI compartilhado em `39832410686` invalidou 336 módulos e foi interrompida novamente no controller: 314,70 s, pico 10.859.396 KiB, 249,83 s em GC em 313,91 s totais (produtividade 20,4%). O arquivo foi restaurado e a adaptação de apresentação isolada no Webpack Android, com a mesma interface/exportações, sem alterar dados do decoder nem editar bundle manualmente. O custo da compilação fria do controller continua uma limitação; cache válido não é uma solução geral para esse custo.
