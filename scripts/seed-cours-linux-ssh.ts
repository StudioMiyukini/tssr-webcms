/* Cours « SSH serveur (Linux) ». Usage : BASE=... ADMIN_PW=... tsx scripts/seed-cours-linux-ssh.ts */
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, type PageBlock } from '../client/src/lib/page-blocks';
const BASE = process.env.BASE || 'https://tssr.miyukini.com';
const PW = process.env.ADMIN_PW || 'changeme';
const PAGE = { slug: 'linux-ssh', title: 'SSH serveur sous Linux', excerpt: 'Installer et configurer OpenSSH sur un serveur Linux : service sshd, fichier sshd_config, authentification par clé (plus sûre que le mot de passe) et durcissement (désactiver root, changer le port).' };
const block = (t: Parameters<typeof makePageBlock>[0], p: Partial<PageBlock>) => Object.assign(makePageBlock(t), p);
const note = (c: string, t: string, h: string) => block('html', { html: `<aside class="pb-note pb-note-${c}"><p class="pb-note-title">${t}</p>${h}</aside>` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const styleBlock = block('html', { html: `<style>.lx-flow{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin:10px 0;white-space:pre;overflow-x:auto;font-size:12px;line-height:1.6}.lx-cmd{font-family:ui-monospace,'Space Mono',monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;overflow-x:auto;font-size:12.5px;line-height:1.55}</style>` });
const cmd = (t: string) => block('html', { html: `<div class="lx-cmd">${esc(t)}</div>` });
const flow = (t: string) => block('html', { html: `<div class="lx-flow">${esc(t)}</div>` });
const blocks: PageBlock[] = [
  block('hero', { eyebrow: 'Cours · Linux', title: PAGE.title, subtitle: 'Administrer un serveur Linux à distance, de façon chiffrée.' }),
  styleBlock,
  block('html', { html: '<p><strong>SSH</strong> (port <strong>22</strong>) chiffre la session d’administration à distance — c’est <strong>le</strong> moyen d’accéder à un serveur Linux (remplace Telnet, en clair). Le service côté serveur s’appelle <strong>sshd</strong> (OpenSSH). Rappel des commandes client : <a href="/pages/le-ssh">Le SSH</a>.</p>' }),
  block('heading', { level: 2, text: '1) Installer et démarrer le serveur' }),
  cmd(`sudo apt update
sudo apt install openssh-server
sudo systemctl enable ssh      # démarrage auto au boot
sudo systemctl status ssh      # vérifier qu'il tourne`),
  block('html', { html: '<p>Depuis un client : <code>ssh utilisateur@192.168.10.20</code>.</p>' }),
  block('heading', { level: 2, text: '2) Configurer (sshd_config)' }),

  block('heading', { level: 3, text: 'SSH, ssh, sshd : ne pas confondre' }),
  block('html', { html: '<table class="pb-table"><thead><tr><th>Écrit</th><th>Ce que c’est</th></tr></thead><tbody>' +
    '<tr><td><strong>SSH</strong></td><td>Le <strong>protocole</strong> — la convention de communication. Ni un fichier, ni un programme.</td></tr>' +
    '<tr><td><strong><code>ssh</code></strong></td><td>Le programme <strong>client</strong> : celui qu’on lance pour se connecter <em>ailleurs</em>.</td></tr>' +
    '<tr><td><strong><code>sshd</code></strong></td><td>Le <strong>démon serveur</strong> (le <em>d</em> final = <em>daemon</em>) : celui qui écoute, par défaut sur le port <strong>22</strong>.</td></tr>' +
    '</tbody></table>' }),
  note('red', '🚫 Deux fichiers de configuration, presque le même nom', '<p>C’est la confusion qui fait perdre le plus de temps :</p><table class="pb-table"><thead><tr><th>Fichier</th><th>Configure</th><th>En pratique</th></tr></thead><tbody><tr><td><code>/etc/ssh/<strong>ssh</strong>_config</code></td><td>Le <strong>client</strong></td><td>On y touche rarement.</td></tr><tr><td><code>/etc/ssh/<strong>sshd</strong>_config</code></td><td>Le <strong>serveur</strong></td><td><strong>C’est celui-ci</strong> qu’on modifie pour sécuriser la machine.</td></tr></tbody></table><p>Un <code>d</code> de différence. Éditer <code>ssh_config</code> en croyant configurer le serveur ne produit aucune erreur — simplement aucun effet.</p>'),

  block('html', { html: '<p>Le fichier de config est <code>/etc/ssh/sshd_config</code>. Après toute modification : <code>sudo systemctl restart ssh</code>. Réglages utiles :</p>' }),
  cmd(`Port 22                      # changer (ex. 2222) réduit le bruit des scans
PermitRootLogin no           # interdire la connexion directe en root
PasswordAuthentication yes   # (mettre no une fois les clés en place)
AllowUsers jean admin        # limiter aux comptes autorisés`),
  block('heading', { level: 3, text: 'Changer le port d’écoute' }),
  block('html', { html: '<p>Le port 22 est celui que balayent tous les robots d’internet. En changer ne rend pas le serveur inviolable — mais il fait disparaître l’essentiel du bruit de fond dans les journaux, ce qui rend les vraies tentatives visibles.</p>' }),
  cmd(`sudo nano /etc/ssh/sshd_config
#   Port 22        ->   Port 22320

sudo systemctl restart ssh          # relancer pour appliquer
sudo systemctl status ssh           # verifier : « Server listening on 0.0.0.0 port 22320 »`),
  note('gray', '💡 <code>ssh</code> ou <code>sshd</code> dans la commande <code>systemctl</code> ?', '<p>Sur Debian, l’unité s’appelle <strong><code>ssh.service</code></strong> ; <code>sshd.service</code> n’en est qu’un <em>alias</em>. Les deux fonctionnent donc, et les supports écrivent souvent <code>sshd</code>. Sur Red Hat et dérivés, c’est bien <code>sshd</code>. En cas de doute :</p><div class="lx-cmd">systemctl list-units \'*ssh*\'</div>'),
  note('blue', '💡 Le <code>status</code> ne montre les journaux que si l’on est administrateur', '<p><code>systemctl status ssh</code> affiche l’état pour tout le monde, mais <strong>les dernières lignes de journal ne s’affichent qu’avec <code>sudo</code></strong>. Or c’est justement là qu’on lit le port réellement écouté. Autres façons de le vérifier :</p><div class="lx-cmd">sudo ss -tlnp | grep ssh     # sur quel port le service ecoute VRAIMENT\nsudo sshd -T | grep -i port  # ce que la configuration declare, une fois lue</div>'),
  block('html', { html: '<p>Côté client, il faut désormais préciser le port — il n’est plus deviné :</p>' }),
  cmd(`ssh morgane@192.168.15.70 -p 22320     # invite de commande
ssh -p 22320 morgane@192.168.15.70     # equivalent`),
  block('html', { html: '<p>Dans <strong>PuTTY</strong> et <strong>MobaXterm</strong>, le port est un champ à côté de l’adresse — il suffit d’y écrire 22320.</p>' }),
  note('yellow', '⚠️ Trois choses qui font échouer un changement de port', '<ul><li><strong>Le pare-feu.</strong> Si <code>ufw</code> est actif, il autorise le 22, pas le 22320 : <code>sudo ufw allow 22320/tcp</code>. C’est la cause n°1.</li><li><strong>Un port déjà pris.</strong> Choisir au-dessus de 1024, et vérifier : <code>sudo ss -tlnp | grep 22320</code>.</li><li><strong>L’activation par socket.</strong> Sur les systèmes récents, <code>ssh.socket</code> peut décider du port à la place de <code>sshd_config</code> — la ligne <code>Port</code> est alors <strong>sans effet</strong>. Le symptôme est net : le service redémarre sans erreur et continue d’écouter sur 22. Vérifier avec <code>systemctl list-units \'*ssh*\'</code> ; si <code>ssh.socket</code> est actif, c’est lui qu’il faut modifier (<code>sudo systemctl edit ssh.socket</code>).</li></ul>'),
  note('red', '🚫 Garde une session ouverte pendant le test', '<p>Change le port, relance le service, puis <strong>ouvre une seconde session</strong> sur le nouveau port <em>sans fermer la première</em>. Si la nouvelle échoue, la première est encore là pour revenir en arrière.</p><p>Sans cette précaution, une erreur de port ou un pare-feu oublié laisse la machine injoignable — et il faut la console de l’hyperviseur pour s’en sortir.</p>'),

  note('yellow', '⚠️ Ne te coupe pas l’accès', '<p>Avant de mettre <code>PermitRootLogin no</code> ou de désactiver le mot de passe, <strong>vérifie que ton compte normal fonctionne</strong> (et qu’il est <code>sudo</code>). Garde une session ouverte pendant les tests.</p>'),
  block('heading', { level: 2, text: '3) Authentification par clé (recommandé)' }),

  block('heading', { level: 3, text: 'Symétrique et asymétrique : ce qui se passe vraiment' }),
  block('html', { html: '<p>Avant les manipulations, une mise au point qui évite un contresens durable. <strong>SSH utilise les deux à la fois, et depuis toujours</strong> — y compris lors d’une connexion « simple » par mot de passe.</p>' }),
  block('html', { html: '<table class="pb-table"><thead><tr><th></th><th>Symétrique</th><th>Asymétrique</th></tr></thead><tbody>' +
    '<tr><td>Les clés</td><td><strong>Une seule</strong>, la même pour chiffrer et déchiffrer.</td><td><strong>Deux</strong> : ce que l’une ferme, seule l’autre l’ouvre.</td></tr>' +
    '<tr><td>Vitesse</td><td><strong>Très rapide.</strong></td><td>Lente — de l’ordre de mille fois plus.</td></tr>' +
    '<tr><td>Le problème</td><td>Comment se mettre d’accord sur la clé sans que personne ne l’intercepte ?</td><td>Aucun secret à transmettre : la clé publique peut être criée sur les toits.</td></tr>' +
    '<tr><td>Dans SSH</td><td>Chiffre <strong>toutes les données</strong> échangées.</td><td>Sert à <strong>authentifier</strong> et à <strong>se mettre d’accord</strong> sur la clé symétrique.</td></tr>' +
    '</tbody></table>' }),
  flow(`Ce qui se passe a CHAQUE connexion, meme la plus simple :

1. Negociation        client et serveur se mettent d'accord sur une
                      CLE DE SESSION symetrique — sans jamais l'envoyer.
                      Chacun la CALCULE de son cote (Diffie-Hellman).

2. Authentification   le serveur prouve son identite avec sa cle d'hote
   DU SERVEUR         (asymetrique). C'est SA CLE PUBLIQUE dont on accepte
                      l'empreinte, et qui est rangee dans known_hosts.

3. Authentification   a ce stade seulement, le tunnel est chiffre.
   DE L'UTILISATEUR   C'est ici — et ICI SEULEMENT — que se joue le choix :
                          par MOT DE PASSE       (TP 1.4)
                          par CLE PUBLIQUE       (ce TP)

4. Les donnees        chiffrees avec la cle de session symetrique de l'etape 1.`),
  note('red', '🚫 « Connexion simple = clés symétriques » : le raccourci à corriger', '<p>On lit souvent que la connexion par mot de passe serait « symétrique » et que celle par clés serait « asymétrique ». <strong>C’est faux, et cela conduit à une erreur de raisonnement.</strong></p><p>Si l’empreinte acceptée à la première connexion était celle d’une clé <em>symétrique</em>, alors <code>known_hosts</code> contiendrait un <strong>secret partagé</strong> — et quiconque lirait ce fichier pourrait déchiffrer les communications. Ce serait une faille béante. Ce n’en est pas une : <code>known_hosts</code> ne contient que des clés <strong>publiques</strong>, qui ne déchiffrent rien. Le fichier est d’ailleurs lisible par tous, en toute tranquillité.</p><p><strong>Ce qui change entre le TP 1.4 et celui-ci, c’est uniquement l’étape 3</strong> — la façon dont <em>l’utilisateur</em> prouve qui il est. Le chiffrement des données, lui, ne change pas d’un iota.</p>'),
  note('blue', '💡 La clé de session n’est jamais transmise', '<p>C’est l’élégance du procédé, et cela vaut d’être compris : client et serveur n’<em>échangent</em> pas la clé symétrique — ils échangent des éléments publics à partir desquels <strong>chacun calcule la même clé de son côté</strong>. Un observateur qui capte tout le trafic ne peut pas la reconstituer.</p><p>C’est l’échange <strong>Diffie-Hellman</strong>. Il répond exactement à la question « comment se mettre d’accord sur un secret en public ? ».</p>'),
  note('green', '🎯 Alors pourquoi passer aux clés, si tout est déjà chiffré ?', '<p>Parce que le chiffrement protège le <em>transport</em>, pas le <em>mot de passe</em>. Un mot de passe peut être deviné, réutilisé ailleurs, écrit sur un papier, ou arraché par force brute — et les robots qui balayent le port 22 ne font que cela.</p><p>Une clé privée de 3 000 bits ne se devine pas. Et comme elle ne quitte jamais le poste client, il n’y a rien à intercepter.</p>'),

  block('html', { html: '<p>Deux chemins mènent au même résultat : celui d’OpenSSH, en deux commandes, et celui de PuTTY, en fenêtres. Le fichier obtenu sur le serveur est identique.</p>' }),

  block('heading', { level: 3, text: 'La voie OpenSSH — Linux, macOS, Windows récent' }),
  cmd(`# sur le CLIENT
ssh-keygen -t ed25519            # génère la paire (~/.ssh/)
ssh-copy-id jean@192.168.10.20   # copie la clé publique sur le serveur
ssh jean@192.168.10.20           # connexion sans mot de passe`),
  note('gray', '💡 <code>ed25519</code> plutôt que <code>rsa</code>', '<p>C’est le format recommandé aujourd’hui : clés courtes, rapides, au moins aussi sûres qu’un RSA de 3072 bits. <code>ssh-keygen</code> sans option produit encore du RSA sur les systèmes anciens — d’où le <code>-t ed25519</code> explicite.</p>'),

  block('heading', { level: 3, text: 'La voie PuTTY — depuis Windows' }),
  block('html', { html: '<p><strong>PuTTYgen</strong> est installé en même temps que PuTTY. Il remplace <code>ssh-keygen</code>.</p><ol><li>Lancer PuTTYgen, cliquer sur <strong>Generate</strong>.</li><li><strong>Bouger la souris</strong> dans la fenêtre : le programme a besoin de hasard, et il le prend dans tes mouvements. La barre avance à mesure.</li><li>Saisir une <strong>passphrase</strong> — deux fois. Elle chiffre la clé privée sur le disque.</li><li><strong>Save public key</strong> et <strong>Save private key</strong> (extension <code>.ppk</code>). Donner des noms parlants.</li></ol>' }),
  note('red', '🚫 Le piège du format : ne PAS envoyer le fichier « Save public key »', '<p>C’est l’erreur qui fait perdre une soirée. Le fichier produit par <strong>Save public key</strong> est au format <em>RFC 4716</em> : plusieurs lignes, encadrées par <code>---- BEGIN SSH2 PUBLIC KEY ----</code>. <strong>OpenSSH ne le comprend pas</strong>, et il refusera la clé sans expliquer pourquoi.</p><p>Ce qu’il faut, c’est le contenu du <strong>cadre du haut de PuTTYgen</strong>, celui intitulé « <em>Public key for pasting into OpenSSH authorized_keys file</em> » : <strong>une seule ligne</strong>, qui commence par <code>ssh-rsa</code> ou <code>ssh-ed25519</code> et se termine par un commentaire.</p><p>C’est pour cela que le support demande de <strong>copier depuis la fenêtre</strong>, et non depuis le fichier enregistré.</p>'),
  block('html', { html: '<p>Ensuite, sur le serveur — connecté en SSH classique, par mot de passe :</p>' }),
  cmd(`cd ~                          # SON dossier personnel, pas /root
mkdir .ssh                    # SANS sudo — sinon le dossier appartient a root
chmod 700 .ssh
nano .ssh/authorized_keys     # coller la cle : clic droit dans PuTTY
chmod 600 .ssh/authorized_keys`),
  note('red', '🚫 Les permissions : la première cause d’échec, et elle est silencieuse', '<p>Si <code>~/.ssh</code> ou <code>authorized_keys</code> sont accessibles à d’autres que leur propriétaire, <strong><code>sshd</code> ignore la clé purement et simplement</strong> et redemande le mot de passe. Aucun message côté client. Rien qui ressemble à une erreur.</p><table class="pb-table"><thead><tr><th>Élément</th><th>Droits exigés</th></tr></thead><tbody><tr><td>Le dossier personnel <code>~</code></td><td>Pas d’écriture pour le groupe ni les autres (<code>755</code> convient)</td></tr><tr><td><code>~/.ssh</code></td><td><strong>700</strong></td></tr><tr><td><code>~/.ssh/authorized_keys</code></td><td><strong>600</strong></td></tr></tbody></table><p>Et le propriétaire doit être <strong>l’utilisateur</strong>, pas root — d’où l’avertissement du support : <em>ne crée pas le dossier avec <code>sudo</code></em>. Si c’est déjà fait :</p><div class="lx-cmd">sudo chown -R morgane:morgane /home/morgane/.ssh\nchmod 700 /home/morgane/.ssh\nchmod 600 /home/morgane/.ssh/authorized_keys</div><p>La commande qui donne la réponse en trois secondes, côté serveur :</p><div class="lx-cmd">sudo journalctl -u ssh -f      # « Authentication refused: bad ownership or modes »</div>'),
  block('html', { html: '<p>Enfin, dans PuTTY, désigner la clé privée avant de se connecter :</p><ol><li><strong>Connection → SSH → Auth → Credentials</strong>, puis <strong>Browse</strong> vers le fichier <code>.ppk</code>.</li><li>Revenir sur <strong>Session</strong>, saisir l’adresse et <strong>le port</strong>.</li><li>Donner un nom dans <strong>Saved Sessions</strong> et cliquer <strong>Save</strong> — sans quoi tout est à ressaisir la prochaine fois.</li><li><strong>Open</strong>.</li></ol>' }),
  note('green', '🎯 Comment savoir que ça a marché', '<p>PuTTY demande le nom d’utilisateur, puis <strong>la passphrase</strong> — et non plus le mot de passe du compte.</p><p>La nuance est importante : la passphrase <strong>déverrouille la clé privée sur ton poste</strong>. Elle ne voyage pas, le serveur ne la connaît pas et ne la vérifie pas. C’est la clé qui prouve ton identité, pas elle.</p>'),
  note('blue', '💡 Ne plus la retaper : Pageant', '<p>Pageant, livré avec PuTTY, garde les clés déverrouillées en mémoire : on saisit la passphrase une fois par session Windows. Son équivalent OpenSSH est <code>ssh-agent</code> (<code>ssh-add ~/.ssh/id_ed25519</code>).</p><p>C’est ce qui rend l’authentification par clé <strong>plus commode</strong> que le mot de passe, en plus d’être plus sûre — sinon personne ne l’adopterait.</p>'),
  note('yellow', '⚠️ Le <code>.ppk</code> n’est pas un format OpenSSH', '<p>Il est propre à PuTTY. Pour utiliser la même clé avec la commande <code>ssh</code>, il faut la convertir : dans PuTTYgen, <strong>Load</strong> le <code>.ppk</code>, puis <em>Conversions → Export OpenSSH key</em>.</p>'),

  block('heading', { level: 3, text: 'Une fois que ça marche : fermer la porte' }),
  block('html', { html: '<p>Une fois les clés en place, on durcit : <code>PasswordAuthentication no</code> dans <code>sshd_config</code> → seules les clés sont acceptées.</p>' }),
  note('red', '🚫 Vérifier AVANT de désactiver le mot de passe', '<p>Ouvre une seconde session par clé, et garde la première ouverte. Tant que la connexion par clé n’a pas fonctionné <strong>au moins une fois</strong>, ne touche pas à <code>PasswordAuthentication</code> : c’est le moyen le plus rapide de se retrouver enfermé dehors.</p>'),
  block('heading', { level: 2, text: '4) Se connecter depuis Windows' }),
  block('html', { html: '<p>Trois clients, tous corrects — c’est le même protocole derrière, le choix se fait sur le confort. Un client graphique est souvent plus pratique que l’invite de commande quand on gère plusieurs serveurs.</p>' }),
  block('html', { html: '<table class="pb-table"><thead><tr><th>Client</th><th>Ce qu’il apporte</th><th>Quand le choisir</th></tr></thead><tbody>' +
    '<tr><td><strong>ssh</strong> (intégré)</td><td>Rien à installer sur les Windows récents : OpenSSH est livré avec le système. Même syntaxe que sous Linux.</td><td>Pour une connexion rapide, ou dans un script.</td></tr>' +
    '<tr><td><strong>PuTTY</strong></td><td>Une fenêtre, une adresse, un bouton. Enregistre des sessions nommées. Très léger.</td><td>Sur un poste où l’on installe peu, ou pour garder une liste de serveurs sous la main.</td></tr>' +
    '<tr><td><strong>MobaXterm</strong></td><td>Un terminal <strong>plus un panneau de transfert de fichiers</strong> qui s’ouvre tout seul à gauche. Onglets, sessions enregistrées.</td><td>Quand on administre plusieurs serveurs et qu’on déplace souvent des fichiers.</td></tr>' +
    '</tbody></table>' }),

  block('heading', { level: 3, text: 'PuTTY' }),
  block('html', { html: '<p>À télécharger sur <a href="https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html" target="_blank" rel="noopener">le site de PuTTY</a> — version <strong>64-bit x86</strong>. Puis :</p><ol><li><strong>Host Name (or IP address)</strong> : l’adresse de la Debian. <strong>Port</strong> : 22.</li><li><strong>Open</strong>.</li><li>Un avertissement s’affiche : c’est la première connexion. <strong>Accept</strong>.</li><li>Le <em>login</em> (le nom d’utilisateur Debian), puis le mot de passe.</li></ol>' }),
  note('gray', '💡 Le mot de passe ne s’affiche pas quand on le tape', '<p>Ni astérisques, ni points : rien du tout. Ce n’est pas un blocage, c’est volontaire — pour que personne ne lise la longueur par-dessus l’épaule. On tape et l’on valide.</p>'),

  block('heading', { level: 3, text: 'MobaXterm' }),
  block('html', { html: '<p>À télécharger sur <a href="https://mobaxterm.mobatek.net/download-home-edition.html" target="_blank" rel="noopener">le site de Mobatek</a> — <strong>Installer Edition</strong> (l’archive se dézippe, puis on installe). Puis :</p><ol><li><strong>Session</strong> (en haut à gauche), puis <strong>SSH</strong>.</li><li><strong>Remote host</strong> : l’adresse de la Debian. <strong>Port</strong> : 22.</li><li><strong>OK</strong>, puis <strong>Accept</strong> à l’avertissement de première connexion.</li><li>Le login, le mot de passe — et une question : faut-il l’enregistrer ?</li></ol>' }),
  note('yellow', '⚠️ « Do you want to save this password ? »', '<p>Pratique, mais le mot de passe est alors <strong>stocké sur le poste Windows</strong>. Sur ta machine de TP, pourquoi pas. Sur un poste partagé, non. Et si tu enregistres des mots de passe de serveurs réels, mets au minimum un <em>master password</em> dans MobaXterm.</p><p>La vraie réponse à cette question, c’est l’<strong>authentification par clé</strong> (section 3 ci-dessus) : plus rien à taper, et plus rien à stocker en clair.</p>'),
  block('html', { html: '<p>L’avantage de MobaXterm sur PuTTY est le panneau de gauche, qui s’ouvre automatiquement sur <strong>SFTP</strong> — le transfert de fichiers <em>par la même session SSH</em>. Il se positionne dans ton dossier personnel ; la barre d’adresse accepte un chemin direct, et le dossier fléché remonte au parent.</p>' }),
  note('red', '🚫 Le panneau SFTP sert à transférer, pas à administrer', '<p>Se promener dans l’arborescence, déposer ou récupérer un fichier : oui. <strong>Modifier, créer ou supprimer des fichiers système par ce panneau : non.</strong></p><p>La raison est concrète : le panneau agit avec <em>ton</em> compte, pas avec <code>sudo</code>. Sur les fichiers de <code>/etc</code> il échouera, et là où il réussira, il peut écraser les droits ou le propriétaire sans rien dire. Pour tout ce qui touche au système, on passe par la ligne de commande — c’est là qu’on voit ce qu’on fait et qu’on peut le vérifier.</p>'),
  note('blue', '💡 Le panneau SFTP n’ouvre rien de plus', '<p>C’est du SFTP transporté <strong>par la session SSH déjà établie</strong> : chiffré, disponible dès que le serveur SSH tourne, et toujours sur le port 22. Rien à installer côté serveur, rien de plus à ouvrir dans le pare-feu. À ne pas confondre avec le FTP, qui est un autre service, en clair, sur le port 21.</p>'),

  block('heading', { level: 3, text: 'L’invite de commande Windows' }),
  block('html', { html: '<p>Windows 10 et 11 embarquent un client OpenSSH — il s’utilise dans PowerShell, le Terminal ou <code>cmd</code>, exactement comme sous Linux. S’il manque, il s’ajoute dans <em>Paramètres → Applications → Fonctionnalités facultatives → Client OpenSSH</em>.</p>' }),
  cmd(`ssh morgane@192.168.15.70            # nom_utilisateur@adresse_du_serveur
ssh -p 2222 morgane@192.168.15.70    # si le port a ete change
ssh morgane@192.168.15.70 "df -h"    # une seule commande, puis on ressort`),

  block('heading', { level: 3, text: 'La première connexion : l’empreinte' }),
  block('html', { html: '<p>Les trois clients posent la même question, sous trois habillages — la fenêtre <em>Accept</em> de PuTTY et de MobaXterm, et ce texte en ligne de commande :</p>' }),
  cmd(`The authenticity of host '192.168.15.70' can't be established.
ED25519 key fingerprint is SHA256:4Zt9x...LqR8.
Are you sure you want to continue connecting (yes/no/[fingerprint])?`),
  block('html', { html: '<p>On répond <code>yes</code>, <strong>en toutes lettres</strong> — <code>y</code> ne suffit pas. L’empreinte est mémorisée, et la question ne reviendra plus pour ce serveur.</p>' }),
  note('yellow', '⚠️ Ce que cette question protège vraiment', '<p>SSH chiffre la communication, mais le chiffrement ne sert à rien si l’on parle à la mauvaise machine. L’empreinte est la <strong>carte d’identité du serveur</strong> : en l’acceptant, on déclare « c’est bien lui ». Si quelqu’un s’intercale ensuite, son empreinte sera différente et le client refusera de continuer.</p><p>La vraie vérification consiste à comparer avec ce que le serveur affiche, relevé <em>sur sa console</em> :</p><div class="lx-cmd">ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub</div><p>En TP on accepte sans comparer. Sur un serveur qu’on ne maîtrise pas, on compare.</p>'),
  block('html', { html: '<table class="pb-table"><thead><tr><th>Client</th><th>Où l’empreinte est mémorisée</th></tr></thead><tbody>' +
    '<tr><td><code>ssh</code> (Windows ou Linux)</td><td><code>~/.ssh/known_hosts</code> — sous Windows : <code>C:\\Users\\&lt;nom&gt;\\.ssh\\known_hosts</code></td></tr>' +
    '<tr><td>PuTTY</td><td>Dans le registre : <code>HKCU\\Software\\SimonTatham\\PuTTY\\SshHostKeys</code></td></tr>' +
    '<tr><td>MobaXterm</td><td>Dans ses propres fichiers de configuration</td></tr>' +
    '</tbody></table>' }),
  note('red', '🚫 « REMOTE HOST IDENTIFICATION HAS CHANGED! »', '<p>Un pavé d’avertissement, et la connexion est refusée. Deux causes possibles :</p><ul><li><strong>La banale, en TP</strong> : la VM a été réinstallée, ou la même adresse IP a été reprise par une autre machine. Nouvelles clés, donc nouvelle empreinte.</li><li><strong>La grave</strong> : quelqu’un s’est intercalé.</li></ul><p>Quand on <em>sait</em> pourquoi l’empreinte a changé, on retire l’ancienne entrée :</p><div class="lx-cmd">ssh-keygen -R 192.168.15.70</div><p>Sinon, on ne passe pas outre — on va vérifier sur la console du serveur.</p>'),

  block('heading', { level: 2, text: '5) Lire les journaux, savoir qui est connecté' }),
  block('html', { html: '<p><code>sudo systemctl status ssh</code> ne dit pas seulement si le service tourne : il affiche aussi <strong>les dix dernières lignes de journal</strong>. C’est là qu’on lit ce qui s’est passé.</p>' }),
  cmd(`11:40:12 debian sshd[1287]: Accepted password for morgane from 192.168.15.12 port 53332 ssh2
11:40:12 debian sshd[1287]: pam_unix(sshd:session): session opened for user morgane(uid=1000) by (uid=0)
12:01:47 debian sshd[1287]: Received disconnect from 192.168.15.12 port 53332:11: disconnected by user
12:01:47 debian sshd[1287]: Disconnected from user morgane 192.168.15.12 port 53332
12:01:47 debian sshd[1287]: pam_unix(sshd:session): session closed for user morgane`),
  block('html', { html: '<table class="pb-table"><thead><tr><th>Ce qu’on lit</th><th>Ce que ça dit</th></tr></thead><tbody>' +
    '<tr><td><code>Accepted password</code></td><td>Le mot de passe a été accepté. En face : <code>Failed password</code>.</td></tr>' +
    '<tr><td><code>for morgane</code></td><td>Le compte utilisé.</td></tr>' +
    '<tr><td><code>from 192.168.15.12</code></td><td><strong>D’où l’on s’est connecté</strong> — ici la machine physique.</td></tr>' +
    '<tr><td><code>port 53332</code></td><td>Le port <em>côté client</em>, tiré au hasard. Le 22 est côté serveur.</td></tr>' +
    '<tr><td><code>uid=1000</code></td><td>L’identifiant numérique du compte. Le premier utilisateur créé porte toujours 1000.</td></tr>' +
    '<tr><td><code>by (uid=0)</code></td><td>La session a été ouverte par un processus tournant en <strong>root</strong> (uid 0) : c’est <code>sshd</code> lui-même. Normal — il faut ce privilège pour ouvrir une session au nom d’un autre.</td></tr>' +
    '<tr><td><code>sshd[1287]</code></td><td>Le numéro du processus. Le <strong>même sur toutes les lignes</strong> d’une session : c’est ce qui permet de suivre une connexion du début à la fin quand plusieurs se mélangent.</td></tr>' +
    '</tbody></table>' }),
  block('html', { html: '<p>Pour voir <strong>qui est connecté en ce moment</strong> : la commande <code>w</code>.</p>' }),
  cmd(`$ w
 12:04:31 up 47 min,  2 users,  load average: 0,02 0,05 0,01
USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT
morgane  tty1     -                11:20   43:11   0.05s  0.05s -bash
morgane  pts/0    192.168.15.12    12:03    2.00s  0.03s  0.00s w`),
  block('html', { html: '<table class="pb-table"><thead><tr><th>Ligne</th><th>Lecture</th></tr></thead><tbody>' +
    '<tr><td><strong>1</strong></td><td>Il est 12 h 04, la machine est allumée depuis 47 minutes, <strong>2 utilisateurs</strong> sont connectés.</td></tr>' +
    '<tr><td><strong>2</strong></td><td><code>tty1</code> et <code>FROM</code> vide : quelqu’un est <strong>physiquement devant la machine</strong> (la console de la VM). Connecté depuis 11 h 20, inactif depuis 43 minutes.</td></tr>' +
    '<tr><td><strong>3</strong></td><td><code>pts/0</code> et une adresse dans <code>FROM</code> : c’est une session <strong>SSH</strong>, venue de 192.168.15.12, ouverte à 12 h 03. La colonne <code>WHAT</code> montre la dernière commande — ici <code>w</code> elle-même.</td></tr>' +
    '</tbody></table>' }),
  note('green', '🎯 <code>tty</code> ou <code>pts</code> : la question qui revient', '<p><code>tty1</code> = un vrai terminal, sur la machine. <code>pts/0</code> = un terminal <em>virtuel</em>, donc à distance — SSH. Quand on se demande « suis-je sur la bonne machine ? », <code>w</code> ou <code>who am i</code> répond en une ligne.</p>'),
  cmd(`w                                # qui est la, depuis quand, d'ou, et ce qu'il fait
who                              # la meme chose, en plus court
last                             # l'HISTORIQUE des connexions, la plus recente en haut
sudo journalctl -u ssh -f        # les tentatives EN DIRECT — laisser tourner et se connecter`),
  note('gray', '🔎 Le journal en direct, pour comprendre un refus', '<p><code>sudo journalctl -u ssh -f</code> dans une fenêtre, puis on tente la connexion depuis l’autre poste : le journal dit exactement pourquoi elle est refusée.</p><ul><li><code>Failed password for morgane</code> → le mot de passe est faux, mais le compte existe et le réseau passe.</li><li><code>Invalid user morgane</code> → le compte n’existe pas sur le serveur.</li><li><code>User morgane not allowed because not listed in AllowUsers</code> → c’est <code>sshd_config</code> qui bloque, pas l’authentification.</li><li><strong>Rien du tout n’apparaît</strong> → la demande n’arrive même pas jusqu’au service : pare-feu, mauvaise adresse, ou service arrêté. Inutile de chercher du côté du mot de passe.</li></ul>'),
  note('yellow', '⚠️ « Connection refused » et « Connection timed out » ne disent pas la même chose', '<p><strong>refused</strong> : la machine répond, mais rien n’écoute sur ce port — service arrêté, ou mauvais port. <strong>timed out</strong> : personne ne répond du tout — mauvaise adresse, machine éteinte, ou pare-feu qui jette les paquets en silence. Le premier se règle sur le serveur, le second sur le réseau.</p>'),

  block('heading', { level: 2, text: '6) Vérifier & dépanner' }),
  cmd(`sudo systemctl status ssh        # actif ?
sudo ss -tlnp | grep ssh         # écoute sur le bon port ?
journalctl -u ssh                # journaux (connexions, erreurs)
sudo ufw allow 22/tcp            # ouvrir le pare-feu si ufw actif`),
  note('green', '🔗 Liens', '<p><a href="/pages/le-ssh">Le SSH (commandes client, scp, sftp)</a> · <a href="/pages/linux-bases">Linux : les bases</a> · <a href="/pages/procedure-ssh-packet-tracer">SSH sur Packet Tracer (Cisco)</a> · <a href="/pages/tp-config-reseau-statique">TP : IP statique</a> — à faire avant, pour avoir une adresse fixe à joindre.</p>'),
];
function cookieFrom(res: Response): string { const sc = (res.headers as any).getSetCookie?.() as string[] | undefined; return (sc && sc.length ? sc : [res.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; '); }
async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: PW }) });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const cookie = cookieFrom(login); const h = { 'Content-Type': 'application/json', Cookie: cookie };
  const existing = await (await fetch(`${BASE}/api/admin/pages`, { headers: { Cookie: cookie } })).json() as Array<{ id: number; slug: string }>;
  const cur = existing.find(e => e.slug === PAGE.slug);
  const body = JSON.stringify({ title: PAGE.title, slug: PAGE.slug, excerpt: PAGE.excerpt, content: renderPageBlocksToHtml(blocks), builder_json: serializePageBlocks(blocks), published: 1 });
  const res = cur ? await fetch(`${BASE}/api/admin/pages/${cur.id}`, { method: 'PUT', headers: h, body }) : await fetch(`${BASE}/api/admin/pages`, { method: 'POST', headers: h, body });
  console.log(`PAGE ${PAGE.slug}`, res.status, cur ? '(maj)' : '(créée)', res.ok ? '' : await res.text());
  const cc = await fetch(`${BASE}/api/admin/cache/clear`, { method: 'POST', headers: { Cookie: cookie } }); console.log('cache clear', cc.status);
}
main().catch(e => { console.error(e); process.exit(1); });
