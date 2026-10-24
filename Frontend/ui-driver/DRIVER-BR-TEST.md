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

O Lightsail atual NÃO libera essas rotas operacionais: somente health e testes
de mapas estão publicados. Nenhuma regra Caddy/firewall ou sessão remota foi
alterada nesta etapa. Não use a função compartilhada do Alce.

## Verificações e limites

- `node --test Frontend/scripts/test-driver-operations.mjs`: guard, validações,
  isolamento do bypass de Firebase.
- Com PostgreSQL e dependências de `brasil/backend` instaladas:
  `node --test Frontend/scripts/test-driver-backend.integration.mjs`.
  Exercita o cliente usado no APK contra API/banco reais e o ciclo completo;
  somente Google Routes usa fixture declarada neste teste de contrato.
- O aceite Android usa API/PostgreSQL reais locais e GPS do emulador, sem
  fabricar rotas/ofertas: testa abertura, GPS e disponibilidade do painel original.
- O cliente tem chamadas de aceitar/recusar/chegar/iniciar/concluir, mas a ligação
  de ofertas e viagens aos layouts originais ainda requer implementação/aceite.
  O passageiro atual ainda está no modo de mapas e não solicita corridas reais.
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
