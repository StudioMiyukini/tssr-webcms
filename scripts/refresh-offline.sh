#!/usr/bin/env bash
# refresh-offline.sh — aligne le miroir OFFLINE (VM de salle) sur la prod.
#
# À lancer SUR la VM offline (dans /opt/tssr), quand elle a Internet :
#     bash scripts/refresh-offline.sh
#
# Enchaîne : récupération du code (main) -> build du front -> pull du contenu
# depuis la prod -> redémarrage -> vérification locale.
#
# Le pull de contenu a besoin de ses variables (WEBCMS_CONTENU_URL / TOKEN /
# USER / PASSWORD). Si elles ne sont pas déjà dans l'environnement, mets-les
# dans /opt/tssr/.offline.env (il sera chargé automatiquement).
set -uo pipefail

APP="${TSSR_DIR:-/opt/tssr}"
PORT="${TSSR_PORT:-3460}"
cd "$APP" || { echo "Dossier introuvable : $APP (fixe TSSR_DIR=...)"; exit 1; }

# Variables du pull de contenu, si fournies dans un fichier d'environnement.
[ -f "$APP/.offline.env" ] && { set -a; . "$APP/.offline.env"; set +a; echo "Env chargé depuis .offline.env"; }

etape() { echo; echo "== $1 =="; }

etape "1/5 Mise à jour du code (main)"
git checkout main && git pull --ff-only || { echo "git pull a échoué"; exit 1; }

etape "2/5 Dépendances"
npm ci 2>/dev/null || npm install

etape "3/5 Build du front (dist/client : îlots + scripts)"
npm run build || { echo "build échoué"; exit 1; }

etape "4/5 Pull du contenu depuis la prod"
if ! node scripts/pull-content.mjs; then
    echo "⚠ Pull du contenu échoué — vérifie WEBCMS_CONTENU_URL/TOKEN (ou .offline.env)."
fi

etape "5/5 Redémarrage + vérification"
pm2 restart tssr 2>/dev/null || pm2 restart all 2>/dev/null || echo "(pm2 non trouvé — redémarre le service manuellement)"
sleep 1
for p in pages/outil-boite-debian pages/zabbix-supervision pages/cloud-aws tssr-toolbox.sh spa-install.sh; do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$PORT/$p")"
    printf '  %-32s -> %s\n' "$p" "$code"
done
echo
echo "Terminé. Si les pages répondent 200, le miroir est aligné sur la prod."
