# Installation du CMS sur un serveur Linux

`install-webcms.sh` installe le site, ses dépendances et son service sur une
machine **Debian/Ubuntu** ou **RHEL/Rocky/AlmaLinux**, en posant les questions
nécessaires et en vérifiant chaque étape avant de passer à la suivante.

## Prérequis

- Un serveur Debian 12+, Ubuntu 22.04+, ou Rocky/Alma/RHEL 9+
- Un accès `root` (ou `sudo`)
- Un accès réseau sortant (dépôts de paquets et npm)
- ~2 Go libres sur `/opt`

## En une commande

```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/StudioMiyukini/tssr-webcms/main/deploy/linux/install-webcms.sh)"
```

**Ne pas ecrire `curl … | sudo bash`** : sous cette forme, l entree standard de
bash porte le texte du script, et le premier `read` y consomme le reste — le
script s arrete en plein milieu, sans message. Avec `-c`, le script arrive par
un argument et l entree standard reste le clavier.

Le script se rattrape neanmoins : s il detecte une entree non interactive, il
reprend le clavier sur `/dev/tty`, et bascule en mode non interactif si meme
cela est impossible.

Sur une machine de production, preferer les deux commandes — telecharger, lire,
puis executer :

```bash
curl -fsSL https://raw.githubusercontent.com/StudioMiyukini/tssr-webcms/main/deploy/linux/install-webcms.sh -o install-webcms.sh
less install-webcms.sh
sudo bash install-webcms.sh --dry-run
sudo bash install-webcms.sh
```

## Utilisation

```bash
sudo ./install-webcms.sh                # interactif — le cas normal
sudo ./install-webcms.sh --dry-run      # montre ce qui serait fait, sans agir
sudo ./install-webcms.sh --verifier     # contrôle une installation existante
sudo ./install-webcms.sh --help
```

### Sans interaction (automatisation)

Toutes les réponses peuvent être fournies par l'environnement :

```bash
sudo WEBCMS_DOMAINE=tssr.exemple.fr \
     WEBCMS_ADMIN_PASSWORD='…' \
     WEBCMS_SOURCE_GIT=https://github.com/StudioMiyukini/tssr-webcms.git \
     WEBCMS_AVEC_NGINX=o WEBCMS_AVEC_TLS=o WEBCMS_COURRIEL_TLS=admin@exemple.fr \
     WEBCMS_OUVRIR_PAREFEU=o \
     ./install-webcms.sh --non-interactif
```

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `WEBCMS_DOMAINE` | *(vide)* | Domaine public → `PUBLIC_BASE_URL` |
| `WEBCMS_PORT` | `3470` | Port d'écoute interne |
| `WEBCMS_DOSSIER` | `/opt/webcms` | Dossier d'installation |
| `WEBCMS_UTILISATEUR` | `webcms` | Compte système du service |
| `WEBCMS_ADMIN_USER` | `admin` | Identifiant d'administration |
| `WEBCMS_ADMIN_PASSWORD` | *(généré)* | Mot de passe d'administration |
| `WEBCMS_SOURCE_GIT` | *(vide)* | Dépôt à cloner |
| `WEBCMS_SOURCE_ARCHIVE` | *(vide)* | Ou archive `.tar.gz` locale |
| `WEBCMS_AVEC_NGINX` | `o` | Proxy inverse nginx |
| `WEBCMS_AVEC_TLS` | `o` | Certificat Let's Encrypt |
| `WEBCMS_COURRIEL_TLS` | *(vide)* | Contact Let's Encrypt |
| `WEBCMS_OUVRIR_PAREFEU` | `o` | Ouvrir ufw ou firewalld |

## Ce que le script installe

| Étape | Debian / Ubuntu | RHEL / Rocky / Alma |
| --- | --- | --- |
| Outils de base | `apt-get` : git, curl, build-essential, python3, openssl | `dnf` : git, curl, gcc-c++, make, python3, openssl |
| Node.js ≥ 20 | Paquet de la distribution si assez récent, sinon NodeSource | Module `nodejs:22`, sinon NodeSource |
| Compte système | `webcms`, sans shell de connexion | idem |
| Application | `npm ci` puis `npm run build` | idem |
| Service | `webcms.service` (systemd, confiné) | idem |
| Proxy | nginx, `sites-available` + lien | nginx, `conf.d/` |
| Pare-feu | `ufw` | `firewall-cmd` |
| SELinux | — | `httpd_can_network_connect` |

## Les verrous

Chaque étape se termine par une vérification. En cas d'échec, le script
**s'arrête** en indiquant le motif et la commande de diagnostic, plutôt que de
poursuivre sur une base fausse.

- exécution en root, distribution reconnue, systemd présent, DNS fonctionnel
- Node ≥ 20 réellement installé
- `package.json` présent après récupération des sources
- fichier d'environnement écrit **en 640**
- `node_modules/tsx` présent, `better-sqlite3` compilé
- `dist/` construit
- unité systemd écrite, service **actif**, démarrage automatique armé
- **HTTP 200** sur `127.0.0.1:<port>`
- `nginx -t` valide, nginx actif, relais fonctionnel

## Après l'installation

```bash
systemctl status webcms          # état
journalctl -u webcms -f          # journal en direct
systemctl restart webcms         # après modification de l'environnement
```

La configuration vit dans `/etc/webcms/webcms.env` (root:webcms, 640).
Toute modification demande un `systemctl restart webcms`.

### Sauvegarde

Tout le contenu du site tient dans deux emplacements :

```bash
/opt/webcms/cms.sqlite      # pages, articles, réglages, comptes
/opt/webcms/uploads/        # images et fichiers déposés
```

Sauvegarde à chaud correcte (le CMS est en WAL, une simple copie peut être
incohérente) :

```bash
sudo -u webcms sqlite3 /opt/webcms/cms.sqlite ".backup '/var/backups/cms-$(date +%F).sqlite'"
sudo tar -czf /var/backups/uploads-$(date +%F).tar.gz -C /opt/webcms uploads
```

## Points d'attention

- **`PUBLIC_BASE_URL`** — sans domaine renseigné, le site s'annonce comme
  `example.com` dans ses balises de partage (`og:url`, `og:image`). Le script
  le signale et la variable se corrige à tout moment dans
  `/etc/webcms/webcms.env`.
- **Le mot de passe d'administration** n'est affiché qu'à la fin de
  l'installation. Il est ensuite stocké en clair dans le fichier
  d'environnement, lisible par root seulement.
- **`npm ci` installe aussi les dépendances de développement**, et c'est
  voulu : `tsx` exécute le serveur et `vite` construit le front. Un
  `--omit=dev` empêcherait le démarrage.
- **Sur RHEL/Rocky**, si nginx renvoie `502` avec un `Permission denied` dans
  son journal, c'est SELinux : `sudo setsebool -P httpd_can_network_connect on`
  (le script le fait, mais pas si SELinux a été activé après coup).

## Désinstallation

```bash
sudo systemctl disable --now webcms
sudo rm -f /etc/systemd/system/webcms.service && sudo systemctl daemon-reload
sudo rm -rf /opt/webcms /etc/webcms
sudo userdel webcms
```

## Limite connue

Le script a été **vérifié syntaxiquement** (`bash -n`) et ses garde-fous
d'entrée testés, mais il n'a **pas été exécuté de bout en bout** sur une
Debian ni sur une Rocky. Le passer d'abord avec `--dry-run`, puis sur une
machine jetable.
