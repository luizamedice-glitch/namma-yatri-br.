# Plataforma brasileira de mobilidade — ambiente de desenvolvimento

O repositório Namma Yatri é uma **base de engenharia**, não uma dependência contratual de sua infraestrutura original. Código histórico permanece disponível, mas componentes podem ser substituídos por implementação brasileira.

## Etapa 1 — Serviços reais de mapas

O serviço `brasil/backend/server.mjs` fornece endpoints HTTP:
- `GET /health`: disponibilidade, sem precisar de credenciais.
- `POST /v1/places/autocomplete`: busca de endereços em português no Brasil (`{"input":"Av. Brasil","location":{"lat":-23.5,"lng":-46.6}}`).
- `POST /v1/places/details`: localização a partir de identificador de lugar (`{"placeId":"..."}`).
- `POST /v1/routes`: rota, distância e duração entre coordenadas (`{"origin":{"lat":-23.5,"lng":-46.6},"destination":{"lat":-23.6,"lng":-46.7}}`).

O serviço executa **consultas reais** às APIs Places (New) e Routes do Google, sem dados simulados. Requer `GOOGLE_MAPS_SERVER_KEY` configurada no servidor, **separada** da chave Android (`GOOGLE_MAPS_API_KEY`), com restrições apropriadas e faturamento ativado no projeto Google Cloud. `CORS_ORIGIN` restringe origens de navegador; recomenda-se autenticação e limite de requisições antes de exposição pública.

Para executar: `cd brasil/backend && npm start` (Node 20+).

## Fases seguintes

1. Integrar tela Android de passageiro aos endpoints, sem bloquear interface no Juspay/HyperSDK.
2. Persistir usuários, solicitações e estados de viagem no backend, com validações e regras de autorização.
3. Conectar aplicativo do motorista ao mesmo backend para ofertas e aceite de corridas em tempo real.
4. Adicionar pagamento, push, monitoramento e produção posteriormente.

Nenhuma rota de corridas ou comunicação motorista-passageiro está implementada ainda. Não confundir compilação ou abertura do aplicativo legado com fluxo funcional validado.
