# Passageiro — recuperação de conexão

## Escopo

O proprietário confirmou a resolução do bloqueio no Samsung A07/Android 16
com a versão anterior. Sem possibilidade de teste de rua neste momento,
o incremento seguinte trata recuperação de falhas de transporte.

Fontes do APK: `5833a5d5cbbe104d4438ef42d0fc95f3701e722b`.
Testes ampliados: `ec70b10277` (mesmas fontes Android/PureScript/FFI).

## Alterações

- `Frontend/ui-customer/src/Development/Rides.js`: erros iguais consecutivos
  geram um único toast até uma consulta bem-sucedida; o campo tracking continua
  exibindo o aviso. Cotação já calculada é reapresentada depois de recuperar
  conexão, limpando o aviso sem chamar Google novamente. Se a resposta ao POST
  de solicitação falhar, aguarda snapshot antes de permitir outra tentativa;
  não reenvia POST automaticamente.
- `Frontend/ui-customer/src/Development/Booking.purs`: texto de confirmação e
  retorno à Home disponível enquanto o resultado do pedido é conferido.
  Retornar não cancela implicitamente uma viagem.
- `.github/workflows/br-passenger-foreground.yml`: alvo incremental Booking,
  incluindo sua dependência Rides, com cache obrigatório e lotes preservados.
- `Frontend/scripts/test-passenger-polling.mjs`: quatro testes negativos,
  reproduzidos com falha antes da correção e aprovados depois.
- `Frontend/scripts/test-passenger-foreground.py`: verificar aviso inline,
  recuperação da cotação, perda de resposta ao POST e reconexão durante a viagem.
- `Frontend/scripts/serve-passenger-foreground.mjs`: sinal CI descarta uma única
  resposta de sucesso depois que o handler real confirmou a transação. Não
  cria resposta fictícia. Arquivo local de controle contém apenas contadores.
- PROJECT_STATUS.md, ARCHITECTURE.md e ROADMAP.md: confirmação física posterior
  e limites do incremento registrados sem reescrever evidências históricas.

Backend, motorista, produção, componentes/mapas originais e marca preservados.

## Validação local e compilação

32 testes Node aprovados; syntax check Node/Python e git diff --check aprovados.
Run de build: `40200987234`. Cache reaproveitado: 22 lotes, somente dois módulos
realmente recompilados (Development.Rides e Development.Booking), 16,25 s de
compilador e 417,17 MiB de pico RSS amostrado. Main/HomeScreen não recompilados.
Métricas no artefato `12601689808`.

## Aceites Android

- Android 10/API 29: `40201809248 success`, artefato `12601474628`.
  Primeira abertura/permissões, Início/Cancelar/Voltar, retomada com mesmo PID,
  processo recriado e ciclo completo aprovado sem novos reinícios. Diagnóstico
  nativo exportado e validado. Captura de conclusão conferida; pinos verdes
  duplicados continuam visíveis e não foram modificados neste incremento.
- Android 16/API 36: `40202387656 success`, artefato `12603090072`.
  Cotação offline/online, truncamento da resposta de criação após commit real,
  acompanhamento e conclusão após outro corte de rede aprovados com mesmo PID.
  Contadores preservados: requests=1, droppedResponses=1, cuts=2. Nove erros
  de leitura observados pelo cliente nos cortes, zero falhas de callback;
  30 callbacks nativos recebidos. As fases avançaram sem reiniciar.
  Latências observadas aceite 6,96 s, chegada 23,15 s (inclui corte de rede),
  início 7,55 s e conclusão 3,40 s. Capturas de aviso e conclusão conferidas.

O build do run `40200987234` passou, mas seu aceite falhou: o sinal que corta
sockets correu em paralelo ao início da requisição HTTP do motorista de teste,
fechando também essa conexão. O teste agora aguarda confirmação do corte antes
de iniciar a ação do motorista. Nenhuma mudança de APK foi necessária.

O ensaio `40201807259` mostrou o passageiro recuperado em searching no CDP,
mas falhou na verificação de contadores do POST. O teste não preservou seus
valores, portanto não prova a causa dessa divergência. O ensaio seguinte
`40202286354` foi cancelado após a revisão do injetor. A edição atual preserva
contadores sanitizados e trunca a resposta real após seus headers/primeiro byte,
para exercitar o erro recebido pelo consumidor sem depender de como a biblioteca
nativa trata EOF antes dos headers (que pode disparar replay transparente).

## Limites

- Testes automatizados usam API/PostgreSQL isolados e motorista por HTTP,
  não dois celulares físicos. Google real fornece endereços e rotas.
- Envio incerto é reconciliado enquanto o acompanhamento permanece aberto;
  não foi adicionada fila offline ou persistência de POST pendente entre processos.
- O adaptador JS não reenvia operações automaticamente. A biblioteca HTTP
  nativa pode ter política própria de repetição em algumas falhas de conexão;
  não foi modificada neste incremento. O backend existente protege quote_id
  único e uma corrida ativa por passageiro; não há nova idempotência no cliente.
- Não adicionados localização em segundo plano, push, pagamentos ou navegação
  curva a curva. Teste de rua e limpeza dos pinos legados seguem pendentes.

## APK

Artefato `12602430585`, 127.819.351 bytes, SHA256
`b729712c73dafb11b2530c6841dff918c42892f542113047e4c28c3061da8398`.
Bundle conferido dentro do APK: confirmação, await/reconciliação, runtime de
callbacks corrigido e configuração de mapas sem credencial de passageiro.

Assinatura debug comparada pelo certificado APK v2: diferente da versão anterior.
Será necessário reinstalar apenas o passageiro e reconectá-lo; estabilidade da
assinatura debug fica como próximo ajuste de distribuição. Ativação privada
somente passageiro emitida no run `40202821688` (activate success, deploy e
provision skipped), válida até 2026-10-26T14:34:05.281Z, não consumida. Entrega
fora do Git, permissões 600; nenhuma sessão/viagem do motorista foi modificada.

[APK](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40200987234/artifacts/12602430585) ·
[Aceite Android 16](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40202387656) ·
[Aceite Android 10](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40201809248).
