# Evidências e pendências — 21/10/2026

## Backend verificado

- Dez testes unitários passaram neste ambiente (Node 24) e o workflow Backend
  passou no Node 22 do GitHub Actions.
- Integração HTTP + PostgreSQL 16 passou em
  [run 39657697144](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39657697144),
  commit `09b9b9e50a91ef49bb0977ec60bc799a0c73d3af`.
- A integração aplica migrations duas vezes; cria usuários e veículos reais em
  schema PostgreSQL isolado; valida login e revogação; exige GPS recente;
  persiste e entrega ofertas; disputa dois aceites simultâneos (200 e 409);
  entrega SSE; recupera ofertas via nova instância do serviço; valida autorização;
  registra chegada, início, conclusão e histórico; verifica recusa, afastamento,
  GPS vencido e cancelamento.
- A suíte ampliada também disputa duas corridas por um mesmo motorista,
  verifica cotação expirada, pedido vencido e privacidade dos eventos.
- O processo executável `server.mjs` passou por teste separado com banco real:
  migrations, startup, healthcheck, cadastro persistido e erro 503 explícito
  quando se tenta obter cotação sem chave Google.
- O transporte Google é fixture explícita somente na suíte de integração.
  Portanto esse resultado não prova chave Google, faturamento, mapas visíveis
  no Android nem a viagem completa entre dois dispositivos.

## Android e CI

| Verificação | Resultado | Execução |
| --- | --- | --- |
| Backend unitário | Passou | [39657697693](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39657697693) |
| Integração e executável PostgreSQL | Passou | [39657697144](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39657697144) |
| Passageiro: compilação e lint | Passou; APK disponível | [39661088753](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39661088753) |
| Motorista: compilação e lint | Passou; APK disponível | [39661088750](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39661088750) |
| Emulador API 30, seis testes AndroidX com banco real | Passou; zero ignorados | [39661088517](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39661088517) |
| Google real | Não executado: chave servidor ausente | `google-evidence.json` no artefato de integração |

Primeira execução detectou configuração antiga de SDK (`tools`) no setup do
runner e aspas incompatíveis no healthcheck PostgreSQL; ambos corrigidos.
Depois os APKs compilaram, mas lint bloqueou dois acessos a Insets incompatíveis
com API 26; proteção por versão corrigida. Emulador detectou que o runner
executa cada linha do script em shell separado; substituímos `cd` por `gradle -p`.

Serviço foreground de GPS foi acrescentado para navegação externa e passou por
compilação e lint. Sua operação durante navegação, bloqueio e economia de bateria
ainda requer dispositivo real. Seis testes AndroidX passaram no emulador,
três por aplicativo, sem testes ignorados: abertura sem dependências externas,
decodificação de polyline e cadastro pela UI nativa com confirmação de sessão
e logout revogado no backend real. PostgreSQL e Node executam no mesmo runner;
contas e veículo são criados pelo fluxo verdadeiro, sem API substituta.
Os testes offline de abertura não representam corrida completa.

As primeiras capturas pós-teste mostraram o launcher, pois o runner desinstala
os aplicativos após a instrumentação. Essas imagens foram inspecionadas e
rejeitadas como evidência da interface. O workflow corrigido reinstala os APKs,
verifica Activity em primeiro plano e o título no XML da UI antes da captura.
As capturas de login e das telas autenticadas foram baixadas e inspecionadas visualmente em
[39661088517](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39661088517),
artefato `android-startup-evidence`. As quatro capturas mostram os aplicativos. As telas autenticadas usam contas reais
do banco de testes. O build de instrumentação omite a chave Android e informa
que o mapa está indisponível; essas imagens não representam validação do Google
Maps real. As capturas de login também são validadas pelo XML da UI.

Artefato final de screenshots, XML, logcat e relatórios JUnit:
[android-startup-evidence](https://github.com/luizamedice-glitch/namma-yatri-br./actions/runs/39661088517/artifacts/12375735016).
Os APKs correspondem ao commit `b884fbf36db07aedfd5fb20121df9c5697d2a00c`;
o backend não mudou desde o commit dos testes PostgreSQL citado acima.

## Bloqueios e trabalho restante

- Este ambiente não tem SDK Android nem PostgreSQL. Inicialmente as conexões
  pelo terminal falharam sob a política padrão do sandbox; com a permissão
  adicional de rede, o acesso funcionou. A integração GitHub permitiu gravar
  todos os commits e executar os testes nos runners. Depois foi obtido clone
  local da branch com o histórico Git completo e checkout esparso.
- O ambiente e o secret do CI não disponibilizaram GOOGLE_MAPS_SERVER_KEY. Não foram
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
