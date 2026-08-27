/* TP 1.9.1 + 1.9.2 — Sécuriser SSH : changer le port, puis passer aux clés.
   Les deux supports forment une seule progression sur la même machine : on
   déplace le port, puis on remplace le mot de passe par une paire de clés.
   Les repères insistent sur ce qui échoue en silence — les permissions de
   ~/.ssh et le format de la clé publique exportée par PuTTYgen.
   Usage : BASE=... ADMIN_PW=... tsx scripts/seed-tp-ssh-securisation.ts */
import { block, note, sh, flow, table, styleLinux, publier } from './_cours-linux';
import type { PageBlock } from '../client/src/lib/page-blocks';

const PAGE = {
  slug: 'tp-ssh-securisation',
  title: 'TP — Sécuriser SSH : port et clés',
  excerpt: 'Déplacer le port d’écoute du serveur SSH, puis remplacer le mot de passe par une paire de clés générée sous Windows avec PuTTYgen. Avec les deux échecs silencieux du TP — les permissions de ~/.ssh et le format de la clé publique — et la règle qui évite de s’enfermer dehors.',
};

const blocks: PageBlock[] = [
  block('hero', {
    eyebrow: 'TP · Linux',
    title: 'Sécuriser SSH : port et clés',
    subtitle: 'Deux crans de sécurité sur le serveur — sans jamais perdre la main.',
  }),
  styleLinux,

  note('blue', '🎯 Objectifs', '<p>Comprendre le fonctionnement des clés asymétriques, et utiliser SSH de façon plus sûre.</p><p><strong>Matériel :</strong> une machine Linux et une machine cliente Windows (la machine physique convient). Avant de commencer, vérifier que <strong>les deux communiquent</strong> et que la Debian a accès à internet.</p><p><strong>Prérequis :</strong> le serveur SSH est installé et fonctionne — voir <a href="/pages/linux-ssh">le cours SSH</a>.</p>'),

  note('red', '🚫 Le rappel liminaire : ne pas confondre SSH, ssh et sshd', '<ul><li><strong>SSH</strong> est le <strong>protocole</strong>.</li><li><strong><code>ssh</code></strong> est le programme <strong>client</strong>, celui qui se connecte ailleurs.</li><li><strong><code>sshd</code></strong> est le <strong>démon serveur</strong>, celui qui écoute — par défaut sur le port 22.</li></ul><p>Pourquoi cette distinction ? <strong>Pour les fichiers de configuration :</strong></p><table class="lx-t"><thead><tr><th>Fichier</th><th>Configure</th></tr></thead><tbody><tr><td><code>/etc/ssh/<strong>ssh</strong>_config</code></td><td>Le <strong>client</strong>. On y touche rarement.</td></tr><tr><td><code>/etc/ssh/<strong>sshd</strong>_config</code></td><td>Le <strong>serveur</strong>. <strong>C’est celui-ci</strong> qu’on modifie ici.</td></tr></tbody></table><p>Un <code>d</code> de différence. Éditer le mauvais ne déclenche aucune erreur — simplement aucun effet.</p>'),

  block('heading', { level: 2, text: '1.9.1 — Changer le port d’écoute' }),
  block('html', { html: '<p>Manipulations sur la machine Linux principale.</p><ul><li>Ouvrir <code>/etc/ssh/sshd_config</code> pour l’éditer.</li><li>La ligne <code>Port 22</code> indique le port d’écoute. <strong>La remplacer par <code>Port 22320</code>.</strong></li><li>Relancer le service pour que la modification soit prise en compte, <strong>en tant qu’administrateur</strong>.</li><li>Vérifier avec un <code>status</code>, et <strong>lire les journaux à la fin</strong> : une ligne indique le port écouté.</li><li>Depuis la machine cliente, se connecter en précisant le port — dans PuTTY ou MobaXterm par le champ prévu, en ligne de commande par <code>-p</code>.</li></ul>' }),
  sh(`sudo nano /etc/ssh/sshd_config
sudo systemctl restart sshd
sudo systemctl status sshd            # sans sudo, on ne voit PAS les logs

ssh [login]@[ip] -p 22320             # depuis le client`),

  block('heading', { level: 2, text: '1.9.2 — Passer aux clés asymétriques' }),
  block('html', { html: '<p>C’est la machine <strong>cliente</strong> qui génère les clés, et qui envoie ensuite <strong>la clé publique</strong> au serveur.</p>' }),
  block('html', { html: '<p><strong>Générer les clés</strong> — avec <em>PuTTYgen</em>, installé en même temps que PuTTY :</p><ol><li>Lancer PuTTYgen, cliquer <strong>Generate</strong>.</li><li><strong>Bouger la souris rapidement</strong> dans la fenêtre pour faire avancer la barre : le programme y puise du hasard.</li><li>Saisir une <strong>passphrase</strong> — elle sera demandée à chaque connexion. En choisir une dont on se souviendra.</li><li><strong>Save public key</strong>, puis <strong>Save private key</strong> avec l’extension <code>.ppk</code>. Des noms parlants.</li></ol>' }),
  block('html', { html: '<p><strong>Envoyer la clé publique au serveur</strong> — sans fermer PuTTYgen :</p><ol><li>Ouvrir PuTTY et se connecter au serveur <strong>en SSH classique, par mot de passe</strong>.</li><li>Se placer dans son dossier personnel <code>~</code>.</li><li>Y créer un dossier caché <code>.ssh</code>. <strong>⚠️ Sans <code>sudo</code></strong>, sinon on n’en est pas propriétaire.</li><li>Dedans, créer le fichier <code>authorized_keys</code>.</li><li>Retourner sur PuTTYgen, <strong>sélectionner la clé publique affichée dans le cadre</strong> — elle commence par <code>ssh-rsa</code> — et la copier.</li><li>Dans PuTTY, <strong>clic droit</strong> pour coller. Toute la clé tient sur <strong>une seule ligne</strong>. Enregistrer.</li></ol>' }),
  block('html', { html: '<p><strong>Se connecter avec les clés :</strong></p><ol><li>Rouvrir PuTTY. <strong>Connection → SSH → Auth → Credentials</strong>, puis <strong>Browse</strong> vers le fichier <code>.ppk</code>.</li><li>Revenir sur <strong>Session</strong> : adresse IP du serveur <strong>et port SSH</strong>.</li><li>Donner un nom dans <strong>Save</strong> et cliquer <strong>Save</strong> — cela enregistre tous les paramètres.</li><li><strong>Open</strong>. On demande le nom d’utilisateur, puis <strong>la passphrase</strong> — et non plus le mot de passe du compte.</li></ol>' }),

  block('heading', { level: 2, text: 'Pour aller plus loin' }),
  block('html', { html: '<p>Retourner dans <code>sshd_config</code> et <strong>le lire</strong> : les commentaires explicatifs, et les lignes actives qui sont commentées. Chercher à quoi servent ces options, repérer celles qui paraissent utiles, et les tester.</p><p>Le changement de port n’est pas le seul moyen de sécuriser un serveur SSH — et beaucoup de ces moyens ne sont que des options de ce fichier.</p>' }),

  note('yellow', '⏸️ Fais le TP d’abord', '<p>Ce qui suit explique les deux échecs silencieux du TP. Les lire avant, c’est se priver de les rencontrer — et ce sont eux qu’on retient.</p>'),

  block('heading', { level: 2, text: 'Repères — la règle qui prime sur tout' }),
  note('red', '🚫 Garde toujours une session ouverte', '<p>Tout ce TP consiste à modifier <strong>le moyen d’accès à la machine, depuis cette machine</strong>. Une erreur, et l’on est dehors.</p><p><strong>La méthode, à chaque étape :</strong></p><ol><li>Faire la modification dans la session déjà ouverte.</li><li>Relancer le service.</li><li><strong>Ouvrir une seconde session</strong> pour tester — <strong>sans fermer la première</strong>.</li><li>Si la seconde fonctionne, alors seulement fermer la première.</li></ol><p>Si la seconde échoue, la première est encore là pour revenir en arrière. Sans elle, il faut la console de l’hyperviseur.</p>'),
  sh(`# Verifier la syntaxe AVANT de relancer le service : ca ne coute rien
sudo sshd -t                  # silence = tout va bien
sudo sshd -T | grep -i port   # ce que la configuration declare vraiment`),

  block('heading', { level: 2, text: 'Repères — le changement de port' }),
  table(['Vérification', 'Commande', 'Ce qu’on attend'], [
    ['Le service tourne', '<code>sudo systemctl status ssh</code>', '<code>active (running)</code> et, dans les journaux, <code>Server listening on 0.0.0.0 port 22320</code>'],
    ['Il écoute vraiment là', '<code>sudo ss -tlnp | grep ssh</code>', 'La ligne montre <code>:22320</code> — c’est la preuve la plus directe'],
    ['La configuration est valide', '<code>sudo sshd -t</code>', 'Aucune sortie'],
    ['Le client passe', '<code>ssh jean@ip -p 22320</code>', 'La bannière habituelle'],
  ]),
  note('gray', '💡 <code>ssh</code> ou <code>sshd</code> dans le <code>systemctl</code> ?', '<p>Sur Debian, l’unité s’appelle <strong><code>ssh.service</code></strong> ; <code>sshd.service</code> n’en est qu’un alias, ce qui fait que les deux commandes fonctionnent. Sur Red Hat et dérivés, c’est bien <code>sshd</code>. En cas de doute : <code>systemctl list-units \'*ssh*\'</code>.</p>'),
  note('yellow', '⚠️ Trois choses qui font échouer le changement de port', '<ul><li><strong>Le pare-feu.</strong> Si <code>ufw</code> est actif, il autorise le 22 et pas le 22320. <code>sudo ufw allow 22320/tcp</code>. C’est la cause n°1.</li><li><strong>Un port déjà occupé.</strong> Prendre au-dessus de 1024 et vérifier : <code>sudo ss -tlnp | grep 22320</code>.</li><li><strong>L’activation par socket.</strong> Sur les systèmes récents, <code>ssh.socket</code> peut fixer le port à la place de <code>sshd_config</code> — la ligne <code>Port</code> est alors <strong>sans effet</strong>. Symptôme : le service redémarre sans erreur et continue d’écouter sur 22. Vérifier avec <code>systemctl list-units \'*ssh*\'</code>.</li></ul>'),
  note('blue', '💡 Ce que le changement de port apporte — et ce qu’il n’apporte pas', '<p>Il ne rend pas le serveur inviolable : un balayage de ports le retrouve en quelques secondes. Ce qu’il fait, et qui compte, c’est <strong>faire disparaître le bruit de fond</strong> — les milliers de tentatives automatiques quotidiennes sur le port 22. Les journaux redeviennent lisibles, et une vraie tentative se voit.</p><p>C’est une mesure d’<em>hygiène</em>, pas une protection. La protection, c’est l’étape suivante.</p>'),

  block('heading', { level: 2, text: 'Repères — les deux échecs silencieux des clés' }),

  note('red', '🚫 1. Les permissions de <code>~/.ssh</code> — la première cause, et elle ne dit rien', '<p>Si <code>~/.ssh</code> ou <code>authorized_keys</code> sont accessibles à d’autres que leur propriétaire, <strong><code>sshd</code> ignore la clé</strong> et redemande le mot de passe. <strong>Aucun message côté client.</strong> Rien qui ressemble à une erreur — on croit s’être trompé de clé.</p><table class="lx-t"><thead><tr><th>Élément</th><th>Droits exigés</th><th>Propriétaire</th></tr></thead><tbody><tr><td><code>~</code> (le dossier personnel)</td><td>Pas d’écriture pour groupe ni autres — <code>755</code></td><td>l’utilisateur</td></tr><tr><td><code>~/.ssh</code></td><td><strong>700</strong></td><td>l’utilisateur</td></tr><tr><td><code>~/.ssh/authorized_keys</code></td><td><strong>600</strong></td><td>l’utilisateur</td></tr></tbody></table><p>C’est exactement pourquoi le support prévient : <strong>ne pas créer le dossier avec <code>sudo</code></strong>. Fait avec <code>sudo</code>, il appartient à root, et son propre propriétaire ne peut plus rien y lire.</p>'),
  sh(`# Reparer si le dossier a ete cree avec sudo
sudo chown -R morgane:morgane /home/morgane/.ssh
chmod 700 /home/morgane/.ssh
chmod 600 /home/morgane/.ssh/authorized_keys
ls -al /home/morgane/.ssh          # verifier

# LA commande qui donne la reponse, cote serveur, pendant qu'on essaie :
sudo journalctl -u ssh -f
#   « Authentication refused: bad ownership or modes for directory ... »`),

  note('red', '🚫 2. Le format de la clé publique — le fichier enregistré ne marche pas', '<p>Le fichier produit par <strong>Save public key</strong> est au format <em>RFC 4716</em> : plusieurs lignes, encadrées par <code>---- BEGIN SSH2 PUBLIC KEY ----</code>. <strong>OpenSSH ne le comprend pas.</strong> Collé dans <code>authorized_keys</code>, il est ignoré — sans explication.</p><p>Ce qu’il faut est le contenu du <strong>cadre en haut de PuTTYgen</strong>, intitulé « <em>Public key for pasting into OpenSSH authorized_keys file</em> » : <strong>une seule ligne</strong>, commençant par <code>ssh-rsa</code> ou <code>ssh-ed25519</code>.</p><p>C’est pour cela que le support demande de copier <strong>depuis la fenêtre</strong>, et non depuis le fichier. Le fichier <code>.ppk</code> de la clé privée, lui, est également propre à PuTTY : pour l’utiliser avec la commande <code>ssh</code>, il faut le convertir (PuTTYgen → <em>Conversions → Export OpenSSH key</em>).</p>'),
  flow(`CE QU'IL FAUT COLLER — une seule ligne :

ssh-rsa AAAAB3NzaC1yc2EAAAADAQAB...9Kd= rsa-key-20260827
   ^                                        ^
   type                                     commentaire

CE QU'IL NE FAUT PAS — le fichier « Save public key » :

---- BEGIN SSH2 PUBLIC KEY ----
Comment: "rsa-key-20260827"
AAAAB3NzaC1yc2EAAAADAQAB...
---- END SSH2 PUBLIC KEY ----`),

  block('heading', { level: 2, text: 'Repères — la même chose en deux commandes' }),
  block('html', { html: '<p>Depuis un client Linux, macOS ou un Windows récent, tout le parcours PuTTYgen tient en deux commandes. Le résultat sur le serveur est <strong>identique</strong> — même fichier, même contenu.</p>' }),
  sh(`ssh-keygen -t ed25519                    # generer la paire (~/.ssh/)
ssh-copy-id -p 22320 morgane@192.168.15.70   # envoyer la cle publique
ssh -p 22320 morgane@192.168.15.70           # se connecter`),
  note('green', '🎯 <code>ssh-copy-id</code> fait tout ce que le TP fait à la main', '<p>Il crée <code>~/.ssh</code>, y ajoute <code>authorized_keys</code>, colle la clé <strong>au bon format</strong> et <strong>pose les bonnes permissions</strong>. Les deux pièges ci-dessus disparaissent d’eux-mêmes.</p><p>Faire la manipulation à la main une fois reste utile : c’est ce qui permet de <strong>réparer</strong> quand ça ne marche pas. Mais en production, c’est <code>ssh-copy-id</code>.</p>'),

  block('heading', { level: 2, text: 'Repères — « pour aller plus loin » dans sshd_config' }),
  sh(`PermitRootLogin no             # root ne se connecte JAMAIS directement
PasswordAuthentication no      # seules les cles — APRES avoir teste les cles
PubkeyAuthentication yes       # (deja le defaut)
AllowUsers morgane jean        # liste blanche de comptes
MaxAuthTries 3                 # 3 essais, puis la connexion est coupee
LoginGraceTime 30              # 30 s pour s'authentifier, sinon dehors
PermitEmptyPasswords no        # (deja le defaut, mais on l'ecrit)
X11Forwarding no               # inutile sur un serveur`),
  table(['Option', 'Ce qu’elle empêche', 'Gain'], [
    ['<code>PermitRootLogin no</code>', 'Les attaques qui visent directement <code>root</code> — soit la quasi-totalité des tentatives automatiques.', '<strong>Élevé</strong>, et sans inconvénient : on passe par son compte puis <code>sudo</code>.'],
    ['<code>PasswordAuthentication no</code>', 'Toute attaque par force brute, par construction.', '<strong>Le plus élevé de la liste.</strong>'],
    ['<code>AllowUsers</code>', 'La connexion de tout compte non listé, y compris les comptes de service.', 'Élevé sur une machine à plusieurs comptes.'],
    ['<code>MaxAuthTries</code>', 'Les essais en rafale dans une même connexion.', 'Modéré — ralentit sans bloquer.'],
    ['Changer le port', 'Rien, en réalité.', 'Faible en sécurité, <strong>élevé en lisibilité des journaux</strong>.'],
  ]),
  note('green', '🎯 Le vrai classement', '<p>Si l’on ne devait retenir qu’une mesure : <strong><code>PasswordAuthentication no</code></strong>. Une attaque par force brute contre un serveur qui n’accepte que les clés n’a aucune chance — il n’y a plus rien à deviner.</p><p>Tout le reste est utile, mais secondaire. Et cette mesure n’est possible <em>qu’après</em> avoir fait fonctionner les clés : c’est l’ordre exact de ce TP.</p>'),
  note('blue', '💡 Pour aller plus loin encore : <code>fail2ban</code>', '<p><code>sudo apt install fail2ban</code> — il lit les journaux et bannit une adresse au bout de N échecs. C’est la mesure qui complète bien les précédentes sur un serveur exposé à internet.</p>'),

  note('green', '🔗 Les pages qui vont avec', '<p><a href="/pages/linux-ssh">Cours SSH serveur</a> — clients Windows, empreinte de première connexion, lecture des journaux, et le détail du chiffrement symétrique/asymétrique · <a href="/pages/linux-droits">Utilisateurs, droits et sudo</a> · <a href="/pages/tp-config-reseau-statique">TP : IP statique</a></p>'),
];

publier(PAGE, blocks).catch(e => { console.error(e); process.exit(1); });
