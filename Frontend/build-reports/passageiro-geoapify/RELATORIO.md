# Geoapify e mapa do passageiro — 25/10/2026

## Versão entregue

- Fontes do APK: `554c147e625bb9797f0fbc4a6921ccf437e21a9d`.
- Build e aceite Android 16/API 36: [40213953987](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40213953987), aprovado.
- APK: artefato `12606883337`, SHA256 interno `bb99fb16c554eba52b15c25e41a5a11adfbd07a656e0498a8ccdc0c9ac44e617`.
- Evidência Android: `12607361037`; `gps-endereco-real.png` e `accepted.png` inspecionados visualmente.
- 42 testes Node aprovados no mesmo build, incluindo callbacks, geocoding, estados e mapa.
- Mesmo APK, sem recompilar: Android 10/API 29 aprovado em
  [40215993505](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40215993505),
  evidência `12607641870`. `cold-acceptance.json` confirma botões na primeira
  abertura, retomada, recuperação após force-stop, todos os estados e
  exportação diagnóstica segura. Esse roteiro cobre ciclo frio; o endereço
  Geoapify real foi exigido pelo roteiro separado do Android 16.

## Comportamento

O passageiro resolve o endereço do GPS por `POST /v1/places/reverse`, com a
sessão privada existente. O backend consulta Geoapify em português e devolve
o endereço e sua atribuição. A coordenada de embarque continua sendo a do GPS;
não é substituída pelo centro do endereço retornado. Pesquisa/seleção manual
de origem permanece soberana, e callbacks de posições ou telas antigas são
descartados. Falha do provedor mantém GPS e pesquisa utilizáveis.

Google Maps continua responsável pelo mapa; Places pela pesquisa manual;
Routes pela geometria das rotas. Geoapify substitui a dependência do geocoder
Android para identificar o endereço GPS neste fluxo de passageiro BR debug.
Não há chave Geoapify no APK. Atribuição Geoapify/© OpenStreetMap com links
aparece nas telas do passageiro.

Revisão do mapa já incorporada nessas fontes: marcadores próprios para origem
e destino, limpeza das chaves legadas, rota rosa `#E6007E`, carro com orientação
estimada entre posições GPS, margem de 48 dp no enquadramento. Atualizações GPS
não reenquadram continuamente o mapa depois de um gesto manual. Ponte, telas
PureScript e contrato do motorista preservados.

## Servidor

- Configuração privada validada no run `40212511493`, sem reiniciar serviços.
- Tentativa `40213952223` bloqueada por `ACTIVE_RIDES_BLOCK_DEPLOY`; proteção mantida.
- Após proprietário informar corrida encerrada/cancelada, implantação
  [40215991172](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/40215991172)
  aprovada, revisão `554c147e625bb9797f0fbc4a6921ccf437e21a9d`.
- API principal, PostgreSQL e maps-test preservados; migrations idênticas,
  sem provisionar contas/veículos nem alterar portas. Janela do piloto
  preservada até `2026-10-31T18:16:18.740028+00:00`.
- Rota reversa sem sessão retorna 401; demais rotas não autorizadas seguem
  bloqueadas. Consulta real ao Geoapify dentro do serviço implantado aprovada
  em `40216101093`: `verified=true`, sem exibir chave/endereço/resposta.
- Envelope temporário de configuração removido da árvore em `1c64140`.

## Aceite e limites

Android 16 confirmou endereço real Geoapify no campo original, seleção manual
de origem/destino por Places, rota real Google, perda de resposta após commit,
recuperação da cotação/rede e ciclo completo de estados no mesmo processo.
Usou PostgreSQL/API isolados e motorista por HTTP autenticado. O servidor
Lightsail foi validado separadamente; não foi criada corrida remota neste
fechamento. Não é um novo teste físico ou de rua em dois aparelhos.

Somente passageiro precisa ser reinstalado: a assinatura debug é diferente
da entrega anterior. Ativação privada de uso único emitida em `40216103327`,
válida até `2026-10-26T17:22:20.396Z`; código fora do Git/logs. Motorista
anterior continua compatível. Assinatura persistente, push, GPS em segundo
plano e navegação curva a curva permanecem pendentes.
