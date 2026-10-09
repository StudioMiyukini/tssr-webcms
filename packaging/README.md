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

## Dépôt en ligne (`apt install miyukini-toolbox`)
Pour installer **par le nom** depuis Internet, héberge un dépôt signé :
```bash
# 1) une clé de signature (une seule fois) :
gpg --quick-generate-key "Miyukini Packages <miyukini@gmail.com>" rsa4096 sign never
# 2) construire les dépôts APT + RPM signés :
bash packaging/build-packages.sh
GPG_KEY="miyukini@gmail.com" bash packaging/build-repo.sh      # -> ./repo/{apt,rpm}
# 3) publier : copier ./repo/ à la racine du projet SUR LA PROD, puis redémarrer le CMS :
#    …/miyukini-cms/repo/{apt,rpm}   +   pm2 restart tssr
```
Le CMS sert alors `https://tssr.miyukini.com/apt` et `/rpm` (montage dédié, hors
`dist/client`, donc épargné par `vite build`). Côté client : voir la sortie de
`build-repo.sh` (ajout de la source + clé, puis `apt/dnf install miyukini-toolbox`).

> **Signer aussi les .rpm** (pour `gpgcheck=1`) : ajoute dans `nfpm.yaml` une section
> `rpm: { signature: { key_file: <clé> } }` (et `deb: { signature: {...} }` pour signer le .deb),
> ou signe après coup avec `rpm --addsign`. Par défaut on signe la **métadonnée** du dépôt
> (`repomd.xml` / `InRelease`), ce qui authentifie déjà l'origine.

## Diffusion hors ligne
- Copier le `.deb`/`.rpm` sur une **clé USB** ou le **partage CIFS** de la salle, puis `apt/dnf install ./…`.
- Ou monter un **dépôt APT/RPM local** (clé USB / partage) et l'ajouter en source `file://`.
- Ou **embarquer le paquet dans l'ISO custom** (étage suivant : `live-build` ou preseed + `late_command`).
