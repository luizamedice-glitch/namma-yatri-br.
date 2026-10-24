# Motorista original BR — ambiente de testes

A entrada `Development.Driver` reutiliza `Screens.HomeScreen.View` e intercepta
as ações operacionais para a API brasileira. O Webpack só substitui a entrada
Main com `YATRI_DRIVER_TEST_BUILD=true`; o runtime exige ANDROID, flag BR e pacote
`in.juspay.nammayatripartner.debug`. Main/Flow de produção permanecem intactos.
O código original e suas licenças continuam no repositório.

O painel abre sem login/OTP/KYC. Isso não transforma a API em anônima: a sessão
é vinculada pelo operador ao armazenamento privado de uma instalação debug,
fora do APK. Nenhuma chave bootstrap/credencial estática está no bundle.
A configuração usa `YATRI_DRIVER_BACKEND_URL` e `YATRI_DRIVER_SESSION` no store
nativo `godel`. Sem configuração ou GPS válido, a interface fica indisponível e
informa o erro; o botão só confirma disponibilidade após resposta real.
Localização e snapshot são atualizados a cada cinco segundos durante o painel.

## Conectar pelo celular

O APK do run 40116465299 abre **Conectar motorista** quando não há sessão
configurada ou quando a sessão expira. Cole o código de uso único recebido
privadamente e toque em **Conectar ao servidor**. A URL HTTPS é fixa e a sessão
fica no armazenamento privado do Android. Não precisa de computador/ADB.
Depois, permita localização e toque em **Ativar** no painel original.

Código e sessão de testes têm validade de 24h; reinstalação/expiração requer
nova ativação. O código consumido não pode ser reutilizado. Nenhuma chave de
servidor, token ou credencial compartilhada é embutida no APK. Este mecanismo
não aparece em produção nem no passageiro. O teste Android remoto 40117202534
aprovou essa mesma tela contra o Lightsail real, com GPS do emulador.

## Operação local privada

1. Inicie a stack PostgreSQL/API em `brasil/compose.yaml`, com as variáveis de
   desenvolvimento/veículo já documentadas em `brasil/backend/.env.example`.
   A API precisa habilitar as contas reais de desenvolvimento e ter Giselo e
   seu veículo persistidos. Use uma instalação de testes, nunca produção.
2. No ambiente da API, com `DATABASE_URL`, `YATRI_DEVELOPMENT_MODE=true` e
   `NODE_ENV` diferente de production, execute
   `node src/issue-driver-session.mjs /tmp/giselo-session.json`.
   O arquivo é privado (0600), a sessão dura 24h e a API armazena apenas seu hash.
   Na stack local, execute via `docker compose exec api node src/issue-driver-session.mjs /tmp/giselo-session.json` após reconstruir a imagem com este código. Copie o arquivo para fora do repositório e aplique permissão 0600. Transfira-o por canal privado ao computador com ADB; não envie no chat/Git.
3. Instale o APK e conecte o celular por USB. Execute
   `python3 Frontend/scripts/provision-driver-device.py https://SEU_BACKEND /caminho/privado/giselo-session.json`.
   Para um emulador ou celular por USB: `adb reverse tcp:8080 tcp:8080` e use
   `http://127.0.0.1:8080` como URL base. O operador configura o dispositivo;
   o motorista não vê tela de autenticação.
4. Abra o APK, conceda localização e aguarde GPS válido. Alterne disponibilidade
   e confira os estados no banco/API. Nunca compartilhe o arquivo de sessão.

Atualização de 24/10/2026: Giselo, seu veículo real e Fagner já estão cadastrados
privadamente no piloto Lightsail. A primeira abertura dos APKs do piloto recebe
um código de conexão de uso único e guarda a sessão no store privado; não há
login, OTP, KYC ou credencial estática no APK. Ativação e sessão duram 24 horas.
O workflow `br-driver-lightsail.yml` com `activate=true` emite uma ativação
criptografada para o operador, sem imprimir seu conteúdo. Nunca publique códigos
ou envie a chave privada no chat. O provisionamento ADB acima é uma alternativa
para desenvolvimento local.

O serviço `driver-pilot` é separado da API principal e tem expiração explícita.
Cadastro público e login continuam bloqueados. O run `40121323902` aprovou nos
dois APKs Places/Routes reais, pedido, oferta, aceite e cancelamento via HTTPS.
As ações de chegada/início/conclusão foram implantadas no piloto no run
`40131046069`, com sessões e máquina de estados validadas no backend. O aceite
Android do ciclo completo foi aprovado no run `40134223066`, incluindo retorno
ao painel e recuperação dos processos. Atualizações recusam viagens
ativas e preservam o prazo existente, sem migrations ou alterações de contas.
Consulte AWS-DESENVOLVIMENTO.md; não use a função compartilhada do Alce.

## Verificações e limites

- `node --test Frontend/scripts/test-driver-operations.mjs`: guard, validações,
  isolamento do bypass de Firebase.
- Com PostgreSQL e dependências de `brasil/backend` instaladas:
  `node --test Frontend/scripts/test-driver-backend.integration.mjs`.
  Exercita o cliente usado no APK contra API/banco reais e o ciclo completo;
  somente Google Routes usa fixture declarada neste teste de contrato.
- O aceite Android dos dois APKs usa Google e API/PostgreSQL Lightsail reais.
  As capturas públicas cobrem somente telas sem placa ou código de conexão.
- A adaptação de viagem usa os componentes PureScript `SourceToDestination` e
  `PrimaryButton` já presentes; a Home original é preservada. Isso não comprova
  equivalência visual exata com a versão atual da Play Store.
- Chegada/início/conclusão e recuperação após recriar os processos estão
  aprovadas em Pixel 2/API 29 no run `40134223066`. A confirmação final consulta o registro
  persistido, pois o snapshot retorna somente viagens ativas. O passageiro pode
  usar “Acompanhar viagem” na Home após reabrir o processo.
- APKs e relatório com hashes: `Frontend/build-reports/ciclo-completo/40134223066.json`.
  Na primeira conexão, use a ativação privada do respectivo perfil e conceda
  localização. Se o Android recusar atualizar um debug de assinatura diferente,
  reinstale somente esse aplicativo de testes e refaça sua conexão privada.
- Navegação curva a curva, desenho/acompanhamento da rota durante a viagem,
  indicador legado de horário GPS e menus secundários não são aprovados por
  esse teste de estados. Não há pagamento real.
- Apenas os termos centrais do painel recebem tradução manual nesta primeira
  versão; catálogo completo do motorista e funcionalidades paralelas não estão
  aprovados. Não declarar integração passageiro–motorista pelo build de um APK.

## Configuração local do painel

`src/Development/DashboardDefaults.json` contém os valores originais de
`defaultPetRidesFeatureConfig`, `defaultEnableOtpRideConfig`,
`defaultRideAssignedAudioConfig` e `defaultRideEndAudioConfig`, definidos em
`src/RemoteConfigs/Utils.purs`. `Nothing` é serializado como `null`, conforme o
contrato JSON desses campos opcionais. O adaptador entrega o envelope `default`
esperado pelo decodificador original apenas no pacote motorista BR debug.
Recursos opcionais continuam desativados; valores operacionais vêm da API.

Esse arquivo evita que a ausência do Firebase Remote Config operacional gere
avisos de decodificação sobre o painel. Ele não substitui configuração de
servidor, sessão privada nem integração de corridas. Ao alterar os contratos
PureScript citados, revisar também os valores locais correspondentes.
