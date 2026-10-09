#!/usr/bin/env bash
# build-repo.sh — construit les DÉPÔTS signés (APT + RPM) à partir des paquets.
#
# À lancer sur une machine Linux (outils requis). Produit un dossier repo/ prêt
# à publier, que le CMS sert sur https://tssr.miyukini.com/apt et /rpm.
#
#   GPG_KEY="miyukini@gmail.com" bash packaging/build-repo.sh
#
# Prérequis :
#   - paquets déjà construits : bash packaging/build-packages.sh   (dist/packages/*.deb,*.rpm)
#   - apt-utils (apt-ftparchive), createrepo_c (ou createrepo), gpg
#   - une CLÉ GPG de signature :
#       gpg --quick-generate-key "Miyukini Packages <miyukini@gmail.com>" rsa4096 sign never
set -euo pipefail
cd "$(dirname "$0")/.."                       # racine du dépôt

: "${GPG_KEY:?Définis GPG_KEY=<email/id de ta clé> (gpg --list-secret-keys)}"
SUITE="${SUITE:-stable}"; COMP="${COMP:-main}"
PKGDIR="dist/packages"; REPO="repo"

miss=0
command -v apt-ftparchive >/dev/null 2>&1 || { echo "manque apt-ftparchive (apt install apt-utils)"; miss=1; }
command -v createrepo_c >/dev/null 2>&1 || command -v createrepo >/dev/null 2>&1 || { echo "manque createrepo_c (apt install createrepo-c | dnf install createrepo_c)"; miss=1; }
command -v gpg >/dev/null 2>&1 || { echo "manque gpg"; miss=1; }
[ "$miss" = 0 ] || exit 1
ls "$PKGDIR"/*.deb >/dev/null 2>&1 || { echo "Aucun .deb dans $PKGDIR → lance d'abord: bash packaging/build-packages.sh"; exit 1; }

# ── Dépôt APT ────────────────────────────────────────────────────────────────
echo "== Dépôt APT =="
A="$REPO/apt"; rm -rf "$A"; mkdir -p "$A/pool/$COMP" "$A/dists/$SUITE/$COMP/binary-all"
cp "$PKGDIR"/*.deb "$A/pool/$COMP/"
(
  cd "$A"
  apt-ftparchive packages "pool/$COMP" > "dists/$SUITE/$COMP/binary-all/Packages"
  gzip -9kf "dists/$SUITE/$COMP/binary-all/Packages"
  apt-ftparchive \
    -o APT::FTPArchive::Release::Origin=Miyukini \
    -o APT::FTPArchive::Release::Label=Miyukini \
    -o APT::FTPArchive::Release::Suite="$SUITE" \
    -o APT::FTPArchive::Release::Codename="$SUITE" \
    -o APT::FTPArchive::Release::Components="$COMP" \
    -o APT::FTPArchive::Release::Architectures=all \
    release "dists/$SUITE" > "dists/$SUITE/Release"
  gpg --default-key "$GPG_KEY" --batch --yes --clearsign -o "dists/$SUITE/InRelease" "dists/$SUITE/Release"
  gpg --default-key "$GPG_KEY" --batch --yes -abs -o "dists/$SUITE/Release.gpg" "dists/$SUITE/Release"
)
gpg --armor --export "$GPG_KEY" > "$A/key.gpg"

# ── Dépôt RPM ────────────────────────────────────────────────────────────────
if ls "$PKGDIR"/*.rpm >/dev/null 2>&1; then
  echo "== Dépôt RPM =="
  Rr="$REPO/rpm"; rm -rf "$Rr"; mkdir -p "$Rr"
  cp "$PKGDIR"/*.rpm "$Rr/"
  if command -v createrepo_c >/dev/null 2>&1; then createrepo_c "$Rr"; else createrepo "$Rr"; fi
  gpg --default-key "$GPG_KEY" --batch --yes --detach-sign --armor "$Rr/repodata/repomd.xml"
  gpg --armor --export "$GPG_KEY" > "$Rr/key.gpg"
fi

echo
echo "Dépôts générés sous ./$REPO/"
cat <<EOF

➡ PUBLIER : copie le dossier ./repo/ à la racine du projet sur la PROD, puis
   redémarre le CMS (il sert alors /apt et /rpm) :
      (sur la prod)  …/miyukini-cms/repo/apt   et   …/miyukini-cms/repo/rpm
      pm2 restart tssr     # ou le process du CMS
   Vérifie :  curl -I https://tssr.miyukini.com/apt/dists/$SUITE/InRelease   (200, pas du HTML)

➡ CLIENT Debian/Ubuntu :
   curl -fsSL https://tssr.miyukini.com/apt/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/miyukini.gpg
   echo "deb [signed-by=/usr/share/keyrings/miyukini.gpg] https://tssr.miyukini.com/apt $SUITE $COMP" | sudo tee /etc/apt/sources.list.d/miyukini.list
   sudo apt update && sudo apt install miyukini-toolbox

➡ CLIENT RHEL/Rocky/Alma :
   sudo tee /etc/yum.repos.d/miyukini.repo >/dev/null <<REPO
   [miyukini]
   name=Miyukini
   baseurl=https://tssr.miyukini.com/rpm
   enabled=1
   repo_gpgcheck=1
   gpgcheck=0
   gpgkey=https://tssr.miyukini.com/rpm/key.gpg
   REPO
   sudo dnf install miyukini-toolbox
   # (gpgcheck=1 possible si tu SIGNES aussi les .rpm — voir packaging/README.md)
EOF
