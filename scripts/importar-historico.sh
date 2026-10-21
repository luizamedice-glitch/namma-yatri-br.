#!/usr/bin/env bash
set -euo pipefail

# Rodar em um Codespace do repositório Namma Yatri Brasil.
DEST="https://github.com/luizamedice-glitch/namma-yatri-br..git"
UPSTREAM="https://github.com/nammayatri/nammayatri.git"
REMOVAL="872a9d0a8b3a22006a89cff6e6319db9e22b58c2"

if [[ -e nammayatri-upstream ]]; then
  echo "A pasta nammayatri-upstream já existe; escolha um diretório limpo." >&2
  exit 1
fi

git clone "$UPSTREAM" nammayatri-upstream
cd nammayatri-upstream
git remote add brasil "$DEST"
git fetch brasil main
git switch -c passageiro-pt-br

# O ^ referencia o estado imediatamente anterior à remoção do frontend.
git cat-file -e "${REMOVAL}^:{tree}" 2>/dev/null || true
git ls-tree "${REMOVAL}^" Frontend | grep -q Frontend || {
  echo "Frontend ausente no commit histórico. Abortando." >&2; exit 1;
}
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
echo "Revise as alterações. Para publicar:"
echo "  git push brasil HEAD:refs/heads/passageiro-pt-br"
echo "Depois de validar, abra um PR para main (não sobrescreva main diretamente)."
