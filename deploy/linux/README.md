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

**N'écris pas `curl … | sudo bash`** : sous cette forme, l'entrée standard de
bash porte le *texte du script*, et le premier `read` y consomme le reste — le
script s'arrête en plein milieu, sans message. Avec `-c`, le script arrive par
un **argument** et l'entrée standard reste le clavier.

Le script se rattrape néanmoins : s'il détecte une entrée non interactive, il
reprend le clavier sur `/dev/tty`, et bascule en mode non interactif si même
cela est impossible.

Sur une machine de production, préférer les deux commandes — télécharger, lire,
puis exécuter :

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

## Le contenu du site

Le dépôt Git porte l'**application**, pas le **contenu** : `cms.sqlite` est
exclu du versionnement. Sans cette étape, on obtient un CMS vide.

Trois sources possibles, demandées pendant l'installation :

| Réponse | Ce qui se passe |
| --- | --- |
| `site` *(défaut)* | Se connecte à un site existant, récupère son export (base + médias) via `/api/admin/export` et l'installe. |
| `archive` | Prend un export `.zip` déjà produit — chemin local ou URL. |
| `vide` | Installe un site vierge. |

```bash
sudo WEBCMS_CONTENU=site      WEBCMS_CONTENU_URL=https://tssr.miyukini.com      WEBCMS_CONTENU_USER=admin      WEBCMS_CONTENU_PASSWORD='…'      bash install-webcms.sh
```

Pour produire une archive depuis une instance existante : `npm run export`
(fichier dans `export/`), ou le bouton d'export de l'administration.

### Le compte administrateur, après import

`server/db/client.ts` ne crée un administrateur **que si la table est vide**.
Après import d'une base, ce sont donc les identifiants du **site source** qui
s'appliqueraient — et le mot de passe annoncé par l'installeur ne
fonctionnerait pas.

Le script le repose donc explicitement sur le compte demandé. **Les autres
comptes de la base importée gardent le mot de passe du site source** : copier
une base, c'est copier tous ses comptes. Le script les liste à la fin ; à
revoir depuis `/admin`.

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

## Accès depuis le réseau local

Le serveur écoute déjà sur **toutes les interfaces** (`app.listen(PORT)` sans
hôte). Trois choses conditionnent l'accès depuis un autre poste du réseau.

### 1. Le pare-feu

```bash
# Rocky / RHEL
sudo firewall-cmd --add-service=http --permanent && sudo firewall-cmd --reload
# ou, sans nginx :
sudo firewall-cmd --add-port=3470/tcp --permanent && sudo firewall-cmd --reload

# Debian / Ubuntu
sudo ufw allow 80/tcp        # ou 3470/tcp sans nginx
```

### 2. nginx doit répondre à un accès par adresse IP

Une requête portant une **adresse IP** en en-tête `Host` ne correspond à aucun
`server_name` et tombe sur le **serveur par défaut** d'nginx. Le script déclare
donc son bloc en `default_server`, et désarme celui livré avec nginx sur
Rocky/RHEL (copie conservée en `/etc/nginx/nginx.conf.avant-webcms`).

Sur une installation antérieure au 27 août, à corriger à la main :

```bash
sudo sed -i 's/^    listen 80;/    listen 80 default_server;/' /etc/nginx/conf.d/webcms.conf
sudo sed -i 's/^    listen \[::\]:80;/    listen [::]:80 default_server;/' /etc/nginx/conf.d/webcms.conf
sudo cp -a /etc/nginx/nginx.conf /etc/nginx/nginx.conf.avant-webcms
sudo sed -i '/listen/ s/ default_server//g' /etc/nginx/nginx.conf
sudo nginx -t && sudo systemctl reload nginx
```

### 3. `COOKIE_SECURE` — le piège

Si HTTPS a été choisi, `COOKIE_SECURE=1` : le cookie de session **exige
HTTPS**. Un accès en HTTP simple — par adresse IP sur le réseau local —
laissera la connexion à `/admin` échouer **sans message clair** : le
formulaire accepte, puis on revient à la page de connexion.

```bash
sudo nano /etc/webcms/webcms.env    # COOKIE_SECURE=0
sudo systemctl restart webcms
```

C'est un choix : `0` autorise l'accès en HTTP, au prix de la protection du
cookie sur un réseau non chiffré. Sur un intranet maîtrisé, c'est acceptable.

### 4. Un nom plutôt qu'une adresse

```bash
sudo hostnamectl set-hostname tssr-serveur

# Sur chaque poste client, ou dans le DNS de l'intranet :
#   192.168.1.50  tssr-serveur tssr-serveur.local
```

Et pour que les liens de partage soient justes :

```bash
sudo nano /etc/webcms/webcms.env    # PUBLIC_BASE_URL=http://tssr-serveur
sudo systemctl restart webcms
```

### Vérifier

```bash
ip -4 -o addr show scope global | awk '{print $4}'   # l'adresse du serveur
curl -I http://<adresse-ip>/                         # depuis un autre poste
sudo firewall-cmd --list-all                         # ou : sudo ufw status
```

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

## Où installer

**`/opt/webcms` (le défaut) ou `/srv/webcms`.** Pas `/home`.

L'unité systemd générée porte `ProtectHome=true`, qui rend `/home` inaccessible
au service. Une installation sous `/home` réussit puis le service refuse de
démarrer. Le script prévient, demande confirmation et adapte l'unité si l'on
insiste — mais `/opt` reste le bon emplacement pour une application de service,
et il évite aussi les questions de contexte SELinux propres aux dossiers
personnels.

Si le compte de service existe déjà d'une installation précédente avec une
autre maison, le script la réaligne : `npm` et le service écrivent dans `HOME`,
et une maison périmée produit des erreurs qui ne désignent pas leur cause.

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
- **Les opérations git tournent sous le compte propriétaire.** Depuis git
  2.35.2, git refuse d'opérer sur un dépôt appartenant à quelqu'un d'autre —
  « propriétaire douteux détecté ». Cloner en root puis `chown` produisait
  exactement ce cas à la relance. Et la commande que git propose alors,
  `git config --global --add safe.directory …`, **n'a d'effet que pour le
  compte qui la tape** : ici c'est root qui agit, il faudrait donc `sudo git
  config …`. Le script n'en a plus besoin.
- **`npm ci` s'exécute depuis le dossier**, pas via `--prefix` : npm cherche le
  fichier de verrouillage dans le répertoire *courant*, et `--prefix` produit
  un « can only install with an existing package-lock.json » trompeur alors que
  le fichier est bien là.
- **Sur RHEL/Rocky**, si nginx renvoie `502` avec un `Permission denied` dans
  son journal, c'est SELinux : `sudo setsebool -P httpd_can_network_connect on`
  (le script le fait, mais pas si SELinux a été activé après coup).

## Repartir de zéro

Si une installation s'est interrompue et que l'on préfère recommencer proprement
plutôt que de reprendre en place :

```bash
sudo systemctl disable --now webcms 2>/dev/null
sudo rm -rf /opt/webcms
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/StudioMiyukini/tssr-webcms/main/deploy/linux/install-webcms.sh)"
```

Rien n'est perdu : le contenu vient de l'export, pas du dossier.

## Désinstallation

```bash
sudo systemctl disable --now webcms
sudo rm -f /etc/systemd/system/webcms.service && sudo systemctl daemon-reload
sudo rm -rf /opt/webcms /etc/webcms
sudo userdel webcms
```

## Tests

```bash
bash deploy/linux/test-questions.sh
```

Vérifie le mécanisme des questions sur le **script réel** — les fonctions sont
extraites du fichier, pas recopiées : un test qui teste une copie ne teste rien.

Couvre : la saisie prise en compte, la valeur par défaut sur Entrée, la priorité
des variables `WEBCMS_*`, le mode non interactif, les questions oui/non, le
dépôt proposé par défaut — et une **non-régression** sur le défaut du 27 août,
où les variables pré-remplies en tête du script empêchaient les questions
d'être posées.

## Limite connue

Le script a été **vérifié syntaxiquement** (`bash -n`) et ses garde-fous
d'entrée testés, mais il n'a **pas été exécuté de bout en bout** sur une
Debian ni sur une Rocky. Le passer d'abord avec `--dry-run`, puis sur une
machine jetable.
