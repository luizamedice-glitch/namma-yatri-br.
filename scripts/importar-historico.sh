#!/usr/bin/env bash
set -Eeuo pipefail
trap 'echo "ERRO na linha $LINENO: $BASH_COMMAND" >&2' ERR
echo '==> Iniciando importação do Namma Yatri (histórico completo)'
echo "==> Diretório atual: $PWD"
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
echo "==> Raiz do projeto: $PWD"

# Rodar em um Codespace do repositório Namma Yatri Brasil.
DEST="https://github.com/luizamedice-glitch/namma-yatri-br..git"
UPSTREAM="https://github.com/nammayatri/nammayatri.git"
REMOVAL="872a9d0a8b3a22006a89cff6e6319db9e22b58c2"

if [[ -e nammayatri-upstream ]]; then
  echo "A pasta nammayatri-upstream já existe; escolha um diretório limpo." >&2
  exit 1
fi

echo "==> Clonando upstream (repositório grande, operação pode demorar)..."
git -c progress.delay=0 clone --progress "$UPSTREAM" nammayatri-upstream
echo "==> Clone concluído"
cd nammayatri-upstream
git remote add brasil "$DEST"
echo "==> Obtendo o commit inicial do repositório brasileiro"
git fetch --progress brasil main
echo "==> Criando branch de trabalho"
git switch -c passageiro-pt-br

# O ^ referencia o estado imediatamente anterior à remoção do frontend.
echo "==> Verificando disponibilidade do frontend histórico"
git ls-tree "${REMOVAL}^" Frontend | grep -q Frontend || {
  echo "Frontend ausente no commit histórico. Abortando." >&2; exit 1;
}
echo "==> Restaurando Frontend/ do histórico"
git restore --source="${REMOVAL}^" --staged --worktree Frontend
git -c user.name="Namma Yatri BR" -c user.email="actions@users.noreply.github.com" commit -m "restore: recuperar frontend original do histórico"

# Mescla a linhagem do commit de preparação sem substituir o código upstream.
git -c user.name="Namma Yatri BR" -c user.email="actions@users.noreply.github.com" merge --allow-unrelated-histories -s ours brasil/main -m "chore: registrar histórico de preparação do projeto brasileiro"

cat > README-BR.md <<'EOF'
# Namma Yatri Brasil
Base original: https://github.com/nammayatri/nammayatri
Frontend recuperado do commit pai de 872a9d0a8b3a22006a89cff6e6319db9e22b58c2.
Versão brasileira: trabalho em andamento, sem APK validado.
Preservar avisos de copyright e condições AGPL-3.0 e de terceiros.
EOF
git add README-BR.md
git -c user.name="Namma Yatri BR" -c user.email="actions@users.noreply.github.com" commit -m "docs: registrar origem e recuperação histórica"

echo "Arquivos do frontend recuperados:"
git ls-files Frontend | wc -l
echo "==> Preparação concluída; código pronto para revisão e envio"
echo "Revise as alterações. Para publicar:"
echo "  git push brasil HEAD:refs/heads/passageiro-pt-br"
echo "Depois de validar, abra um PR para main (não sobrescreva main diretamente)."
