#!/usr/bin/env bash
# build-iso.sh — construit une ISO Debian 13 custom (install auto + miyukini-toolbox).
#
# Pensé pour tourner DANS un conteneur Debian (donc sans VM) — voir iso/README.md :
#   docker run --rm -v "D:/APP/TSSR/miyukini-cms:/work" -w /work debian:trixie \
#     bash -c "apt-get update && apt-get install -y xorriso isolinux wget curl && bash iso/build-iso.sh"
#
# Variables :
#   ISO_URL   répertoire des netinst (défaut: cdimage current amd64 iso-cd)
#   OUT       dossier de sortie (défaut: dist/iso)
#   EMBED_DEB chemin d'un .deb à embarquer pour une install HORS-LIGNE (optionnel)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
OUT="${OUT:-$ROOT/dist/iso}"
EMBED_DEB="${EMBED_DEB:-}"
# VARIANT : netinst (léger, l'install tire la base depuis Internet) ou
#           dvd (~3,7 Go, pool complet → install TOTALEMENT hors-ligne).
VARIANT="${VARIANT:-netinst}"
case "$VARIANT" in
    dvd) DEF_URL="https://cdimage.debian.org/debian-cd/current/amd64/iso-dvd/"; PATTERN='debian-[0-9.]+-amd64-DVD-1\.iso' ;;
    *)   DEF_URL="https://cdimage.debian.org/debian-cd/current/amd64/iso-cd/";  PATTERN='debian-[0-9.]+-amd64-netinst\.iso' ;;
esac
BASEURL="${ISO_URL:-$DEF_URL}"

for o in xorriso wget; do command -v "$o" >/dev/null 2>&1 || { echo "manque $o (apt install xorriso wget)"; exit 1; }; done
ISOHDPFX=/usr/lib/ISOLINUX/isohdpfx.bin
[ -f "$ISOHDPFX" ] || { echo "manque isohdpfx.bin (apt install isolinux)"; exit 1; }

mkdir -p "$OUT"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT

echo "== 1/5 Récupération du netinst Debian (avec cache) =="
CACHE="$OUT/.cache"; mkdir -p "$CACHE"
ISONAME="$(wget -qO- "$BASEURL" | grep -oE "$PATTERN" | head -1)"
[ -n "$ISONAME" ] || { echo "image ($VARIANT) introuvable sous $BASEURL"; exit 1; }
ORIG="$CACHE/$ISONAME"
if [ -f "$ORIG" ]; then
    echo "   -> réutilisation du cache : $ISONAME"
else
    echo "   -> téléchargement : $ISONAME"
    wget -q --show-progress -O "$ORIG.part" "$BASEURL$ISONAME" && mv "$ORIG.part" "$ORIG"
fi

echo "== 2/4 Extraction des SEULS fichiers de boot (empreinte mémoire minime) =="
mkdir -p "$WORK/mod/isolinux" "$WORK/mod/boot/grub" "$WORK/add"
for f in /isolinux/txt.cfg /isolinux/isolinux.cfg /boot/grub/grub.cfg; do
    xorriso -osirrox on -indev "$ORIG" -extract "$f" "$WORK/mod$f" 2>/dev/null || true
done
chmod -R u+w "$WORK/mod" 2>/dev/null || true

echo "== 3/4 Préparation du preseed, du .deb et des entrées de boot =="
# .deb embarqué → preseed HORS-LIGNE (install depuis le CD) ; sinon preseed en ligne.
if [ -n "$EMBED_DEB" ]; then
    [ -f "$EMBED_DEB" ] || { echo "EMBED_DEB introuvable : $EMBED_DEB"; exit 1; }
    mkdir -p "$WORK/add/miyukini"; cp "$EMBED_DEB" "$WORK/add/miyukini/"
    sed '/^#### late_command/,$d' "$HERE/preseed.cfg" > "$WORK/add/preseed.cfg"
    cat >> "$WORK/add/preseed.cfg" <<'EOF'
#### late_command : installe miyukini-toolbox depuis le .deb EMBARQUÉ (hors-ligne)
d-i preseed/late_command string \
  cp -r /cdrom/miyukini /target/tmp/ ; \
  in-target sh -c 'dpkg -i /tmp/miyukini/*.deb || apt-get -f install -y --no-install-recommends' ; \
  in-target rm -rf /tmp/miyukini
EOF
    echo "   -> .deb embarqué ($(basename "$EMBED_DEB")) + preseed hors-ligne"
else
    cp "$HERE/preseed.cfg" "$WORK/add/preseed.cfg"
fi
# DVD = install hors-ligne complète : apt depuis le disque, pas de miroir réseau.
if [ "$VARIANT" = dvd ]; then
    { echo "d-i apt-setup/use_mirror boolean false"; echo "d-i netcfg/dhcp_timeout string 15"; } >> "$WORK/add/preseed.cfg"
    echo "   -> preseed DVD : miroir réseau désactivé (install hors-ligne)"
fi
APPEND='auto=true priority=critical preseed/file=/cdrom/preseed.cfg'
# BIOS (isolinux)
[ -f "$WORK/mod/isolinux/isolinux.cfg" ] && sed -i 's/^timeout .*/timeout 30/' "$WORK/mod/isolinux/isolinux.cfg" 2>/dev/null || true
if [ -f "$WORK/mod/isolinux/txt.cfg" ]; then
    cat >> "$WORK/mod/isolinux/txt.cfg" <<EOF

label miyukini
	menu label ^Installation auto Miyukini (Debian 13)
	menu default
	kernel /install.amd/vmlinuz
	append $APPEND vga=788 initrd=/install.amd/initrd.gz ---
EOF
fi
# UEFI (grub)
if [ -f "$WORK/mod/boot/grub/grub.cfg" ]; then
    { echo; echo "menuentry 'Installation auto Miyukini (Debian 13)' {";
      echo "    linux /install.amd/vmlinuz $APPEND ---";
      echo "    initrd /install.amd/initrd.gz"; echo "}"; } >> "$WORK/mod/boot/grub/grub.cfg"
    sed -i 's/^set default=.*/set default=0/; s/^set timeout=.*/set timeout=3/' "$WORK/mod/boot/grub/grub.cfg" 2>/dev/null || true
fi

echo "== 4/4 Reconstruction (copie indev->outdev + overlay, sans tout extraire) =="
if [ "$VARIANT" = dvd ]; then OUTISO="$OUT/debian-13-miyukini-dvd.iso"
elif [ -n "$EMBED_DEB" ]; then OUTISO="$OUT/debian-13-miyukini-offline.iso"
else OUTISO="$OUT/debian-13-miyukini.iso"; fi
rm -f "$OUTISO"
MAPS=( -map "$WORK/add/preseed.cfg" /preseed.cfg )
[ -f "$WORK/mod/isolinux/txt.cfg" ]      && MAPS+=( -map "$WORK/mod/isolinux/txt.cfg" /isolinux/txt.cfg )
[ -f "$WORK/mod/isolinux/isolinux.cfg" ] && MAPS+=( -map "$WORK/mod/isolinux/isolinux.cfg" /isolinux/isolinux.cfg )
[ -f "$WORK/mod/boot/grub/grub.cfg" ]    && MAPS+=( -map "$WORK/mod/boot/grub/grub.cfg" /boot/grub/grub.cfg )
[ -d "$WORK/add/miyukini" ]              && MAPS+=( -map "$WORK/add/miyukini" /miyukini )
# -boot_image any replay : réutilise les boot records (BIOS+UEFI) de l'ISO d'origine.
xorriso -indev "$ORIG" -outdev "$OUTISO" -boot_image any replay "${MAPS[@]}"

echo
echo "ISO générée : $OUTISO"
ls -lh "$OUTISO"
echo "Grave-la (Rufus/balenaEtcher) ou monte-la : install auto -> miyukini-toolbox déjà présent."
