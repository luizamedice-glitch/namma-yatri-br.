# Geocodificação reversa do passageiro

`POST /v1/places/reverse` recebe `{ "location": { "lat": -23.5505, "lng": -46.6333 } }`
e exige a sessão Bearer já utilizada pelo aplicativo. Responde com `address`,
`location`, `provider: "geoapify"` e `attribution`. Endereço/coordenadas vêm do
Geoapify real; o passageiro mantém a coordenada GPS original para o embarque.
Nenhuma corrida, usuário ou veículo é alterado por essa consulta.

Configure `GEOAPIFY_API_KEY` somente no ambiente do backend. No Lightsail de
desenvolvimento, a configuração fica em `/opt/yatri-brasil/secrets/geoapify.env`,
permissão 600, carregada pelo contêiner do piloto. O secret GitHub homônimo é
usado apenas pela API efêmera de testes; não é passado ao build Android.

A entrega usa envelope RSA-OAEP/SHA-256 para a identidade SSH existente. O modo
`export-public-key` do workflow `br-geocoding-check.yml` entrega só a chave
pública. O modo `configure-geoapify` espera um envelope temporário
`ops/geoapify-key.sealed`; decifra somente no runner, atualiza o secret GitHub
com a identidade administrativa já autorizada e valida/configura o servidor
sem reiniciar serviços. Remover o envelope da árvore após a configuração.

Implantação: `br-driver-lightsail.yml`, sem provisionar usuários. Recusa viagens
ativas, exige migrations idênticas, preserva a janela do piloto e os demais
contêineres. Só adiciona a rota autenticada de leitura ao Caddy.

Proteções do provedor: timeout de 8 s, até quatro consultas simultâneas,
coalescência por posição e cache de 10 minutos/256 posições, limite padrão de
500 chamadas por dia por processo. Contadores reiniciam com o processo; esse
limite de testes não é um controle financeiro de produção. Não há compra ou
ativação de plano pago neste procedimento.

O passageiro usa a ponte HTTP original. A chave não vai no APK, na URL do
cliente ou em preferências do Android. Respostas antigas, telas fechadas e
origem manual não são sobrescritas. Falha mantém GPS/pesquisa manual utilizáveis,
sem simular endereço. O geocodificador do Android não é mais dependência desse
fluxo. Google Maps, Google Places e Google Routes permanecem nos seus papéis.

Atribuição no passageiro: Geoapify e © OpenStreetMap, com links, na Home e no
acompanhamento. Interface original PureScript/PrestoDOM preservada.
