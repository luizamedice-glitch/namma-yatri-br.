# Motor de mapas da versão de teste

Autorizado pelo proprietário para o passageiro BR debug abrir sem login, OTP,
cadastro ou credencial embutida. O motor faz chamadas reais ao Google e não cria
usuários, sessões ou corridas. A API principal continua separada.

URL: `https://52-67-246-31.sslip.io`.

| Método | Caminho | Corpo |
| --- | --- | --- |
| POST | `/v1/test/places/autocomplete` | `{"input":"Avenida Paulista São Paulo"}` |
| POST | `/v1/test/places/details` | `{"placeId":"ID recebido na busca"}` |
| POST | `/v1/test/routes` | `{"origin":{"lat":-23.5614,"lng":-46.6559},"destination":{"lat":-23.5505,"lng":-46.6333}}` |

Sem cabeçalho de autenticação. Os contratos de resposta são os mesmos das
operações de mapas da API brasileira. A chave Google fica somente no servidor.
Outros métodos/caminhos não são encaminhados ao motor de teste.

## Instalação existente

`compose.maps-test.json` complementa o Compose existente para operar somente o
serviço `maps-test`, com a mesma imagem imutável da API já instalada. Código em
`/opt/yatri-brasil/test-engine/maps-test-server.mjs`, somente leitura; Google em
`/opt/yatri-brasil/secrets/maps-test.env`, permissão 600. O serviço não recebe
credenciais do banco e usa uma rede Docker separada. Porta interna publicada
somente em `127.0.0.1:8081`. API e PostgreSQL existentes não são recriados.

`deploy-maps-test.py` valida o Caddy antes de recarregar e restaura o Caddy e os
arquivos anteriores em caso de falha. Não abre portas no firewall. As três rotas
POST são inseridas em um bloco marcado `YATRI MAPS TEST` no domínio existente.

A janela atual termina em **2026-10-30T18:22:42.727971+00:00**. Depois disso,
as operações retornam 503. Limite compartilhado de 30 chamadas/minuto e
1000/dia; contadores em memória, reiniciados com o processo. Isso é um piloto
temporário, não um controle de quota comercial ou arquitetura de produção.

## APK e compilação rápida

No workflow `br-purescript-memory.yml`, selecionar `maps_test_mode=true`,
`ffi_only=true`, `cache_run_id=39866367286` e `compilador=0.15.14`.
O modo rápido exige fontes PureScript, contratos `.js` do FFI, manifestos e
configuração Webpack iguais à referência. Não admite alterações PureScript sem
compilar. A mudança `.mjs` do cliente é empacotada novamente pelo Webpack real.

O asset exclusivo de BR debug contém `mapsTestMode=true`, a URL HTTPS e
credencial vazia. O cliente chama diretamente `/v1/test/places/...`, sem sessão.
Os guards Android/debug existentes continuam aplicados. Não há mudança nas
views, fontes PureScript, marca, motorista ou autenticação de produção.

O teste Android desta variante exige `places-acceptance.json` com `passed` para
os dois campos. Compilar ou receber health 200 não substitui esse aceite.

Aceite aprovado no run 40005145677, emulador Android API 29, fontes `3155e66`.
APK 12524197861 e evidências 12523888694. Praça da Sé e Av. Paulista selecionadas
por Google real, endereços preservados ao reabrir e mapa correspondente conferido.

Para renovar a janela sem recompilar o APK, repetir o job de implantação do run
40002766100 em Actions. O script atualiza somente o motor de teste e o bloco
marcado no Caddy, com retorno ao estado anterior em caso de falha.
