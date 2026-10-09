#!/usr/bin/env bash
# build-packages.sh — construit les paquets miyukini-toolbox (.deb ET .rpm) via nfpm.
#
# nfpm est un binaire Go autonome : il n'a besoin ni de dpkg-deb ni de rpmbuild,
# et tourne sur n'importe quelle machine (Linux, et même ailleurs).
#
#   bash packaging/build-packages.sh
#
# Sortie : dist/packages/miyukini-toolbox_<ver>_all.deb et ...noarch.rpm
set -euo pipefail
cd "$(dirname "$0")/.."          # racine du dépôt

if ! command -v nfpm >/dev/null 2>&1; then
    cat <<'EOF'
nfpm introuvable. Installe-le (au choix) :
  • binaire :  https://github.com/goreleaser/nfpm/releases   (dézippe 'nfpm' dans le PATH)
  • Go      :  go install github.com/goreleaser/nfpm/v2/cmd/nfpm@latest
  • script  :  curl -sfL https://install.goreleaser.com/github.com/goreleaser/nfpm.sh | sh
EOF
    exit 1
fi

mkdir -p dist/packages
echo "== Construction du .deb =="
nfpm package -f packaging/nfpm.yaml -p deb -t dist/packages/
echo "== Construction du .rpm =="
nfpm package -f packaging/nfpm.yaml -p rpm -t dist/packages/

echo
echo "Paquets générés :"
ls -la dist/packages/
echo
echo "Installer (Debian/Ubuntu) :  sudo apt install ./dist/packages/miyukini-toolbox_*_all.deb"
echo "Installer (RHEL/Rocky)    :  sudo dnf install ./dist/packages/miyukini-toolbox-*.noarch.rpm"
