# ISO Debian 13 custom — install auto + miyukini-toolbox

Construit une ISO qui **installe Debian 13 sans intervention** puis **installe
miyukini-toolbox** automatiquement. Se construit **dans un conteneur Docker**
(pas besoin de VM ni d'hyperviseur).

## Construire (depuis Windows, via Docker)
```bash
docker run --rm -v "D:/APP/TSSR/miyukini-cms:/work" -w /work debian:trixie \
  bash -c "apt-get update && apt-get install -y xorriso isolinux wget curl && bash iso/build-iso.sh"
```
→ `dist/iso/debian-13-miyukini.iso`. Grave-la (Rufus / balenaEtcher) ou monte-la.

## Ce que fait l'ISO
1. Installe Debian 13 en **automatique** (`iso/preseed.cfg` : locale FR, DHCP,
   disque entier, utilisateur `admin` sudo, serveur SSH).
2. En fin d'install (`late_command`) : ajoute le dépôt signé Miyukini et
   `apt-get install -y miyukini-toolbox`.
3. Redémarre → `miyukini-toolbox`, `tssr-postinstall`, etc. sont **déjà là**.

## Variante HORS-LIGNE (install sans Internet)
Embarque le `.deb` dans l'ISO et installe-le depuis le CD :
```bash
# dans le conteneur, passe EMBED_DEB :
EMBED_DEB=repo/apt/pool/main/miyukini-toolbox_1.0.0_all.deb bash iso/build-iso.sh
```
Puis, dans `iso/preseed.cfg`, remplace le bloc `late_command` par :
```
d-i preseed/late_command string \
  in-target sh -c 'cp /cdrom/miyukini/*.deb /tmp/' ; \
  in-target sh -c 'apt-get install -y /tmp/*.deb || (dpkg -i /tmp/*.deb; apt-get -f install -y)'
```
> Hors-ligne, les **dépendances recommandées** (nftables, fail2ban, chrony…)
> ne s'installent que si elles sont sur le média : pour un vrai hors-ligne complet,
> partir d'une ISO **DVD** (plus de paquets) plutôt que netinst.

## Auto-provisionnement au premier boot (optionnel)
Le paquet fournit le service `miyukini-firstboot`. Pour qu'une machine installée
par l'ISO se **configure seule** au 1er démarrage, ajoute à `late_command` :
```
in-target sh -c 'sed -i s/FIRSTBOOT=\"non\"/FIRSTBOOT=\"oui\"/ /etc/tssr/postinstall.conf'
```
(adapte d'abord `/etc/tssr/postinstall.conf` : hostname, clé SSH, réseau…).

## Notes
- Testé sur la recette standard Debian (hybride BIOS+UEFI) ; **à valider** sur ta
  cible (grave + boot une VM/poste de test).
- `dist/iso/` est git-ignoré (artefact).
