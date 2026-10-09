# Packaging — miyukini-toolbox (.deb & .rpm)

Un seul code source (distro-aware), **deux formats** générés par **[nfpm](https://nfpm.goreleaser.com)** :
`.deb` (Debian/Ubuntu) et `.rpm` (RHEL/Rocky/Alma).

## Construire
```bash
bash packaging/build-packages.sh
# -> dist/packages/miyukini-toolbox_1.0.0_all.deb
#    dist/packages/miyukini-toolbox-1.0.0-1.noarch.rpm
```
nfpm est un binaire Go autonome (ni `dpkg-deb` ni `rpmbuild` requis).

## Installer
```bash
# Debian / Ubuntu (résout les deps depuis le média d'install, même hors ligne) :
sudo apt install ./dist/packages/miyukini-toolbox_*_all.deb
# RHEL / Rocky / Alma :
sudo dnf install ./dist/packages/miyukini-toolbox-*.noarch.rpm
```

## Ce que ça pose
| Chemin | Rôle |
|---|---|
| `/usr/bin/miyukini-toolbox` | le menu interactif |
| `/usr/bin/tssr-postinstall` | post-installation automatique |
| `/usr/bin/spa-install`, `spa-connect`, `fw-audit`, `opnsense-harden`, `pfsense-harden` | les outils |
| `/usr/lib/miyukini-toolbox/tssr-lib.sh` | le socle (plus de `curl` de la lib) |
| `/etc/tssr/postinstall.conf` | fichier de réponses (préservé aux updates) |
| `/lib/systemd/system/miyukini-firstboot.service` | auto-run au 1er boot (si `FIRSTBOOT=oui`) |

## Premier boot automatique
Le service `miyukini-firstboot` ne fait **rien par défaut**. Il lance `tssr-postinstall`
au premier démarrage **uniquement** si `/etc/tssr/postinstall.conf` contient `FIRSTBOOT="oui"`
(sentinelle `/var/lib/miyukini/firstboot.done` pour ne s'exécuter qu'une fois).
→ idéal pour une image clonée ou une **ISO Debian 13 custom**.

## Diffusion hors ligne
- Copier le `.deb`/`.rpm` sur une **clé USB** ou le **partage CIFS** de la salle, puis `apt/dnf install ./…`.
- Ou monter un **dépôt APT/RPM local** (clé USB / partage) et l'ajouter en source `file://`.
- Ou **embarquer le paquet dans l'ISO custom** (étage suivant : `live-build` ou preseed + `late_command`).
