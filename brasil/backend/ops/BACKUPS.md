# Recuperação e backups do piloto

O banco ativo nunca é parado/restaurado por estes scripts. `maintenance.py`
oferece somente `backup`, `export`, `verified` e `monitor`. O backup usa
`pg_dump -Fc` consistente, transmitido diretamente ao cifrador: nenhum dump
em texto claro é salvo no Lightsail. AES-256-GCM autentica o envelope;
RSA-OAEP/SHA-256 protege a chave aleatória de cada arquivo.

A chave pública é derivada de `AWS_SSH_KEY`. A chave privada original deve ser
guardada pelo proprietário fora do servidor: ela é necessária para recuperar
os arquivos `.ybk`. Trocar a chave SSH não recriptografa cópias anteriores.
O instalador recusa mudança silenciosa do destinatário. Não há nova credencial
embutida em aplicativos, código ou artefatos.

## Operação

Workflow `br-database-operations.yml`: `validate` testa bancos descartáveis;
`install` instala código revisionado/timers e verifica uma cópia externa;
`backup` exporta uma cópia recente e faz restauração isolada; `status` consulta
saúde. Somente relatórios sem dados pessoais e backups cifrados são artefatos.
Dump descriptografado/chave ficam em diretório temporário 700 com arquivos 600,
apagados ao terminar, inclusive após falha.

Servidor: `/opt/yatri-brasil/backups` (700, arquivos 600, sete últimos backups),
`operations/revisions/<sha>`, `operations/current`, `operations/state/health.json`
e `restore-check.json`. Backup diário 03:15 UTC (00:15 Brasília), monitor a cada
cinco minutos via systemd. A confirmação externa não deve ficar >26 h sem renovar.
Monitor verifica as duas APIs, PostgreSQL, espaço livre mínimo 512 MiB, backup,
restauração externa recente e janela de piloto. Não reinicia serviços nem altera
a janela do piloto. Falhas deixam relatório e serviço/workflow em erro.

`verify-backup.py` aceita arquivo local e diretório de migrations; não aceita
URL de destino. Restaura somente em contêiner novo, sem rede externa, portas ou
montagens do host. Verifica restauração completa, migrations e índices. Nunca
imprime dados/erros SQL pessoais. Remove apenas o próprio contêiner/volume.

Para recuperação emergencial, obter `.ybk` e chave privada original, usar
`node ops/backup-crypto.mjs decrypt CHAVE BACKUP DESTINO` em ambiente privado e
verificar com `python3 ops/verify-backup.py DESTINO migrations`. Substituir um
banco operacional é uma ação distinta que exige revisão; estes scripts não a
executam. Copiar backups cifrados para outro provedor melhora a independência de
GitHub/Lightsail. Não há backup de secrets, imagens, configurações ou volumes
fora do PostgreSQL; recuperação completa do servidor continua sendo outro aceite.

Timers podem ser desativados com `sudo systemctl disable --now
yatri-backup.timer yatri-monitor.timer`; os arquivos de backup permanecem.
Agendamento GitHub somente funciona com workflow na branch padrão. Um arquivo
de cron na branch de desenvolvimento não constitui automação externa ativa.
