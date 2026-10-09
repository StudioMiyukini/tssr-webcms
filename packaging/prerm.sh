#!/bin/sh
# Avant suppression du paquet : désactiver le service premier boot.
set -e
systemctl disable miyukini-firstboot.service 2>/dev/null || true
exit 0
