# API REST e eventos

Contrato em `openapi.json` (OpenAPI 3.1). API privada de testes; não implantar
publicamente. Endpoints, exceto `/health`, `/v1/auth/register` e
`/v1/auth/login` e `/v1/development/session`, exigem `Authorization: Bearer <token>`.

## Acesso Yatri Brasil em desenvolvimento

Com `YATRI_DEVELOPMENT_MODE=true`, o servidor provisiona Fagner e Giselo no PostgreSQL.
`POST /v1/development/session` recebe `{role,credential}` e retorna `{token,user:{id,name,role}}`.
`role` é `passenger` ou `driver`; `credential` corresponde somente ao secret deste perfil.
São exigidas duas chaves aleatórias independentes de 32 bytes, em hexadecimal.
O aplicativo faz esse processo automaticamente e guarda a sessão criptografada no aparelho.
A sessão tem validade de 30 dias e pode ser revogada pelo endpoint de logout.
A credencial do outro perfil é rejeitada, e login/cadastro abaixo retornam 403 neste modo.
Fora desse modo, o endpoint de desenvolvimento retorna 404.
O servidor impede a combinação com `NODE_ENV=production`.
Dados do veículo vêm de `YATRI_DRIVER_PLATE`, `YATRI_DRIVER_MODEL`, `YATRI_DRIVER_COLOR`.

## Acesso legado (modo de contas automáticas desabilitado)

`POST /v1/auth/register` recebe name, email, password (10–128 caracteres), role
(`passenger` ou `driver`) e inviteCode igual a TEST_INVITE_CODE do servidor.
Motorista também informa vehicle com plate, model e color. Placa aceita formato
brasileiro antigo ou Mercosul, sem hífen. Cadastro cria usuário e veículo reais.

`POST /v1/auth/login`: email e password. Ambos retornam `{token,user:{id,name,role}}`.
`POST /v1/auth/logout` revoga a sessão atual. Não há SMS, login Firebase ou
verificação de email nesta fase.

## Mapas e cotação

`POST /v1/places/autocomplete`: `{input,location?:{lat,lng}}`; retorna
`{suggestions:[{placeId,address}]}`. Busca restrita ao Brasil e pt-BR.

`POST /v1/places/details`: `{placeId}`; retorna `{placeId,address,location:{lat,lng}}`.

`POST /v1/routes`: `{origin:{lat,lng},destination:{lat,lng}}`; retorna `{routes:[route]}`.
`route` contém distanceMeters, durationSeconds, encodedPolyline e fareCents.

`POST /v1/quotes`: perfil passageiro, `{origin:{lat,lng,address},destination:{lat,lng,address}}`.
Retorna `{id,origin,destination,route,fareCents,expiresAt}`. Distância, tempo e
polyline vêm da API Google; tarifa informativa vem da configuração do servidor.
Cotação é persistida e vinculada ao passageiro por 5 minutos.

## Motoristas e viagens

`POST /v1/driver/location`: `{lat,lng}`, perfil motorista. Atualiza posição e
instante do recebimento no servidor; não aceita timestamp arbitrário do cliente.
`POST /v1/driver/availability`: `{available:boolean}`; para ativar, exige posição
de menos de 60 segundos. Posição vencida impede oferta e aceite, mesmo que o
motorista tenha deixado a flag de disponibilidade ligada.

`POST /v1/rides`: `{quoteId}`. O servidor calcula/valida tudo a partir da cotação
persistida e retorna `{id}`. Repetir o mesmo quoteId retorna a mesma corrida,
incluindo se já encerrada. Não aceita escolher motorista ou preço pelo corpo.

`GET /v1/snapshot`: `{user,available,rides,offers}`. `rides` contém somente a
corrida ativa do próprio usuário; `offers` contém ofertas elegíveis de motorista
disponível e livre, com máximo de 20. Snapshots recuperam o estado após reconexão.

`GET /v1/rides/{id}`: corrida para participante atribuído. Motoristas sem aceite
consultam a oferta pelo snapshot, sem acesso ao endpoint particular da corrida.
`GET /v1/rides`: `{rides:[...]}`, últimas 100 corridas do próprio participante.

`POST /v1/rides/{id}/accept`: motorista com oferta persistida, não recusada,
disponível, GPS recente e dentro do raio. Revalida tudo dentro da transação.
Um único aceite pode vencer; disputas retornam 409. Reenvio pelo vencedor é
idempotente enquanto a corrida permanecer ativa.

`POST /v1/rides/{id}/reject`: motorista recusa sua própria oferta; não cancela a
solicitação do passageiro e a recusa não é esquecida em reinício do servidor.

`POST /v1/rides/{id}/arrive`, `/start`, `/complete`: motorista atribuído, na
ordem `accepted → arrived → in_progress → completed`. Ações fora de ordem
retornam 409. `POST /v1/rides/{id}/cancel`: participante, antes do início.
Corpos das ações podem ser `{}`.

Corrida retorna campos snake_case do contrato, incluindo id, passenger_id,
driver_id, passenger_name, driver_name, plate, model, color, origin, destination,
route, fare_cents, status, version, created_at, updated_at e driver_location_at.
A última posição do motorista é exposta somente enquanto a corrida está ativa;
não há acesso ao GPS atual de motoristas de corridas encerradas.

## SSE

`GET /v1/events` autenticado retorna `text/event-stream`. Aceita cabeçalho
`Last-Event-ID` ou query `after` numérico. Nunca enviar token pela URL. Exemplo:

```text
id: 42
event: ride.updated
data: {"rideId":"uuid-da-corrida","status":"accepted","version":2}

```

Eventos: `connected`, `offer.created`, `offer.rejected`, `ride.updated`,
`driver.location`. Eventos de domínio são persistidos na mesma transação das
mudanças. Cada usuário lê somente seus eventos. O cliente deve recuperar o
snapshot após conexão e eventos; payload não substitui autorização REST.

O servidor consulta os eventos a cada segundo e envia heartbeat quando não há
mudança; cliente deve reconectar e reenviar cursor. Sessões expiradas/revogadas
encerram o stream. Não há push em background; motorista deve abrir o aplicativo
para ver e aceitar ofertas. GPS usa serviço foreground com indicação do Android.

## Erros

Formato `{error:"mensagem em português"}`. Códigos: 400 entrada inválida, 401
sessão ausente/expirada, 403 perfil/participação/convite inválido, 404 recurso
inacessível, 409 conflito de estado/cadastro/cotação, 413 corpo excedido, 422 rota
não encontrada, 429 limite local por IP, 502 falha de provedor, 503 configuração
ausente ou limite de streams. Falhas não incluem credenciais nem detalhes SQL.

Tarifas são somente informativas em BRL, sem débito, cobrança ou promessa de
precificação comercial. O estado `completed` registra a conclusão declarada
pelo motorista, sem processar pagamento.
