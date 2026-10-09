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
BASEURL="${ISO_URL:-https://cdimage.debian.org/debian-cd/current/amd64/iso-cd/}"
EMBED_DEB="${EMBED_DEB:-}"

for o in xorriso wget; do command -v "$o" >/dev/null 2>&1 || { echo "manque $o (apt install xorriso wget)"; exit 1; }; done
ISOHDPFX=/usr/lib/ISOLINUX/isohdpfx.bin
[ -f "$ISOHDPFX" ] || { echo "manque isohdpfx.bin (apt install isolinux)"; exit 1; }

mkdir -p "$OUT"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT

echo "== 1/5 Récupération du netinst Debian (avec cache) =="
CACHE="$OUT/.cache"; mkdir -p "$CACHE"
ISONAME="$(wget -qO- "$BASEURL" | grep -oE 'debian-[0-9.]+-amd64-netinst\.iso' | head -1)"
[ -n "$ISONAME" ] || { echo "netinst introuvable sous $BASEURL"; exit 1; }
ORIG="$CACHE/$ISONAME"
if [ -f "$ORIG" ]; then
    echo "   -> réutilisation du cache : $ISONAME"
else
    echo "   -> téléchargement : $ISONAME"
    wget -q --show-progress -O "$ORIG.part" "$BASEURL$ISONAME" && mv "$ORIG.part" "$ORIG"
fi

echo "== 2/5 Extraction de l'ISO =="
xorriso -osirrox on -indev "$ORIG" -extract / "$WORK/iso" >/dev/null 2>&1
chmod -R u+w "$WORK/iso"

echo "== 3/5 Injection du preseed + bootloaders =="
# .deb embarqué → preseed HORS-LIGNE (install depuis le CD) ; sinon preseed en ligne.
if [ -n "$EMBED_DEB" ]; then
    [ -f "$EMBED_DEB" ] || { echo "EMBED_DEB introuvable : $EMBED_DEB"; exit 1; }
    mkdir -p "$WORK/iso/miyukini"; cp "$EMBED_DEB" "$WORK/iso/miyukini/"
    # preseed = base (tout avant late_command) + late_command qui installe le .deb du CD
    sed '/^#### late_command/,$d' "$HERE/preseed.cfg" > "$WORK/iso/preseed.cfg"
    cat >> "$WORK/iso/preseed.cfg" <<'EOF'
#### late_command : installe miyukini-toolbox depuis le .deb EMBARQUÉ (hors-ligne)
d-i preseed/late_command string \
  cp -r /cdrom/miyukini /target/tmp/ ; \
  in-target sh -c 'dpkg -i /tmp/miyukini/*.deb || apt-get -f install -y --no-install-recommends' ; \
  in-target rm -rf /tmp/miyukini
EOF
    echo "   -> .deb embarqué ($(basename "$EMBED_DEB")) + preseed hors-ligne"
else
    cp "$HERE/preseed.cfg" "$WORK/iso/preseed.cfg"
fi
APPEND='auto=true priority=critical preseed/file=/cdrom/preseed.cfg'
# BIOS (isolinux)
if [ -f "$WORK/iso/isolinux/isolinux.cfg" ]; then
    sed -i 's/^timeout .*/timeout 30/' "$WORK/iso/isolinux/isolinux.cfg" || true
    cat >> "$WORK/iso/isolinux/txt.cfg" <<EOF

label miyukini
	menu label ^Installation auto Miyukini (Debian 13)
	menu default
	kernel /install.amd/vmlinuz
	append $APPEND vga=788 initrd=/install.amd/initrd.gz ---
EOF
fi
# UEFI (grub)
if [ -f "$WORK/iso/boot/grub/grub.cfg" ]; then
    { echo; echo "menuentry 'Installation auto Miyukini (Debian 13)' {";
      echo "    linux /install.amd/vmlinuz $APPEND ---";
      echo "    initrd /install.amd/initrd.gz"; echo "}"; } >> "$WORK/iso/boot/grub/grub.cfg"
    sed -i 's/^set default=.*/set default=0/; s/^set timeout=.*/set timeout=3/' "$WORK/iso/boot/grub/grub.cfg" || true
fi

echo "== 4/5 Recalcul des sommes md5 (sinon l'installeur rouspète) =="
( cd "$WORK/iso" && find . -type f -not -name md5sum.txt -exec md5sum {} + > md5sum.txt )

echo "== 5/5 Reconstruction de l'ISO (BIOS + UEFI) =="
if [ -n "$EMBED_DEB" ]; then OUTISO="$OUT/debian-13-miyukini-offline.iso"; else OUTISO="$OUT/debian-13-miyukini.iso"; fi
xorriso -as mkisofs -r -V "DEBIAN13_MIYUKINI" -J -joliet-long \
    -isohybrid-mbr "$ISOHDPFX" \
    -c isolinux/boot.cat -b isolinux/isolinux.bin \
    -no-emul-boot -boot-load-size 4 -boot-info-table \
    -eltorito-alt-boot -e boot/grub/efi.img -no-emul-boot -isohybrid-gpt-basdat \
    -o "$OUTISO" "$WORK/iso"

echo
echo "ISO générée : $OUTISO"
ls -lh "$OUTISO"
echo "Grave-la (Rufus/balenaEtcher) ou monte-la : install auto -> miyukini-toolbox déjà présent."
