#!/usr/bin/env bash
# publier-outils.sh — publie les scripts d'outils et (re)génère leurs sommes SHA-256.
#
# À lancer sur l'hôte de prod (là où vit dist/client) après avoir modifié un
# script dans client/public/ :
#     bash scripts/publier-outils.sh
#
# Rôle :
#   1) copie client/public/*.sh -> dist/client/  (dossier servi par le CMS) ;
#   2) génère client/public/SHA256SUMS (source de vérité, versionnée) ;
#   3) recopie SHA256SUMS dans dist/client/ (servi sur https://tssr.miyukini.com/SHA256SUMS).
#
# Évite de recopier les fichiers à la main, et donne aux étudiants un moyen de
# vérifier l'intégrité d'un script avant de l'exécuter en root.
set -euo pipefail

cd "$(dirname "$0")/.."              # racine du projet
SRC="client/public"
DST="dist/client"
mkdir -p "$DST"

shopt -s nullglob
copies=()
for f in "$SRC"/*.sh "$SRC"/*.conf.example; do
    cp "$f" "$DST/$(basename "$f")"
    copies+=("$(basename "$f")")
done

# Sommes de contrôle (noms de base), écrites dans les deux dossiers.
( cd "$SRC" && sha256sum *.sh *.conf.example > SHA256SUMS )
cp "$SRC/SHA256SUMS" "$DST/SHA256SUMS"

echo "Scripts publiés dans $DST : ${copies[*]}"
echo "SHA256SUMS régénéré :"
sed 's/^/    /' "$SRC/SHA256SUMS"
