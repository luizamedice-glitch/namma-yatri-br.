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
