# Diagnóstico do frontend histórico — issue #1

Base: `passageiro-pt-br`, commit `2c0506ab5c0306d7a94049304d676b8f4fbfc9b9`.
Data: 22/10/2026. Fontes PureScript, componentes PrestoDOM, telas, navegação,
FFI e backend brasileiro devem permanecer intactos durante este diagnóstico.

## Ferramentas e reprodução

Usar Node **18.20.8**, PureScript **0.15.4**, Spago **0.21.0**, Python 3,
GNU time (`time` no Debian/Ubuntu), Git e `procps`. O pacote histórico
`hyper-purescript@0.0.25` instala o executável `fastpurs`; nesta instalação ele
reportou **0.15.15**, portanto não serve como prova de uso do `purs` 0.15.4.
O script verifica as versões dos executáveis efetivamente encontrados no PATH.

```bash
npm install --global --ignore-scripts=false purescript@0.15.4 spago@0.21.0
cd Frontend/ui-customer
npm install --legacy-peer-deps --ignore-scripts=false
GHCRTS='-N1 -M512m' spago -j 2 install
cd ../..
python3 Frontend/scripts/diagnose-purescript.py --heap 2500m --label cold
```

O diagnóstico não instala nem atualiza dependências, não limpa `output` e não
remove módulos. Registra grafo, hashes das fontes resolvidas, comando completo,
logs, `time -v`, estatísticas GHC e amostras de RSS/cgroup por segundo em
`purescript-diagnostics/<label>/`. Cada label precisa ser nova, evitando
sobrescrever evidências. Para executar sem cache anterior, usar um novo checkout;
para medir retomada, repetir com outra label no mesmo checkout.

```bash
python3 Frontend/scripts/diagnose-purescript.py --heap 5500m --mode staged --label staged
python3 Frontend/scripts/diagnose-purescript.py --heap 5500m --label incremental
python3 Frontend/scripts/diagnose-purescript.py --heap 5500m --mode module --label strings
```

`staged` ordena o grafo topologicamente e compila prefixos cumulativos de 100
módulos (configurável com `--batch-size`). Cada prefixo contém as dependências
necessárias. A última etapa chama o **Spago original com todas as fontes** e
geração JavaScript. Uma etapa com êxito grava `cache-db.json`; uma falha não é
transformada em sucesso. `module` compila somente o módulo escolhido e seu
fecho transitivo: é um experimento, não valida o aplicativo inteiro.
`--codegen corefn` permite separar experimentalmente geração JS das fases
anteriores; CoreFn sozinho também não constitui entrega do frontend.

`--timeout-seconds` limita cada invocação (padrão 1800 s), registra saída 124 e
interrompe seu grupo de processos. `--time-bin` permite apontar para GNU time
instalado fora de `/usr/bin`. `--app motorista` seleciona o outro frontend.

## Interpretação da memória

`-M2500m` é um limite de **heap GHC** de 2.621.440.000 bytes. Não é um limite do
V8; aumentar `NODE_OPTIONS` não o altera. RSS inclui memória além do heap.
`memory.current` também inclui cache de arquivos e outros processos no cgroup;
`memory.peak` pode anteceder o teste. Não tratá-los como heap do compilador.
Comparar `memory.events` antes/depois para identificar OOM do sistema.

`-N1` limita as capabilities GHC. O `-j` do Spago não é uma opção de jobs do
`purs compile`; não existe essa opção na ajuda do compilador 0.15.4. O cap do
Spago é 512 MiB; argumentos RTS explícitos dão ao compilador o heap selecionado.
Não aplicar `-M10g` numa máquina com limite de 8 GiB: reservar margem para RSS,
sistema e outros processos. O workflow usa runner padrão hospedado, sem contratar
runner pago nem implantar serviços. Conferir a RAM real antes de aumentar heap.

## Resultados medidos

O relatório será completado com as execuções e limitações verificadas. Evidência
prévia: o [run 39689855720](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39689855720)
falhou no passageiro em `Resources.LocalizableV2.Strings` (659/1189), com heap
2.500 MiB. O runner tinha aproximadamente 15 GiB de RAM e 3 GiB de swap: essa
falha veio do cap artificial, não prova insuficiência física desse runner.

Reprodução local, Linux x86_64, limite cgroup **8 GiB**, host 9,7 GiB, sem swap:

| Experimento | Resultado | Tempo | Pico RSS | Observação |
|---|---|---:|---:|---|
| Spago completo, `-N1 -M2500m` | Falhou em 659/1189 | 4min11,32s | 2.720.052 KiB | Heap exhausted; saída 1 |

GHC: 113.591.887.880 bytes alocados cumulativamente (não residentes), residência
máxima 2.578.889.552 bytes, GC 204,048 s de 250,640 s; produtividade 18,6%.
Contadores `oom` e `oom_kill` permaneceram zero. Foram gerados 657 diretórios de
módulos, mas não existia `output/cache-db.json` após a falha.

O módulo `Resources.LocalizableV2.Strings` tem 1.885 linhas, importa oito idiomas,
opera sobre `Keymap` com **1.790 campos**, usa constraints `Cons`, `Lacks`,
`Newtype` e proxies em uma grande seleção de traduções. Seu fecho transitivo tem
369 dos 1.189 módulos. Essa concentração é candidata ao pico; o número 659
sozinho não identifica uma fase interna ou prova defeito no typechecker.
A ordem de outros módulos variou entre CI e execução local.

## Alterações e limites

- Removido `--censor-warnings` dos scripts `compile:purs` de ambos os apps:
  `purs compile --censor-warnings` retorna `Invalid option` no compilador exigido.
  Isso corrige uma opção incompatível; não corrige por si só a falta de heap.
- Adicionados medidor e workflow isolado, sem atualização de manifests de
  dependências, package-set, código de telas ou backend.
- O workflow compila o ref efetivo da execução/PR, preserva caches mesmo após
  falha e publica logs inclusive quando o build falha. Os hashes documentam
  dependências históricas referenciadas por branches móveis; não se afirma
  reprodutibilidade byte a byte sem lock dos commits externos.
- `corefn`, um módulo isolado, outputs parciais ou bundles históricos já
  existentes não comprovam build completo nem APK operacional. Empacotamento
  Android, comparação visual e integrações de execução estão fora desta issue.
