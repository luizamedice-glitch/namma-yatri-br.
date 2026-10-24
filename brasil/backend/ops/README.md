# Atualização do backend existente no Lightsail

Alvo: instância de desenvolvimento `yatri-brasil-dev`, `/opt/yatri-brasil`, documentada em `AWS-DESENVOLVIMENTO.md`. O servidor já possui PostgreSQL, API e Caddy. Estes arquivos não concedem acesso SSH/AWS.

`deploy-lightsail.sh` recebe um SHA completo já revisado e disponível no Git local. Usa o Compose e seus arquivos de ambiente **existentes**. Arquiva os fontes daquele SHA em um diretório separado, compara o conteúdo das migrations com a imagem atualmente executada, constrói uma imagem identificada pelo commit e inspeciona o banco sem criar usuários nem retornar dados pessoais. Migrations diferentes ou contas automáticas habilitadas interrompem a operação antes da troca da API.

A atualização recria somente `api`, com `--no-deps`. PostgreSQL/volumes, Caddy, firewall, portas e arquivos de segredos não são modificados pelo script. A interrupção da API pode encerrar conexões em andamento: usar janela de desenvolvimento sem viagens. Em falha após a troca, restaura a imagem anterior e verifica a saúde. Como as migrations precisam ser idênticas, o retorno da imagem não exige restauração do banco.

## Executar no servidor com acesso autorizado

```bash
cd /opt/yatri-brasil/projeto
git fetch origin codex/issue-1-purescript-memory
# Defina YATRI_DEPLOY_SHA com o SHA completo revisado; não use um HEAD móvel.
git show "$YATRI_DEPLOY_SHA:brasil/backend/ops/deploy-lightsail.sh" > /tmp/yatri-deploy-reviewed.sh
sudo bash /tmp/yatri-deploy-reviewed.sh "$YATRI_DEPLOY_SHA"
```

Não usar o `brasil/compose.yaml` local para substituir o Compose do servidor: ele habilita contas automáticas e possui nomes de serviços/volumes diferentes. Não executar `down -v`, nem imprimir `docker compose config`, `docker inspect` integral, `.env` ou arquivos em `secrets/`.

Após sucesso, usar sempre os dois arquivos ao operar a API:

```bash
cd /opt/yatri-brasil
docker compose -f compose.yaml -f compose.api-image.json ps
docker compose -f compose.yaml -f compose.api-image.json exec -T api node src/deployment-check.mjs
```

O script informa o diretório `deploy-<sha>-...` com os overrides `candidate.json` e `rollback.json`. Para retorno manual à versão anterior, usar o `rollback.json` desse diretório com `up -d --no-deps --no-build --pull never api` e, após conferir saúde, copiá-lo para `compose.api-image.json`. Não remover imagens necessárias ao retorno.

## Verificações

- `src/deployment-check.mjs`: conexão PostgreSQL, migrations esperadas, existência das tabelas, contas automáticas desabilitadas e configuração do convite. Exibe somente nomes de migrations e estados booleanos; presença de chave Google não comprova quota/ativação.
- Docker `HEALTHCHECK`: consulta `/health` internamente; executa `SELECT 1` pelo backend real.
- `python3 ops/check-public.py`: HTTPS `/health` 200 e rotas operacionais 403, preservando a fronteira atual documentada.
- `npm test`, `npm run test:integration` e `node test/cli-smoke.mjs`: executar exclusivamente contra PostgreSQL descartável. Testes de fluxo usam fixture explícita de Google; não comprovam pesquisa Google nem APK integrado.

A conexão futura do APK exige uma sessão segura e liberação revisada de endpoints. Este procedimento não abre automaticamente rotas públicas nem incorpora credenciais no aplicativo. O endereço HTTPS isoladamente não configura essa conexão.
