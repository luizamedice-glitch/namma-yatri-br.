# Recuperação operacional — piloto

Pagamentos, Firebase e autenticação definitiva foram adiados pelo proprietário.
Sessões, perfis e autorização de corridas existentes continuam obrigatórios.

## Resposta perdida depois de gravar

`arrive`, `start`, `complete` e `cancel` podem ser repetidos pelo participante
autorizado quando a corrida já está no estado de destino daquela ação. A API
confirma o estado persistido sem incrementar `version`, criar eventos ou alterar
outra corrida. Autorização é verificada antes de reconhecer a repetição.

Uma ação atrasada de uma etapa anterior continua retornando 409; por exemplo,
`arrive` depois de `completed`. O cliente deve reconciliar por snapshot/GET da
própria corrida, não voltar a UI nem repetir POST automaticamente. A proteção
contra mais de uma corrida ativa e a atribuição concorrente permanecem no
PostgreSQL. Reenvios de uma mesma cotação recuperam a mesma corrida.

## Online e GPS são estados diferentes

No snapshot, `online` representa a escolha persistida do motorista. `available`
indica elegibilidade atual para ofertas e exige GPS recebido há menos de 60 s.
Perda de GPS não altera `online`; atualização válida restaura `available` sem
outro clique. Campo adicional compatível com APKs anteriores.

O motorista atualizado mantém o serviço enquanto `online` ou em corrida.
Mostra “GPS sem atualização” ou “Sem conexão com o servidor” na notificação
permanente e recupera automaticamente, preservando a sessão e a corrida. GPS
antigo no dispositivo não é reenviado após 30 s. As rotas antigas continuam
aceitas; nenhuma migration ou coluna foi adicionada.

## Evidência reproduzível

`npm run test:integration` inclui `test/recovery.test.mjs`: API HTTP real,
PostgreSQL isolado e Node em processo separado. O teste trunca uma resposta
real após COMMIT, encerra o processo com SIGKILL, reinicia a API e repete o
comando. Verifica mesma corrida, status/versão/eventos estáveis e rejeição de
terceiros; cobre pedido/aceite/chegada/início/conclusão/cancelamento. Somente
o transporte Google é fixture declarada; não usa Lightsail.

`.github/workflows/br-driver-background.yml` e
`Frontend/scripts/test-driver-background.py` validam o Android com corte real
do túnel TCP, fechamento das conexões existentes, desligamento e retorno do
GPS e envelhecimento real das janelas de 30/60 s. Sem reiniciar o aplicativo
nem acordar o WebView pelo debugger. Android 16 `40237490959` e Android 10
`40238396498` aprovados com o mesmo APK; backend implantado em `40236965537`.
Fontes `f585ad66f82e`. Evidências e limites em
`Frontend/build-reports/recuperacao-operacional/RELATORIO.md`.
