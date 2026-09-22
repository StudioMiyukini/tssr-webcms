# -*- coding: utf-8 -*-
"""
Un cours de fond : la cryptographie (chiffrer, hacher, signer).

D'OÙ VIENT LE CONTENU
Une présentation « La cryptographie » (11 diapositives : objectifs C-I-A,
chiffrement symétrique/asymétrique, hachage, signature numérique, certificats,
SSL/TLS). C'est le socle que supposent déjà, sans l'expliquer, les pages VPN,
HTTPS, SSH et PKI du site.

POURQUOI UNE PAGE NEUVE, PAS UN AJOUT À pki-adcs
`pki-adcs` traite d'AD Certificate Services — l'outil Windows. Ici on veut le
socle amont : à quoi servent une clé symétrique, une paire asymétrique, un
condensat, une signature — de quoi comprendre *pourquoi* un certificat existe.
On range donc la page dans Réseau › Sécurité & accès distant, à côté du VPN, et
on la relie à pki-adcs, à la série VPN, à SSH et à HTTPS.

IDEMPOTENT : relancer met à jour la page, ne duplique pas sa carte, recompte.
"""
import sys

from _cours import (Categorie, STYLE, acc, bullets, hero, note, publier_lot,
                    retenir, tab)

RESEAU = Categorie('cat-reseau', '🌐', 'Réseau', '', '#059669')
SG = 'Sécurité &amp; accès distant'


def qr(q, a):
    return (f'<p style="border:1px solid var(--border);border-left:3px solid var(--accent);'
            f'background:var(--surface-2);border-radius:8px;padding:9px 13px;margin:9px 0">'
            f'<span style="font-weight:600">{q}</span> '
            f'<span style="color:var(--text-soft);font-size:13.5px">{a}</span></p>')


# ── deux schémas : symétrique vs asymétrique, puis la signature ────────────────
SVG_SYM_ASYM = (
    '<svg viewBox="0 0 600 250" role="img" aria-label="Le chiffrement symétrique utilise une seule '
    'clé partagée ; l’asymétrique une paire clé publique / clé privée" '
    'style="max-width:600px;width:100%;height:auto;margin:10px 0 14px;font-family:system-ui,sans-serif">'
    # symétrique
    '<text x="150" y="20" text-anchor="middle" font-size="12.5" font-weight="bold" fill="#0f766e">Symétrique — une seule clé</text>'
    '<rect x="20" y="40" width="80" height="40" rx="7" fill="#0f766e"/>'
    '<text x="60" y="60" text-anchor="middle" font-size="10.5" fill="#fff">Message</text>'
    '<text x="60" y="73" text-anchor="middle" font-size="8.5" fill="#ccfbf1">clair</text>'
    '<rect x="120" y="40" width="60" height="40" rx="7" fill="#14b8a6"/>'
    '<text x="150" y="58" text-anchor="middle" font-size="16" fill="#fff">🔑</text>'
    '<text x="150" y="73" text-anchor="middle" font-size="8" fill="#ccfbf1">même clé</text>'
    '<rect x="200" y="40" width="80" height="40" rx="7" fill="#475569"/>'
    '<text x="240" y="60" text-anchor="middle" font-size="10.5" fill="#fff">Chiffré</text>'
    '<line x1="100" y1="60" x2="120" y2="60" stroke="#94a3b8" stroke-width="2"/>'
    '<line x1="180" y1="60" x2="200" y2="60" stroke="#94a3b8" stroke-width="2"/>'
    '<text x="150" y="104" text-anchor="middle" font-size="9.5" fill="#64748b">La même clé chiffre et déchiffre —</text>'
    '<text x="150" y="118" text-anchor="middle" font-size="9.5" fill="#64748b">rapide, mais il faut se l’échanger sans fuite</text>'
    '<text x="150" y="134" text-anchor="middle" font-size="9" fill="#0f766e" font-weight="bold">DES · 3DES · AES · ChaCha20</text>'
    # asymétrique
    '<line x1="300" y1="30" x2="300" y2="230" stroke="#e2e8f0" stroke-width="1.5"/>'
    '<text x="450" y="20" text-anchor="middle" font-size="12.5" font-weight="bold" fill="#7c3aed">Asymétrique — deux clés</text>'
    '<rect x="320" y="40" width="70" height="38" rx="7" fill="#7c3aed"/>'
    '<text x="355" y="59" text-anchor="middle" font-size="10" fill="#fff">Message</text>'
    '<text x="355" y="72" text-anchor="middle" font-size="8" fill="#ddd6fe">clair</text>'
    '<rect x="405" y="30" width="58" height="26" rx="6" fill="#a78bfa"/>'
    '<text x="434" y="47" text-anchor="middle" font-size="8.5" fill="#fff">🔓 publique</text>'
    '<rect x="405" y="62" width="58" height="26" rx="6" fill="#5b21b6"/>'
    '<text x="434" y="79" text-anchor="middle" font-size="8.5" fill="#fff">🔒 privée</text>'
    '<rect x="486" y="40" width="80" height="38" rx="7" fill="#475569"/>'
    '<text x="526" y="59" text-anchor="middle" font-size="10" fill="#fff">Chiffré</text>'
    '<line x1="390" y1="59" x2="405" y2="47" stroke="#94a3b8" stroke-width="1.6"/>'
    '<line x1="463" y1="47" x2="486" y2="59" stroke="#94a3b8" stroke-width="1.6"/>'
    '<line x1="486" y1="66" x2="470" y2="75" stroke="#94a3b8" stroke-width="1.6" stroke-dasharray="3 2"/>'
    '<text x="450" y="104" text-anchor="middle" font-size="9.5" fill="#64748b">La clé <tspan fill="#7c3aed" font-weight="bold">publique</tspan> chiffre (diffusée librement),</text>'
    '<text x="450" y="118" text-anchor="middle" font-size="9.5" fill="#64748b">seule la clé <tspan fill="#5b21b6" font-weight="bold">privée</tspan> déchiffre — plus de secret à s’échanger</text>'
    '<text x="450" y="134" text-anchor="middle" font-size="9" fill="#7c3aed" font-weight="bold">RSA · ECC (courbes elliptiques)</text>'
    # la synthèse
    '<rect x="60" y="158" width="480" height="72" rx="10" style="fill:var(--surface-2);stroke:var(--border)"/>'
    '<text x="300" y="180" text-anchor="middle" font-size="11" font-weight="bold" style="fill:var(--text)">En vrai, on combine les deux</text>'
    '<text x="300" y="200" text-anchor="middle" font-size="10" style="fill:var(--text-soft)">'
    'L’asymétrique (lent) sert à s’authentifier et à échanger une clé de session…</text>'
    '<text x="300" y="216" text-anchor="middle" font-size="10" style="fill:var(--text-soft)">'
    '…puis le symétrique (rapide) chiffre tout le trafic. C’est ce que fait TLS, comme le VPN.</text>'
    '</svg>')

SVG_SIGN = (
    '<svg viewBox="0 0 600 210" role="img" aria-label="La signature numérique : l’émetteur hache le '
    'message et chiffre le condensat avec sa clé privée ; le destinataire vérifie avec la clé publique" '
    'style="max-width:600px;width:100%;height:auto;margin:10px 0 14px;font-family:system-ui,sans-serif">'
    '<text x="150" y="18" text-anchor="middle" font-size="12" font-weight="bold" fill="#b45309">Émetteur — signer</text>'
    '<rect x="24" y="34" width="70" height="34" rx="6" fill="#0f766e"/>'
    '<text x="59" y="55" text-anchor="middle" font-size="10" fill="#fff">Message</text>'
    '<line x1="94" y1="51" x2="120" y2="51" stroke="#94a3b8" stroke-width="1.8"/>'
    '<rect x="120" y="34" width="66" height="34" rx="6" fill="#0891b2"/>'
    '<text x="153" y="50" text-anchor="middle" font-size="9.5" fill="#fff">Hachage</text>'
    '<text x="153" y="62" text-anchor="middle" font-size="8" fill="#cffafe">→ condensat</text>'
    '<line x1="153" y1="68" x2="153" y2="92" stroke="#94a3b8" stroke-width="1.8"/>'
    '<rect x="110" y="92" width="86" height="34" rx="6" fill="#5b21b6"/>'
    '<text x="153" y="108" text-anchor="middle" font-size="8.5" fill="#fff">chiffré avec</text>'
    '<text x="153" y="120" text-anchor="middle" font-size="8.5" fill="#fff">🔒 clé privée</text>'
    '<text x="153" y="146" text-anchor="middle" font-size="9" fill="#b45309" font-weight="bold">= la signature</text>'
    # envoi
    '<line x1="196" y1="109" x2="300" y2="109" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4 3"/>'
    '<text x="248" y="102" text-anchor="middle" font-size="8.5" fill="#b45309">message + signature + certificat</text>'
    # destinataire
    '<text x="450" y="18" text-anchor="middle" font-size="12" font-weight="bold" fill="#16a34a">Destinataire — vérifier</text>'
    '<rect x="310" y="34" width="86" height="34" rx="6" fill="#5b21b6"/>'
    '<text x="353" y="50" text-anchor="middle" font-size="8.5" fill="#fff">déchiffre avec</text>'
    '<text x="353" y="62" text-anchor="middle" font-size="8.5" fill="#fff">🔓 clé publique</text>'
    '<line x1="396" y1="51" x2="420" y2="51" stroke="#94a3b8" stroke-width="1.8"/>'
    '<rect x="420" y="34" width="76" height="34" rx="6" fill="#0891b2"/>'
    '<text x="458" y="50" text-anchor="middle" font-size="8.5" fill="#fff">condensat reçu</text>'
    '<text x="458" y="62" text-anchor="middle" font-size="8" fill="#cffafe">(Hash_émetteur)</text>'
    '<rect x="310" y="92" width="86" height="34" rx="6" fill="#0891b2"/>'
    '<text x="353" y="108" text-anchor="middle" font-size="8.5" fill="#fff">re-hache le</text>'
    '<text x="353" y="120" text-anchor="middle" font-size="8.5" fill="#fff">message reçu</text>'
    '<rect x="512" y="60" width="74" height="44" rx="8" fill="#16a34a"/>'
    '<text x="549" y="80" text-anchor="middle" font-size="10" fill="#fff" font-weight="bold">=</text>'
    '<text x="549" y="95" text-anchor="middle" font-size="8" fill="#dcfce7">identiques ?</text>'
    '<line x1="496" y1="51" x2="512" y2="72" stroke="#94a3b8" stroke-width="1.6"/>'
    '<line x1="396" y1="109" x2="512" y2="90" stroke="#94a3b8" stroke-width="1.6"/>'
    '<text x="300" y="168" text-anchor="middle" font-size="10" style="fill:var(--text-soft)">'
    'Si les deux condensats sont identiques : le message vient bien du détenteur de la clé privée (authenticité)</text>'
    '<text x="300" y="184" text-anchor="middle" font-size="10" style="fill:var(--text-soft)">'
    'et il n’a pas été modifié en route (intégrité). La clé publique est vouchée par un <tspan font-weight="bold">certificat</tspan>.</text>'
    '</svg>')


PAGE = '\n'.join([
    hero('Cours · Réseau', 'La cryptographie : chiffrer, hacher, signer',
         'Le socle de toute la sécurité réseau. Confidentialité, intégrité, authentification ; '
         'chiffrement symétrique et asymétrique ; hachage ; signature numérique ; certificats et '
         'autorités ; comment SSL/TLS assemble tout ça. Ce que supposent, sans le dire, le VPN, '
         'HTTPS, SSH et la PKI.'),
    STYLE,
    note('blue', '🎯 Pourquoi ce cours',
         'Un VPN « chiffre », HTTPS « sécurise », SSH utilise des « clés », un certificat est « signé '
         'par une autorité »… Ces mots reviennent partout. Ce cours pose une fois pour toutes ce '
         'qu’ils recouvrent, pour que les pages <a href="/pages/le-vpn">VPN</a>, '
         '<a href="/pages/linux-apache-virtualhosts">HTTPS</a>, <a href="/pages/linux-ssh">SSH</a> et '
         '<a href="/pages/pki-adcs">PKI</a> deviennent limpides.'),

    '<h2>1) Les trois objectifs : C, I, A</h2>',
    '<p>La cryptographie ne « cache » pas seulement des données. Elle sert trois buts distincts, '
    'qu’il faut savoir nommer séparément — car chaque outil n’en couvre pas les mêmes :</p>',
    tab(['Objectif', 'Ce qu’il garantit', 'L’outil'], [
        ['<strong>Confidentialité</strong>', 'Personne d’autre ne peut <em>lire</em> les données',
         'Le <strong>chiffrement</strong> (symétrique ou asymétrique)'],
        ['<strong>Intégrité</strong>', 'Les données n’ont pas été <em>modifiées</em> en route',
         'Le <strong>hachage</strong> (condensat)'],
        ['<strong>Authentification</strong>', 'On sait <em>à qui</em> on parle (personne, serveur)',
         'La <strong>signature</strong> et les <strong>certificats</strong>'],
    ]),
    qr('Un exemple quotidien ?',
       'La connexion à un site bancaire : les données sont <strong>chiffrées</strong> (personne ne '
       'lit le numéro de carte), le serveur est <strong>authentifié</strong> (c’est bien la banque, '
       'pas un imposteur), et les échanges sont protégés contre la <strong>modification</strong>. '
       'Les trois à la fois — c’est exactement ce que fait HTTPS.'),

    '<h2>2) Chiffrement symétrique et asymétrique</h2>',
    SVG_SYM_ASYM,
    '<p><strong>Chiffrer</strong>, c’est transformer une donnée lisible en donnée illisible ; seul '
    'qui possède la clé de déchiffrement retrouve l’original. Il en existe deux familles :</p>',
    tab(['', 'Symétrique', 'Asymétrique'], [
        ['Clé(s)', 'Une seule, partagée — elle chiffre <em>et</em> déchiffre',
         'Une <strong>paire</strong> : publique (diffusable) + privée (secrète)'],
        ['Vitesse', '<strong>Rapide</strong>, adapté aux gros volumes', 'Lent, gourmand en ressources'],
        ['Le problème qu’il pose', 'Comment échanger la clé sans qu’elle fuite ?',
         'Aucun secret à partager d’avance'],
        ['Ce qu’il permet en plus', '—', 'Authentification et <strong>signature</strong>'],
        ['Algorithmes', 'DES (ancien), 3DES, <strong>AES</strong> (standard), ChaCha20',
         '<strong>RSA</strong>, ECC (courbes elliptiques)'],
    ]),
    note('gray', '🔑 La règle des deux clés asymétriques',
         'Ce qu’une clé de la paire chiffre, <strong>seule l’autre</strong> le déchiffre. On '
         'l’exploite dans les <em>deux</em> sens : chiffrer avec la clé <strong>publique</strong> du '
         'destinataire → lui seul (avec sa privée) peut lire (confidentialité) ; chiffrer un '
         'condensat avec sa <em>propre</em> clé <strong>privée</strong> → tout le monde vérifie avec '
         'la publique que ça vient bien de soi (signature). Deux usages opposés, même mécanique.'),
    qr('Pourquoi ne pas tout faire en asymétrique, puisqu’il évite le partage de clé ?',
       'Parce qu’il est <strong>trop lent</strong> pour de gros volumes. La solution universelle : '
       'l’asymétrique sert à <em>s’authentifier et à convenir</em> d’une clé de session, puis on '
       'bascule sur du <strong>symétrique</strong> (rapide) pour chiffrer le reste. C’est le principe '
       'de TLS (§6) et de tous les VPN sérieux.'),

    '<h2>3) Le hachage : l’empreinte qui prouve l’intégrité</h2>',
    '<p>Une <strong>fonction de hachage</strong> transforme une donnée de taille quelconque (mot de '
    'passe, fichier, message) en une <strong>empreinte de taille fixe</strong> — le <em>hash</em> ou '
    '<em>condensat</em>. Elle a trois propriétés qui la rendent utile :</p>',
    bullets(
        '<strong>Déterministe</strong> : la même entrée donne toujours le même condensat.',
        '<strong>À sens unique</strong> : impossible de remonter de l’empreinte à la donnée.',
        '<strong>Effet d’avalanche</strong> : la moindre modification de l’entrée change '
        '<em>totalement</em> le condensat.',
    ),
    '<p>Vérifier l’intégrité d’un fichier : on transmet la donnée <em>et</em> son condensat, on '
    'recalcule le condensat à l’arrivée avec le même algorithme, et on compare. Identiques → rien '
    'n’a bougé.</p>',
    tab(['Algorithme', 'État', 'Remarque'], [
        ['MD5', '<strong>Obsolète</strong>', 'Collisions démontrées — ne plus utiliser pour la sécurité'],
        ['SHA-1', '<strong>Obsolète</strong>', 'Cassé en 2017, abandonné par les navigateurs'],
        ['SHA-256 / SHA-2', '<strong>Actuel</strong>', 'Le standard aujourd’hui (aussi SHA-384/512)'],
    ]),
    note('yellow', '⚠️ Hacher n’est pas chiffrer',
         'Un chiffrement se <em>déchiffre</em> (on récupère l’original) ; un hachage, <strong>non</strong> '
         '— c’est à sens unique. C’est justement pourquoi on stocke les mots de passe sous forme de '
         'condensats (salés) et non chiffrés : même volé, le fichier ne rend pas les mots de passe.'),

    '<h2>4) La signature numérique</h2>',
    SVG_SIGN,
    '<p>La signature répond à deux questions d’un coup : <em>qui</em> a émis ce message '
    '(authenticité), et <em>a-t-il été modifié</em> (intégrité) ? Elle combine hachage et chiffrement '
    'asymétrique, dans cet ordre :</p>',
    tab(['Étape', 'Qui', 'Action'], [
        ['1', 'Émetteur', 'Calcule le <strong>condensat</strong> du message (hachage)'],
        ['2', 'Émetteur', 'Chiffre ce condensat avec sa <strong>clé privée</strong> → c’est la <strong>signature</strong>'],
        ['3', 'Émetteur', 'Envoie le message + la signature (+ son certificat)'],
        ['4', 'Destinataire', 'Déchiffre la signature avec la <strong>clé publique</strong> de l’émetteur → obtient le condensat d’origine'],
        ['5', 'Destinataire', 'Re-hache le message reçu, et <strong>compare</strong> les deux condensats'],
    ]),
    qr('Que prouve l’égalité des deux condensats ?',
       'Deux choses. Que le message <strong>n’a pas changé</strong> (sinon le condensat recalculé '
       'différerait) — l’intégrité. Et que la signature a bien été produite avec la '
       '<strong>clé privée</strong> correspondant à la clé publique utilisée — donc par son '
       'détenteur — l’authenticité. Reste à être sûr que cette clé publique est bien celle de la '
       'bonne personne : c’est le rôle du certificat.'),

    '<h2>5) Certificats et autorités de certification</h2>',
    '<p>Une clé publique, seule, ne dit pas <em>à qui</em> elle appartient. Un attaquant pourrait '
    'présenter la sienne en se faisant passer pour la banque. Le <strong>certificat numérique</strong> '
    'résout ça : c’est un document électronique qui <strong>associe une identité à une clé '
    'publique</strong>, et que <strong>signe une autorité de confiance</strong> (CA, <em>Certificate '
    'Authority</em>).</p>',
    tab(['Un certificat contient', 'Rôle'], [
        ['La <strong>clé publique</strong>', 'Ce qu’on veut authentifier'],
        ['L’<strong>identité</strong> du propriétaire', 'Nom de domaine, organisation…'],
        ['L’<strong>autorité émettrice</strong> (CA)', 'Qui se porte garant'],
        ['Une <strong>période de validité</strong>', 'Début et fin — d’où l’importance de l’horloge'],
        ['La <strong>signature de la CA</strong>', 'La CA signe le tout avec <em>sa</em> clé privée'],
    ]),
    '<p>La confiance est <strong>transitive</strong> : le navigateur (ou l’OS) connaît d’avance les '
    'clés publiques des grandes CA (DigiCert, Let’s Encrypt…). Il vérifie la signature du certificat '
    'du serveur avec celle de la CA ; si elle est valable, il fait confiance à la clé publique '
    'qu’il contient. En entreprise, on est sa <em>propre</em> CA interne — voir '
    '<a href="/pages/pki-adcs">Certificats, PKI &amp; AD CS</a>.</p>',
    note('gray', '🔗 C’est la même chaîne partout',
         'Le VPN OpenVPN (une CA interne signe un certificat serveur et un par client), IPsec en '
         'mode RSA, HTTPS, le contrôleur de domaine, le RADIUS 802.1X… tous reposent sur cette même '
         'chaîne CA → certificat → signature. Comprendre le mécanisme une fois, c’est le comprendre '
         'partout.'),

    '<h2>6) SSL/TLS : tout assembler</h2>',
    '<p>SSL/TLS est le protocole qui sécurise les échanges entre un client et un serveur (le '
    '« S » de HTTP<strong>S</strong>, mais aussi la base d’OpenVPN, de LDAPS, du mail moderne…). '
    'Sa poignée de main (<em>handshake</em>) est l’exemple parfait de la combinaison de tout ce qui '
    'précède :</p>',
    tab(['Phase', 'Ce qui se passe', 'Outil employé'], [
        ['<strong>Authentifier le serveur</strong>',
         'Le serveur présente son <strong>certificat</strong> ; le client vérifie la signature de la CA',
         'Asymétrique + certificat'],
        ['<strong>Convenir d’une clé de session</strong>',
         'Client et serveur négocient une clé symétrique unique (souvent via Diffie-Hellman)',
         'Asymétrique'],
        ['<strong>Chiffrer les données</strong>',
         'Tout le reste de l’échange est chiffré avec cette clé de session',
         'Symétrique (rapide)'],
        ['<strong>Garantir l’intégrité</strong>',
         'Chaque bloc est accompagné d’un code d’authentification (HMAC / AEAD)',
         'Hachage'],
    ]),
    qr('Pourquoi combiner asymétrique et symétrique plutôt que l’un des deux ?',
       'Pour prendre le meilleur de chacun : l’asymétrique <strong>authentifie</strong> (le '
       'certificat) et permet de <strong>convenir d’une clé sans l’avoir partagée</strong> — mais il '
       'est lent ; le symétrique est <strong>rapide</strong> mais suppose une clé commune. On '
       'utilise donc l’asymétrique juste le temps d’établir une clé de session symétrique, puis '
       'celle-ci chiffre tout le trafic. C’est aussi ce que fait un VPN.'),

    '<h2>7) Où l’on retrouve tout ça sur le site</h2>',
    acc(
        ('Le VPN', '<p>IPsec, OpenVPN et WireGuard reposent tous sur ce socle : chiffrement '
         'symétrique pour le trafic (AES-GCM, ChaCha20), asymétrique + certificats pour '
         's’authentifier, hachage pour l’intégrité. Voir <a href="/pages/le-vpn">Le VPN — '
         'comprendre</a> et <a href="/pages/vpn-site-a-site">le site-à-site (IPsec)</a>.</p>'),
        ('HTTPS et les hôtes virtuels', '<p>Un certificat serveur, une clé privée, la poignée de '
         'main TLS : <a href="/pages/linux-apache-virtualhosts">Apache — hôtes virtuels &amp; '
         'HTTPS</a>.</p>'),
        ('SSH', '<p>SSH utilise une paire de clés asymétriques pour authentifier le poste, puis un '
         'chiffrement symétrique de session — exactement le schéma du §6 : '
         '<a href="/pages/linux-ssh">SSH serveur sous Linux</a> et '
         '<a href="/pages/tp-ssh-securisation">TP — sécuriser SSH</a>.</p>'),
        ('La PKI', '<p>Émettre, signer et révoquer les certificats d’une organisation : '
         '<a href="/pages/pki-adcs">Certificats, PKI &amp; AD CS</a>.</p>'),
    ),

    retenir(
        'Trois objectifs à ne pas confondre : <strong>confidentialité</strong> (chiffrement), '
        '<strong>intégrité</strong> (hachage), <strong>authentification</strong> (signature + '
        'certificats).',
        '<strong>Symétrique</strong> = une clé partagée, rapide ; <strong>asymétrique</strong> = '
        'une paire publique/privée, lent mais règle le partage de clé et permet la signature.',
        'Le <strong>hachage</strong> est à sens unique : il prouve l’intégrité, il ne se déchiffre '
        'pas. MD5 et SHA-1 sont morts, SHA-256 est le standard.',
        'Une <strong>signature</strong> = un condensat chiffré avec la clé privée ; on la vérifie '
        'avec la clé publique. Le <strong>certificat</strong>, signé par une CA, garantit à qui '
        'appartient cette clé publique.',
        '<strong>TLS</strong> (et le VPN) combinent tout : asymétrique pour authentifier et échanger '
        'une clé de session, symétrique pour chiffrer vite, hachage pour l’intégrité.',
    ),
    note('green', '➡️ Pour aller plus loin',
         '<a href="/pages/pki-adcs">Certificats, PKI &amp; AD CS</a> · '
         '<a href="/pages/le-vpn">Le VPN — comprendre</a> · '
         '<a href="/pages/vpn-site-a-site">IPsec site-à-site (PSK, RSA, IKE)</a> · '
         '<a href="/pages/mfa-acces-conditionnel">MFA &amp; accès conditionnel</a>.'),
])

EXTRAIT = ('Confidentialité, intégrité, authentification ; chiffrement symétrique (AES) et '
           'asymétrique (RSA/ECC) ; hachage (SHA-256) ; signature numérique ; certificats et '
           'autorités ; la poignée de main SSL/TLS qui assemble le tout.')
DESCRIPTION = ('Le socle : C-I-A, chiffrement symétrique/asymétrique, hachage, signature, '
               'certificats et SSL/TLS — ce que supposent le VPN, HTTPS, SSH et la PKI.')

PAGES = [('la-cryptographie', 'La cryptographie : chiffrer, hacher, signer',
          EXTRAIT, PAGE, SG, DESCRIPTION)]


if __name__ == '__main__':
    publier_lot(PAGES, RESEAU)
    sys.exit(0)
