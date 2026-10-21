# Evidências e pendências — 21/10/2026

## Backend verificado

- Dez testes unitários passaram neste ambiente (Node 24) e o workflow Backend
  passou no Node 22 do GitHub Actions.
- Integração HTTP + PostgreSQL 16 passou em
  [run 39655926670](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39655926670),
  commit `27fe7fe4a0117554dd77aea12fd681e64a93b424`.
- A integração aplica migrations duas vezes; cria usuários e veículos reais em
  schema PostgreSQL isolado; valida login e revogação; exige GPS recente;
  persiste e entrega ofertas; disputa dois aceites simultâneos (200 e 409);
  entrega SSE; recupera ofertas via nova instância do serviço; valida autorização;
  registra chegada, início, conclusão e histórico; verifica recusa, afastamento,
  GPS vencido e cancelamento.
- O transporte Google é fixture explícita somente na suíte de integração.
  Portanto esse resultado não prova chave Google, faturamento, mapas visíveis
  no Android nem a viagem completa entre dois dispositivos.

## Android e CI em acompanhamento

Primeira execução detectou configuração antiga de SDK (`tools`) no setup do
runner e aspas incompatíveis no healthcheck PostgreSQL; ambos corrigidos.
Depois os APKs compilaram, mas lint bloqueou dois acessos a Insets incompatíveis
com API 26; proteção por versão corrigida. Emulador detectou que o runner
executa cada linha do script em shell separado; substituímos `cd` por `gradle -p`.

Serviço foreground de GPS foi acrescentado para navegação externa. Sua
compilação, lint e execução ainda estão sendo verificados. O teste de abertura
é offline e não representa corrida completa. Os workflows são separados para
backend, integração, passageiro, motorista e emulador.

## Bloqueios e trabalho restante

- Este ambiente não tem SDK Android nem PostgreSQL, e seu proxy HTTP recusa
  conexões. Foi possível desenvolver e gravar commits via integração GitHub e
  executar as verificações reais nos runners GitHub Actions.
- A conexão do ambiente não disponibilizou GOOGLE_MAPS_SERVER_KEY. Não foram
  feitas chamadas Google reais, nem ativado faturamento ou recursos de nuvem.
  A configuração por variável está implementada; o secret Android já aparece
  mascarado no runner, sem revelar seu valor.
- Falta validar origem/destino/rota no Google real e realizar a sequência inteira
  com dois dispositivos, com screenshots das telas operacionais. Não afirmar
  que esse teste obrigatório já foi concluído.
- Extração/reutilização de componentes visuais legados do motorista permanece
  pendente: o fluxo novo usa clientes nativos independentes. Legado preservado.
- Recebimento de ofertas em background não existe sem abrir o aplicativo;
  notificações push e Firebase permanecem fora do fluxo obrigatório.
- Não houve deploy, exposição pública, pagamento ou alteração do projeto Alce.

## Como continuar

Consultar os runs mais recentes e baixar os artefatos dos dois APKs; verificar
`brasil/README.md` para operação privada local. Iniciar backend com PostgreSQL,
configurar as chaves Google com restrições e criar os dois usuários pelos apps.
Executar e registrar a viagem completa antes de declarar a primeira operação
validada. Não pular falhas de lint, testes ou indisponibilidade de mapas.
