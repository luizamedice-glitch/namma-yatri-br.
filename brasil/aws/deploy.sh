#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [[ ! -f .env ]]; then
  echo 'Configure brasil/.env conforme aws/README.md antes de implantar.' >&2
  exit 1
fi

# Nome estável: reutiliza os volumes em atualizações deste ambiente.
# Não usar este script sobre uma instalação anterior sem conferir o nome do projeto.
docker compose --project-name yatri-br --env-file .env \
  -f compose.yaml -f aws/compose.yaml \
  up -d --build --wait --wait-timeout 180

echo 'Serviços iniciados. Valide uma vez https://SEU_DOMINIO/health antes de gerar os APKs.'
