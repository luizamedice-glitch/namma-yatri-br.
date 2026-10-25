# Recuperação PostgreSQL, backup e observabilidade — 25/10/2026

Fonte operacional: `8d24ad18edebe754341e7839261122b70a440777`.
Pagamentos, Firebase e autenticação definitiva permanecem adiados por decisão
do proprietário. Nenhuma alteração Android, nova dependência ou migration.

## Evidências

- CI de recuperação [40241759979](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40241759979): 25 testes Node e dois Python aprovados.
- Instalação e restauração real [40241777998](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40241777998): contratos repetidos antes da instalação; timers ativos, chave privada ausente do servidor, cópia externa cifrada e restauração isolada aprovadas. Artefato `12617133209` contém somente ciphertext/relatórios seguros, expira em 01/11/2026.
- Monitor externo manual por push [40241825428](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40241825428): aprovado usando checkout imutável da mesma fonte operacional.
- Correção do piloto implantada e aprovada em [40241930473](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40241930473): revisão `8d24ad18edebe754341e7839261122b70a440777`, sem corrida ativa, migrations idênticas, janela até `2026-10-31T18:16:18.740028+00:00`, autorização e serviços existentes preservados. Não emitiu nova ativação; sessões existentes permanecem. Nenhum aceite Android novo é alegado, pois não há mudança de APK.

Backup real: `yatri-db-20261025T224818980915Z.ybk`, criado às
22:48:19 UTC, 29.923 bytes cifrados; SHA256
`f50bd8b5538d1b7a897235c731d01ce8800126ec61dc75d015635250071f6752`.
Restauração externa confirmada às 22:48:29 UTC: migrations correspondentes,
índices válidos, banco ativo inalterado. Saúde às 22:48:31 UTC: API, piloto,
PostgreSQL, disco, cópia recente, restauração recente e janela de piloto aprovados.

## Falhas efetivamente exercitadas

O teste cria dois PostgreSQL 16 exclusivos, com nomes UUID e volumes descartáveis;
nunca usa DATABASE_URL do servidor. Executa o ciclo por HTTP até viagem em
andamento; pausa a conclusão após UPDATE e antes de COMMIT; interrompe realmente
o primeiro PostgreSQL e o reinicia com o mesmo volume/porta.

Encontrou um segundo evento de erro de socket em cliente retirado do pool, que
podia encerrar Node. O cliente agora tem tratamento de erro permanente e é
descartado; falha de ROLLBACK não oculta o erro original. HTTP retorna 503 e
Retry-After 5 nas operações; /health retorna 503 durante indisponibilidade.
A API permanece no mesmo processo e recupera conexões após retorno do banco.
Não há repetição automática de POST. A conclusão sem COMMIT é revertida,
preservando versão/tarifa; a repetição autorizada após recuperação conclui uma vez.

O mesmo teste cifra/restaura dump no segundo banco e consulta a corrida com a
mesma sessão. Concluir a cópia não altera a origem. Suíte anterior também segue
aprovada: resposta truncada após COMMIT, SIGKILL de Node, exclusividade e replay.
Google é fixture declarada nesses testes; nenhuma chamada real é alegada aqui.

## Operação implantada e limites

Backup diário local 03:15 UTC (00:15 Brasília), sete cópias cifradas mais recentes;
monitor local a cada cinco minutos. Arquivos privados em `/opt/yatri-brasil`,
com diretórios 700 e arquivos 600. AES-256-GCM + RSA-OAEP/SHA-256; chave privada
original Lightsail fica com o proprietário/Actions. Não salvar a chave somente
na instância: sem ela, cópias cifradas não podem ser recuperadas.

O [PR #5](https://github.com/luizamedice-glitch/namma-yatri-br./pull/5) publica
somente o agendamento externo na main: backup diário 03:45 UTC e saúde a cada
15 minutos, fonte operacional fixa. Aguarda revisão específica de publicação
conforme AGENTS.md; **cron externo ainda não está ativo**. Cópia externa e
monitor foram executados manualmente com sucesso. Atrasos no cron GitHub são
possíveis; alertas dependem das preferências de notificações do proprietário.
Monitor deixa estado degradado se backup/restauração tiver mais de 26 horas;
não reinicia automaticamente serviços nem prolonga o piloto.

O /health público continua servido pela API principal anterior; a correção
de reconexão deste incremento pertence ao piloto 8082. Monitor local verifica
ambos separadamente. Não houve queda provocada no servidor real, troca de banco
ativo nem ensaio de reconstrução completa da instância. Backups são PostgreSQL,
não incluem secrets/configurações/imagens. RPO alvo após ativação diária: até
24 h mais atraso de agendamento; RTO de desastre ainda não medido. Próximos
aceites: carga isolada e duração prolongada em dois celulares, depois reconstrução
de uma instância alternativa com revisão específica. Procedimento: BACKUPS.md.
