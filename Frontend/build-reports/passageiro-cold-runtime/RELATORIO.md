Relatório de 25/10/2026 — investigação da primeira abertura no Samsung A07

O proprietário confirmou que o bloqueio persiste no Samsung A07/Android 16,
incluindo Início, Cancelar e Voltar do sistema. Reabrir recupera temporariamente;
uma abertura após maior intervalo volta a bloquear. **O incidente físico
permanece aberto.** O APK anterior também passou no novo teste de ciclo frio
no emulador (`40159713510`), portanto esse resultado não reproduz o aparelho.

Foram corrigidos dois defeitos demonstrados por testes sobre o código original:

- A instrumentação de chamadas JBridge executava Firebase antes da chamada
  nativa. Uma exceção desse serviço opcional interrompia a chamada. Na variante
  brasileira do passageiro, essa decoração deixou de ser instalada; a ponte
  original permanece intacta, inclusive quando a entrada JS é avaliada novamente.
- O despachante usava somente propriedades de objeto. Agora aceita objeto ou
  Map, inclusive Map criado em outro contexto JS, preserva as entradas e
  sincroniza o indicador do mapper depois dos imports Core e durante o despacho.

São correções de runtime verificáveis, sem atribuir a elas uma causa física
que ainda não foi comprovada. Interfaces PureScript/PrestoDOM, rotas Google,
autenticação de produção e backend foram preservados. O motorista não foi
recompilado; o novo tratamento de teclas na Activity compartilhada é restrito
à variante passageiro BR debug.

[APK debug, fontes 735cfdd21e](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40160194185/artifacts/12586282367):
127.819.655 bytes. SHA256 interno:
`29ce0cd78f15ebbd8c3e89ab55aaa6399613b6ea82b7e728369772e5b6b8239a`.
A etapa build desse run passou. O primeiro aceite falhou após confirmar viagem
e exportação: a automação tocou a prévia da área de transferência do Android,
abrindo Quick Share. A navegação passou a terminar antes de testar a cópia;
os novos aceites reutilizaram o mesmo APK, sem recompilar.

| Aceite | Resultado |
| --- | --- |
| [Android 16/API 36, 40161535583](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40161535583) | Aprovado: controles na primeira abertura, Início/Cancelar/Voltar, retomada mantendo PID, force-stop com novo PID, retomada da corrida e todos os estados. |
| [Android 10/API 29, 40161537133](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40161537133) | Mesmos casos aprovados, incluindo cópia nativa e checagem de ausência de sessões/veículo no diagnóstico. |
| Node | 28 testes aprovados: regressões de Firebase opcional, Map entre contextos, roteamento SDK, viagens, GPS e geometria. |
| Compilador | Só Development.Rides recompilado; 16,26 s, 394,75 MiB RSS amostrado, 22 lotes com cache. Main/HomeScreen preservados. |

API HTTP/PostgreSQL isolados e Google reais; motorista como ator HTTP
separadamente autenticado. GPS de emulador e veículo TST1A23 são fixtures
explícitos desse banco. Não houve ação sobre corridas do Lightsail. Capturas
da corrida/conclusão foram conferidas. Evidências: API 36 **12585899952**,
API 29 **12586474240**. Dados completos em [40160194185.json](40160194185.json).

Diagnóstico no aparelho: durante o bloqueio, antes de fechar o APK, pressionar
Volume+ três vezes rapidamente. A mensagem “Diagnóstico Yatri copiado” confirma
a cópia. Só depois colar o texto na conversa de suporte; se a confirmação não
aparecer, informar isso sem colar a área de transferência, que pode conter um
código de conexão anterior.

A exportação é local e acionada pelo operador. Contém contadores, tipo do
registro, fase observada, idade da última observação JS, estado do relógio,
modelo/versão Android e controles estáticos visíveis. Uma lista explícita de
campos/valores exclui tokens, URLs, endereços, usuário/corrida e veículo. O teste
verifica os dados reais exportados. Arquivo privado do APK:
`files/yatri-passenger-diagnostic.json`; nenhum READ_LOGS ou serviço externo novo.
As teclas continuam com o comportamento normal de volume.

Interpretar o relatório como última observação: `sinceJsMs` mede sua idade.
`backEnabled=false` foi observado com Voltar funcionando, e `clickable=false`
pode pertencer ao TextView interno de um botão; nenhum desses valores sozinho
comprova bloqueio. Comparar estado JS, relógio, callbacks e controles visíveis.

A assinatura debug pode exigir reinstalar somente o passageiro. Emitido novo
código privado de Fagner no run `40161232767`, válido até 26/10/2026 04:15:54 UTC,
sem consumi-lo ou invalidar sessões anteriores. Apenas activate; implantação e
provisionamento não executados. Texto entregue fora do Git.

Permanecem pendentes o diagnóstico/aceite físico do A07, políticas de segundo
plano/push, teste de rua e pinos verdes duplicados já conhecidos. O teste de
force-stop modela processo recriado; não reproduz todas as condições de uma
espera prolongada no Samsung. Não declarar a falha física resolvida antes da
confirmação do proprietário ou de obter o diagnóstico do bloqueio.
