#!/bin/sh
# Après installation du paquet : armer (sans lancer) le service premier boot.
# Il ne fera quelque chose qu'au prochain démarrage ET si FIRSTBOOT=oui dans
# /etc/tssr/postinstall.conf — donc inoffensif sur un serveur déjà en service.
set -e
systemctl daemon-reload 2>/dev/null || true
systemctl enable miyukini-firstboot.service 2>/dev/null || true
exit 0
