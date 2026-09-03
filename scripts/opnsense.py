# -*- coding: utf-8 -*-
"""
Premier volet du cours OPNsense : découverte, mise en place, premières règles.

POURQUOI UN COURS DE PLUS SUR LE PARE-FEU
`le-pare-feu` explique le CONCEPT — règles, ports, états, politique par défaut.
Il ne montre aucun produit. Ce cours-ci prend l'objet : une distribution qu'on
installe, dont on assigne les interfaces et dans laquelle on écrit des règles.
Les deux se répondent, et le concept n'est pas réexpliqué ici : il est lié.

UN VOLET, PAS LE COURS ENTIER.
OPNsense couvre le filtrage, le NAT, le DHCP, le DNS, le VPN, la détection
d'intrusion, le proxy, la haute disponibilité. Tout entasser donnerait une page
que personne ne lit jusqu'au bout. Ce premier volet va de l'ISO à la première
règle écrite à la main — le moment où l'on tient l'outil. Les suivants sont
annoncés en fin de page pour que le découpage se voie.

IDEMPOTENT : relancer met à jour la page et ne duplique pas la carte d'index.
"""
import sqlite3
import sys
from pathlib import Path

# Le style, le bandeau de série, les helpers de balisage et le rangement dans
# l'index sont communs aux cinq volets : ils vivent à côté, pas ici.
from opnsense_serie import STYLE, acc, bandeau, menu, note, publier, ranger_dans_index

BASE = Path(__file__).resolve().parent.parent / 'cms.sqlite'


SVG_POSITION = (
    '<svg viewBox="0 0 460 250" role="img" aria-label="OPNsense entre Internet, le LAN et la DMZ" '
    'style="max-width:460px;width:100%;height:auto;margin:8px 0 12px;'
    'font-family:system-ui,sans-serif">'
    '<ellipse cx="55" cy="50" rx="48" ry="27" fill="#64748b"/>'
    '<text x="55" y="55" text-anchor="middle" font-size="12.5" fill="#fff" font-weight="bold">Internet</text>'
    '<line x1="103" y1="50" x2="165" y2="50" stroke="#94a3b8" stroke-width="2.5"/>'
    '<text x="134" y="42" text-anchor="middle" font-size="10" fill="#64748b">WAN</text>'
    '<rect x="165" y="20" width="118" height="200" rx="10" fill="#dc2626"/>'
    '<text x="224" y="52" text-anchor="middle" font-size="13.5" fill="#fff" font-weight="bold">OPNsense</text>'
    '<text x="224" y="70" text-anchor="middle" font-size="10" fill="#fecaca">pare-feu · routeur</text>'
    '<rect x="181" y="88" width="86" height="24" rx="5" fill="#fff" fill-opacity=".16"/>'
    '<text x="224" y="104" text-anchor="middle" font-size="10.5" fill="#fff">em0 → WAN</text>'
    '<rect x="181" y="120" width="86" height="24" rx="5" fill="#fff" fill-opacity=".16"/>'
    '<text x="224" y="136" text-anchor="middle" font-size="10.5" fill="#fff">em1 → LAN</text>'
    '<rect x="181" y="152" width="86" height="24" rx="5" fill="#fff" fill-opacity=".16"/>'
    '<text x="224" y="168" text-anchor="middle" font-size="10.5" fill="#fff">em2 → OPT1</text>'
    '<line x1="283" y1="132" x2="352" y2="132" stroke="#16a34a" stroke-width="2.5"/>'
    '<rect x="352" y="112" width="94" height="40" rx="8" fill="#059669"/>'
    '<text x="399" y="130" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">LAN</text>'
    '<text x="399" y="145" text-anchor="middle" font-size="9.5" fill="#d1fae5">192.168.1.0/24</text>'
    '<line x1="283" y1="196" x2="352" y2="196" stroke="#f59e0b" stroke-width="2.5"/>'
    '<rect x="352" y="176" width="94" height="40" rx="8" fill="#d97706"/>'
    '<text x="399" y="194" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">DMZ</text>'
    '<text x="399" y="209" text-anchor="middle" font-size="9.5" fill="#fef3c7">serveurs exposés</text>'
    '<text x="230" y="240" text-anchor="middle" font-size="10.5" fill="#64748b">'
    'Une carte réseau par zone — tout ce qui passe d’une zone à l’autre traverse les règles</text>'
    '</svg>')

SVG_REGLES = (
    '<svg viewBox="0 0 470 240" role="img" aria-label="Évaluation des règles de haut en bas" '
    'style="max-width:470px;width:100%;height:auto;margin:8px 0 12px;'
    'font-family:system-ui,sans-serif">'
    '<rect x="8" y="98" width="86" height="34" rx="7" fill="#059669"/>'
    '<text x="51" y="114" text-anchor="middle" font-size="11" fill="#fff" font-weight="bold">Paquet</text>'
    '<text x="51" y="126" text-anchor="middle" font-size="9" fill="#d1fae5">entre par le LAN</text>'
    '<line x1="94" y1="115" x2="128" y2="115" stroke="#94a3b8" stroke-width="2.5"/>'
    '<rect x="128" y="16" width="215" height="34" rx="6" fill="var(--surface-2)" stroke="#cbd5e1"/>'
    '<text x="140" y="37" font-size="11" fill="#0f172a">1 · bloquer 192.168.1.66 → tout</text>'
    '<rect x="128" y="58" width="215" height="34" rx="6" fill="var(--surface-2)" stroke="#cbd5e1"/>'
    '<text x="140" y="79" font-size="11" fill="#0f172a">2 · autoriser LAN → DNS (53)</text>'
    '<rect x="128" y="100" width="215" height="34" rx="6" fill="#dcfce7" stroke="#16a34a" stroke-width="2"/>'
    '<text x="140" y="121" font-size="11" fill="#14532d" font-weight="bold">3 · autoriser LAN → 80/443 ✔</text>'
    '<rect x="128" y="142" width="215" height="34" rx="6" fill="var(--surface-2)" stroke="#cbd5e1" '
    'stroke-dasharray="4 3"/>'
    '<text x="140" y="163" font-size="11" fill="#94a3b8">4 · autoriser LAN → tout</text>'
    '<rect x="128" y="184" width="215" height="34" rx="6" fill="#fee2e2" stroke="#dc2626" '
    'stroke-dasharray="4 3"/>'
    '<text x="140" y="205" font-size="11" fill="#7f1d1d">refus implicite (invisible)</text>'
    '<line x1="343" y1="117" x2="400" y2="117" stroke="#16a34a" stroke-width="2.5"/>'
    '<text x="406" y="121" font-size="11.5" fill="#16a34a" font-weight="bold">passe</text>'
    '<text x="235" y="234" text-anchor="middle" font-size="10.5" fill="#64748b">'
    'De haut en bas, la PREMIÈRE règle qui correspond décide — les suivantes ne sont jamais lues</text>'
    '</svg>')


CONTENU = '\n'.join([
    '<section class="hero"><span class="pill">Cours · Réseau</span>'
    '<h1>OPNsense : le pare-feu open source</h1>'
    '<p>Volet 1 — de l’image ISO à la première règle écrite à la main : ce qu’est OPNsense, '
    'comment on l’installe, comment on lui assigne ses interfaces et comment il lit ses règles.</p>'
    '</section>',
    STYLE,
    bandeau('opnsense'),

    note('blue', '📚 Avant ce cours',
         'Ce volet suppose acquis le <a href="/pages/le-pare-feu">cours sur le pare-feu</a> : règles, '
         'ports, filtrage à états, politique « tout fermé par défaut ». On ne réexplique pas ces '
         'notions ici — on les met en œuvre sur un produit réel.'),

    '<h2>1) Qu’est-ce qu’OPNsense ?</h2>',
    '<p><strong>OPNsense</strong> est un <strong>système d’exploitation complet</strong> dont le seul '
    'métier est d’être un pare-feu et un routeur. On ne l’installe pas <em>sur</em> un serveur pour '
    'lui ajouter une fonction : on lui dédie une machine, qui ne fera que ça.</p>',
    '<table class="lx-tab">'
    '<tr><th>Point</th><th>Détail</th></tr>'
    '<tr><td>Base</td><td><strong>FreeBSD</strong> — pas Linux. Le filtrage est assuré par '
    '<strong>pf</strong>, le pare-feu de la famille BSD.</td></tr>'
    '<tr><td>Origine</td><td>Une <strong>bifurcation de pfSense</strong> lancée en 2015 par la '
    'société néerlandaise Deciso.</td></tr>'
    '<tr><td>Licence</td><td>Libre (BSD). Gratuit, sans limitation de débit ni de fonctions.</td></tr>'
    '<tr><td>Administration</td><td>Une <strong>interface web</strong> pour tout ; la console ne sert '
    'qu’au dépannage et à l’assignation des interfaces.</td></tr>'
    '<tr><td>Ce qu’il remplace</td><td>Une box, un routeur d’entreprise, un boîtier Stormshield ou '
    'Fortinet — à l’échelle d’une PME ou d’une salle de TP.</td></tr></table>',
    note('gray', '💡 OPNsense ou pfSense ?',
         'Les deux descendent du même code et se ressemblent beaucoup : mêmes concepts, mêmes '
         'menus à peu de chose près. Apprendre l’un, c’est savoir se débrouiller sur l’autre. '
         'OPNsense sort deux versions par an, son interface est plus récente et la détection '
         'd’intrusion y est intégrée d’origine ; pfSense, porté par Netgate, existe en version '
         'communautaire gratuite et en version payante liée à leurs boîtiers.'),

    '<h2>2) Où il se place dans le réseau</h2>',
    '<p>Un pare-feu de poste protège <strong>une machine</strong>. OPNsense se place '
    '<strong>entre les réseaux</strong> : tout ce qui va d’une zone à une autre passe par lui, et '
    'donc par ses règles. C’est ce qui permet de protéger des équipements qui n’ont aucun pare-feu — '
    'une imprimante, une caméra, un automate.</p>',
    SVG_POSITION,
    '<p>D’où la contrainte matérielle : <strong>une carte réseau par zone</strong>, au minimum deux.</p>',
    '<table class="lx-tab"><tr><th>Interface</th><th>Rôle</th><th>Confiance</th></tr>'
    '<tr><td><strong>WAN</strong></td><td>Le côté Internet / la box</td>'
    '<td><strong>Aucune</strong> — rien n’entre sans une règle explicite</td></tr>'
    '<tr><td><strong>LAN</strong></td><td>Le réseau interne</td>'
    '<td>Élevée — une règle « LAN vers tout » est créée à l’installation</td></tr>'
    '<tr><td><strong>OPT1, OPT2…</strong></td><td>Toute zone supplémentaire : DMZ, Wi-Fi invités, '
    'VLAN serveurs</td><td>À définir — aucune règle par défaut, donc rien ne passe</td></tr></table>',
    note('yellow', '⚠️ La DMZ n’est pas un troisième réseau « comme les autres »',
         'Une <strong>DMZ</strong> (zone démilitarisée) accueille les serveurs joignables depuis '
         'Internet. On l’isole précisément parce qu’elle est exposée : si un serveur web s’y fait '
         'compromettre, l’attaquant se retrouve dans une zone <strong>d’où il ne peut pas atteindre '
         'le LAN</strong>. Une DMZ autorisée à joindre le réseau interne ne sert à rien.'),

    '<h2>3) La maquette : deux cartes, une machine virtuelle</h2>',
    '<p>Pour apprendre, une machine virtuelle suffit largement. Il faut lui donner '
    '<strong>deux cartes réseau</strong>, branchées sur deux commutateurs virtuels différents.</p>',
    '<table class="lx-tab"><tr><th></th><th>Hyper-V</th><th>VirtualBox</th></tr>'
    '<tr><td>Carte 1 — WAN</td><td>Commutateur <strong>externe</strong></td>'
    '<td>Accès par <strong>pont</strong></td></tr>'
    '<tr><td>Carte 2 — LAN</td><td>Commutateur <strong>privé</strong> (ou interne)</td>'
    '<td>Réseau <strong>interne</strong></td></tr>'
    '<tr><td>Le client de test</td><td colspan="2">Une seconde VM, avec <strong>une seule</strong> '
    'carte, branchée sur le même réseau que le LAN d’OPNsense</td></tr></table>',
    note('gray', '💡 Sous Hyper-V, prends une VM de <strong>génération 1</strong>',
         'C’est le choix qui démarre sans discussion. En génération 2, il faut penser à '
         '<strong>désactiver le démarrage sécurisé</strong> dans les paramètres de la machine, sinon '
         'l’image refuse de s’amorcer sans donner de raison claire. Compte 1 Go de mémoire et 20 Go '
         'de disque : OPNsense n’est pas gourmand. Voir '
         '<a href="/pages/procedure-vm-hyperv">Créer une machine virtuelle sous Hyper-V</a>.'),
    note('yellow', '⚠️ Le client de test ne doit pas avoir de seconde carte',
         'Une VM cliente qui garde un accès direct à Internet à côté du LAN sortira par là sans '
         'jamais traverser le pare-feu. On croira alors que les règles fonctionnent — ou qu’elles ne '
         'bloquent rien. Une seule carte, sur le réseau LAN, et rien d’autre.'),

    '<h2>4) Installer</h2>',
    '<p>On télécharge l’image sur <em>opnsense.org</em> — la variante <strong>dvd</strong> (une ISO) '
    'pour une machine virtuelle. Le fichier arrive compressé en <code>.bz2</code>, il faut le '
    'décompresser avant de le monter.</p>',
    '<p>La machine démarre sur un système <strong>vivant</strong> : rien n’est encore écrit sur le '
    'disque. Pour lancer l’installation, on se connecte avec le compte prévu à cet effet.</p>',
    '<div class="lx-cmd">login : installer\nmot de passe : opnsense</div>',
    '<p>L’assistant enchaîne alors quelques questions :</p>',
    '<ul class="proc-steps">'
    '<li>La <strong>disposition du clavier</strong> — choisir <em>French</em>, sans quoi tous les '
    'mots de passe saisis ensuite le seront en QWERTY.</li>'
    '<li>Le <strong>mode d’installation</strong> : <em>Install (UFS)</em> convient pour une maquette. '
    'ZFS apporte des instantanés et des sommes de contrôle, utile en production, inutile ici.</li>'
    '<li>Le <strong>disque</strong> de destination — le seul de la VM.</li>'
    '<li>Le <strong>mot de passe root</strong>, qu’on change dès maintenant.</li>'
    '</ul>',
    '<p>Puis la machine redémarre sur le système installé.</p>',

    '<h2>5) Assigner les interfaces</h2>',
    '<p>C’est <strong>la</strong> étape qui décide de tout le reste : dire quelle carte physique est '
    'le WAN et laquelle est le LAN. OPNsense propose une détection automatique, mais sur une VM les '
    'deux cartes sont identiques — il vaut mieux trancher soi-même.</p>',
    '<p>Au menu de la console, l’entrée <strong>« Assign interfaces »</strong> :</p>',
    '<div class="lx-cmd">Valid interfaces are:\n'
    'em0   00:15:5d:01:02:03   (up)  Intel(R) PRO/1000\n'
    'em1   00:15:5d:01:02:04   (up)  Intel(R) PRO/1000\n\n'
    'Enter the WAN interface name : em0\n'
    'Enter the LAN interface name : em1\n'
    'Enter the Optional 1 interface name (or nothing) : &lt;Entrée&gt;</div>',
    note('gray', '💡 Comment savoir quelle carte est laquelle',
         'Par son <strong>adresse MAC</strong> : l’hyperviseur affiche celle de chaque carte de la VM, '
         'la console affiche la même à côté du nom <code>em0</code> / <code>em1</code>. C’est le seul '
         'lien fiable entre les deux — l’ordre d’affichage, lui, n’est pas garanti.'),
    '<p>Ensuite, l’entrée <strong>« Set interface IP address »</strong> pour donner son adresse au '
    'LAN. Le WAN, lui, prend en général son adresse par DHCP auprès de la box.</p>',
    '<table class="lx-tab"><tr><th>Question de l’assistant</th><th>Réponse pour la maquette</th></tr>'
    '<tr><td>Configure IPv4 via DHCP?</td><td><strong>n</strong> — on veut une adresse fixe</td></tr>'
    '<tr><td>Enter the new LAN IPv4 address</td><td><code>192.168.10.254</code></td></tr>'
    '<tr><td>Subnet bit count</td><td><code>24</code></td></tr>'
    '<tr><td>Enable DHCP server on LAN?</td><td><strong>y</strong> — pratique pour la suite</td></tr>'
    '<tr><td>Range</td><td><code>192.168.10.100</code> à <code>192.168.10.200</code></td></tr>'
    '<tr><td>Revert to HTTP as the web GUI protocol?</td><td><strong>n</strong> — on garde HTTPS</td></tr>'
    '</table>',
    note('yellow', '⚠️ L’adresse du LAN est la passerelle du réseau',
         'C’est elle que les postes du LAN utiliseront comme passerelle par défaut. Choisis-la en '
         'cohérence avec ton <a href="/pages/procedure-plan-adressage">plan d’adressage</a> — ici '
         '<code>.254</code>, la convention du site — et pas la valeur d’usine '
         '<code>192.168.1.1</code>, qui entre souvent en conflit avec la box du réseau d’accueil.'),

    '<h2>6) Le premier accès à l’interface web</h2>',
    '<p>Depuis la VM cliente branchée sur le LAN, dans un navigateur :</p>',
    '<div class="lx-cmd">https://192.168.10.254\n\n'
    'login : root\nmot de passe : celui défini à l’installation</div>',
    note('gray', '💡 L’avertissement de certificat est attendu',
         'OPNsense génère son propre certificat au premier démarrage : personne ne l’a signé, le '
         'navigateur proteste. On passe outre — c’est le même phénomène que pour un site en HTTPS '
         'auto-signé, expliqué dans <a href="/pages/linux-apache-virtualhosts">le cours Apache</a>. '
         'En production, on remplace ce certificat.'),
    '<p>Au premier accès, un <strong>assistant de configuration</strong> se lance '
    f'({menu("System › Wizard")} pour le rejouer). Il demande le nom de la machine, le domaine, les '
    'serveurs DNS, le fuseau horaire, et confirme les réglages du WAN et du LAN. On peut tout '
    'accepter : chaque point est modifiable ensuite.</p>',
    '<p>Le <strong>tableau de bord</strong> qui s’affiche ensuite est la page qu’on regardera le '
    'plus souvent :</p>',
    acc(
        ('📊 Les widgets du tableau de bord',
         '<p>Chaque bloc est un <em>widget</em> déplaçable : l’état des interfaces et leur débit, la '
         'charge et la mémoire, les passerelles et leur temps de réponse, les services qui tournent, '
         'et les dernières lignes du journal de filtrage. C’est le premier écran à lire quand '
         '« ça ne marche plus ».</p>'),
        ('🧭 La logique des menus',
         f'<p>{menu("Interfaces")} — ce que sont les cartes. '
         f'{menu("Firewall")} — les règles, les alias, le NAT. '
         f'{menu("Services")} — DHCP, DNS, relais… ce que le boîtier <em>rend</em> comme service. '
         f'{menu("VPN")} — les accès distants. '
         f'{menu("System")} — les comptes, les certificats, les mises à jour, les sauvegardes.</p>'),
        ('💾 Sauvegarder la configuration',
         f'<p>{menu("System › Configuration › Backups")} exporte toute la configuration dans un '
         '<strong>fichier XML unique</strong>. Le réflexe : exporter avant chaque changement '
         'important, et surtout avant une mise à jour. Restaurer ce fichier sur une machine neuve '
         'reconstitue le pare-feu à l’identique — c’est ce qui rend le matériel remplaçable.</p>'),
    ),

    '<h2>7) Comment OPNsense lit ses règles</h2>',
    '<p>Trois principes, et le troisième est celui qui fait perdre le plus de temps.</p>',
    '<p><strong>a. Les règles sont rangées par interface.</strong> '
    f'{menu("Firewall › Rules")} présente un onglet par zone : WAN, LAN, OPT1… On écrit une règle '
    '<em>sur une interface</em>, pas « dans le pare-feu ».</p>',
    '<p><strong>b. La première qui correspond décide.</strong> De haut en bas ; les suivantes ne sont '
    'même pas lues. Et si aucune ne correspond, un <strong>refus implicite</strong> — invisible dans '
    'la liste — jette le paquet.</p>',
    SVG_REGLES,
    '<p><strong>c. Une règle s’applique au trafic qui ENTRE par l’interface.</strong> C’est le point '
    'contre-intuitif. Pour autoriser un poste du LAN à joindre Internet, la règle se pose '
    '<strong>sur l’onglet LAN</strong> — là où le paquet arrive dans le pare-feu — et non sur le WAN, '
    'par lequel il repartira.</p>',
    note('yellow', '⚠️ La question à se poser avant d’écrire une règle',
         '« <strong>Par quelle interface ce paquet entre-t-il dans le pare-feu ?</strong> » La réponse '
         'donne l’onglet. Une règle posée sur le mauvais onglet est syntaxiquement correcte, '
         's’enregistre sans erreur, et ne fait strictement rien — d’où le temps perdu à la relire.'),
    note('gray', '💡 Et la réponse, alors ?',
         'Elle n’a besoin d’aucune règle. Le pare-feu est <strong>à états</strong> : il a mémorisé la '
         'connexion sortante et laisse revenir ce qui y correspond. On n’écrit jamais la règle du '
         'retour — c’est même le signe qu’on a mal compris quand on essaie.'),

    '<h2>8) Les règles présentes dès l’installation</h2>',
    '<table class="lx-tab"><tr><th>Interface</th><th>Règle</th><th>Ce qu’elle fait</th></tr>'
    '<tr><td>LAN</td><td><em>Anti-Lockout</em></td><td>Garantit l’accès à l’interface web depuis le '
    'LAN. Elle n’apparaît pas dans la liste et ne peut pas être supprimée par erreur : c’est ce qui '
    'empêche de se verrouiller dehors.</td></tr>'
    '<tr><td>LAN</td><td><em>Default allow LAN to any</em></td><td>Le réseau interne sort partout. '
    'Confortable pour démarrer, beaucoup trop large pour rester en l’état.</td></tr>'
    '<tr><td>WAN</td><td><em>Block private networks</em></td><td>Jette ce qui prétend venir d’une '
    'plage privée (RFC 1918) alors que ça arrive d’Internet — une adresse source usurpée.</td></tr>'
    '<tr><td>WAN</td><td><em>Block bogon networks</em></td><td>Jette les plages qui ne sont attribuées '
    'à personne. Rien de légitime n’en vient.</td></tr>'
    '<tr><td>WAN</td><td>(aucune autorisation)</td><td><strong>Rien n’entre.</strong> C’est le refus '
    'implicite qui protège le réseau dès la première seconde.</td></tr></table>',
    note('red', '🚨 Ne supprime jamais la règle anti-lockout « pour faire propre »',
         f'Elle se désactive dans {menu("Firewall › Settings › Advanced")}. Le jour où on la coupe '
         'sans avoir d’abord vérifié qu’une autre règle autorise l’accès à l’interface web, on perd '
         'la main sur le pare-feu et il faut repasser par la console de la machine. Sur un boîtier '
         'distant, cela veut dire un déplacement.'),

    '<h2>9) Écrire sa première règle</h2>',
    '<p>Objectif : remplacer le « LAN sort partout » par quelque chose de tenable — le réseau interne '
    'a le droit d’aller sur le web et de résoudre des noms, rien d’autre.</p>',
    f'<p>{menu("Firewall › Rules › LAN")}, puis le bouton <strong>+</strong> :</p>',
    '<table class="lx-tab"><tr><th>Champ</th><th>Valeur</th><th>Pourquoi</th></tr>'
    '<tr><td>Action</td><td>Pass</td><td>On autorise</td></tr>'
    '<tr><td>Interface</td><td>LAN</td><td>Là où le paquet <strong>entre</strong></td></tr>'
    '<tr><td>Direction</td><td>in</td><td>Le sens par défaut, celui qu’on garde</td></tr>'
    '<tr><td>Protocol</td><td>TCP</td><td>HTTP et HTTPS sont du TCP</td></tr>'
    '<tr><td>Source</td><td>LAN net</td><td>Le réseau du LAN, quelle que soit son adresse — la règle '
    'survit à un changement de plan d’adressage</td></tr>'
    '<tr><td>Destination</td><td>any</td><td>N’importe quel serveur sur Internet</td></tr>'
    '<tr><td>Destination port range</td><td>HTTP à HTTPS</td><td>80 et 443</td></tr>'
    '<tr><td>Description</td><td><em>LAN → web</em></td><td>Obligatoire dans les faits : une liste de '
    'règles sans description est illisible au bout de dix lignes</td></tr></table>',
    '<p>On enregistre, puis on clique sur <strong>Apply changes</strong> — la bannière en haut de '
    'page. Tant qu’on ne l’a pas fait, la règle est écrite mais <strong>pas active</strong>.</p>',
    '<p>On répète pour le DNS (UDP et TCP, port 53), puis on <strong>désactive</strong> la règle '
    '« Default allow LAN to any » plutôt que de la supprimer : si tout s’arrête, on la réactive en un '
    'clic le temps de comprendre.</p>',
    note('gray', '💡 <em>LAN net</em> plutôt que <code>192.168.10.0/24</code>',
         'Les deux marchent aujourd’hui. Mais <em>LAN net</em> est un renvoi <strong>dynamique</strong> '
         'vers ce que vaut le réseau du LAN à cet instant : le jour où l’on change de plan '
         'd’adressage, les règles suivent toutes seules. Une adresse écrite en dur, elle, devra être '
         'retrouvée règle par règle.'),

    '<h2>10) Vérifier — la seule façon d’en avoir le cœur net</h2>',
    f'<p>{menu("Firewall › Log Files › Live View")} affiche <strong>en direct</strong> ce que le '
    'pare-feu accepte et ce qu’il jette, avec la règle responsable de chaque décision.</p>',
    '<ul class="proc-steps">'
    '<li>Ouvre la vue en direct, filtre sur l’adresse du client.</li>'
    '<li>Depuis le client, tente ce qui doit marcher : une page web. La ligne apparaît en '
    '<strong>vert</strong>.</li>'
    '<li>Tente ce qui doit échouer : <code>ssh 8.8.8.8</code>, ou un <code>ping</code> vers Internet '
    'si tu n’as pas ouvert l’ICMP. La ligne apparaît en <strong>rouge</strong>, et un clic sur '
    'l’icône de la ligne mène à la règle qui a décidé.</li>'
    '<li>Un blocage <strong>attendu</strong> qui n’apparaît pas dans le journal, c’est un paquet qui '
    'n’est jamais arrivé au pare-feu : le problème est ailleurs — plan d’adressage, passerelle du '
    'client, ou seconde carte réseau oubliée sur la VM.</li>'
    '</ul>',
    note('gray', '🔍 Les deux autres écrans de diagnostic',
         f'{menu("Firewall › Diagnostics › States")} liste les connexions actuellement suivies — c’est '
         'là qu’on voit concrètement ce qu’« à états » veut dire. Et un changement de règle ne coupe '
         'pas les connexions déjà établies : si un blocage ne semble pas prendre effet, c’est souvent '
         'un état encore ouvert, qu’on peut vider depuis cet écran.'),

    '<h2>✅ Ce qu’il faut retenir de ce volet</h2>',
    '<ul class="proc-steps">'
    '<li>OPNsense est un <strong>système dédié</strong> sur base FreeBSD, administré par le web, qui '
    'se place <strong>entre</strong> les réseaux — une carte par zone.</li>'
    '<li>L’<strong>assignation des interfaces</strong> conditionne tout le reste ; on l’identifie par '
    'l’adresse MAC.</li>'
    '<li>Les règles sont <strong>rangées par interface</strong>, lues <strong>de haut en bas</strong>, '
    'et s’appliquent au trafic qui <strong>entre</strong> par cette interface.</li>'
    '<li>Le WAN n’autorise <strong>rien</strong> par défaut, et c’est voulu.</li>'
    '<li>Le trafic de <strong>retour</strong> ne demande aucune règle : le filtrage est à états.</li>'
    '<li>Une règle enregistrée n’est pas appliquée tant qu’on n’a pas cliqué '
    '<strong>Apply changes</strong>.</li>'
    '</ul>',

    note('blue', '📘 La suite du cours',
         'Ce volet s’arrête au moment où l’on tient l’outil. La suite est publiée : '
         '<a href="/pages/opnsense-nat"><strong>volet 2 — le NAT et les redirections de '
         'port</strong></a>, puis <a href="/pages/opnsense-services"><strong>volet 3 — '
         'DHCP, DNS et les services du boîtier</strong></a>. Restent à écrire la '
         '<strong>segmentation</strong> (DMZ, VLAN sur une seule carte, règles '
         'inter-zones) et les <strong>accès distants et la détection d’intrusion</strong> '
         '(OpenVPN, WireGuard, Suricata, filtrage web).'),
    note('green', '🔗 À lire à côté',
         'Le concept : <a href="/pages/le-pare-feu">Le pare-feu</a>. La translation d’adresses, dont '
         'OPNsense fait le même usage que Cisco : <a href="/pages/cisco-nat">NAT / PAT</a>. La logique '
         'des listes de règles ordonnées : <a href="/pages/cisco-acl">Les ACL</a>. Et pour observer ce '
         'qui circule vraiment : <a href="/pages/le-wireshark">Wireshark</a>.'),
])

TITRE = 'OPNsense : le pare-feu open source'
EXTRAIT = ('Volet 1 — découverte et mise en place : ce qu’est OPNsense, sa place entre les réseaux, '
           'la maquette à deux cartes, l’installation, l’assignation des interfaces, l’interface web, '
           'et la façon dont les règles sont lues.')
SLUG = 'opnsense'

DESCRIPTION_INDEX = (
    'Volet 1 — la place du pare-feu entre les réseaux, la maquette à deux cartes, '
    'l’installation, l’assignation des interfaces, et comment les règles sont lues '
    '(par interface, de haut en bas, sur le trafic entrant).')


def main():
    c = sqlite3.connect(BASE)
    etat = publier(c, SLUG, TITRE, EXTRAIT, CONTENU)

    idx = c.execute("SELECT content FROM pages WHERE slug='cours'").fetchone()[0]
    neuf, info = ranger_dans_index(idx, SLUG, TITRE, DESCRIPTION_INDEX)
    if neuf is None:
        print('index cours :', info, file=sys.stderr)
        return 1
    c.execute("UPDATE pages SET content=?,"
              " updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug='cours'", (neuf,))

    # Renvoi depuis le cours conceptuel, s'il n'y est pas déjà.
    r = c.execute("SELECT content FROM pages WHERE slug='le-pare-feu'").fetchone()
    if r and f'/{SLUG}"' not in r[0]:
        c.execute("UPDATE pages SET content=?,"
                  " updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug='le-pare-feu'",
                  (r[0] + '\n<aside class="pb-note pb-note-green">'
                          '<p class="pb-note-title">🧱 Un vrai pare-feu, en pratique</p>'
                          '<p>Ces notions mises en œuvre sur un produit réel : '
                          f'<a href="/pages/{SLUG}"><strong>OPNsense : le pare-feu open source</strong>'
                          '</a> — installation, interfaces WAN/LAN/DMZ et écriture des règles.</p>'
                          '</aside>',))
        renvoi = 'ajoute'
    else:
        renvoi = 'deja present'

    c.commit()
    c.close()
    print(f'{SLUG} : {etat} ({len(CONTENU)} car.) | index : {info} | renvoi le-pare-feu : {renvoi}'
          .encode('ascii', 'replace').decode('ascii'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
