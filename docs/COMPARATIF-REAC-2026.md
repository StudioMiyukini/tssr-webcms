# Comparatif tssr.miyukini.com ↔ REAC TSSR 2026

*Établi le 14/09/2026. Référentiels comparés : REAC TP-01351 millésime 03 (validé le 22/06/2026, RNCP 42463, en vigueur depuis le 01/09/2026, réexamen prévu le 31/08/2031) et RE V03 (JO du 19/06/2026). Sources : banque.di.afpa.fr, francecompetences.fr. Inventaire du site au 14/09/2026 : 89 cours, 58 procédures, 16 TP corrigés, 89 quiz, 14 jeux et exercices, une trentaine d’outils et pages annexes (308 pages publiées).*

## 1. Ce qui a changé dans le référentiel

| | Ancien REAC (RNCP 37682, 2023) | REAC 2026 (RNCP 42463) |
|---|---|---|
| Activités types / CCP | 2 | **3** — 1. Support · 2. Exploiter · 3. Maintenir en conditions opérationnelles |
| Compétences | 9 | **10** |
| Nouveautés explicites | — | **IA** (CP1 : exploiter et encadrer ; CP8 : optimiser des scripts), **environnement hybride / Entra ID / MFA / Zero Trust** (CP7), **continuité & reprise (PRI/PCI)** (CP9), **supervision & mises à jour** (CP10), **outils collaboratifs & déploiement d'équipements** (CP2), **accessibilité / handicap, sobriété numérique, DEEE, ergonomie** (transverses) |
| Recul assumé | — | La **téléphonie sur IP** n'est plus une mission centrale (remplacée par les usages collaboratifs) |
| Épreuve (session complète) | 5 h 35 | **7 h 00** : mise en situation 4 h 45 (3 h 30 de manipulations + 15 min de préparation + **30 min de présentation orale de sa production** + **30 min d'incident réseau résolu devant le jury**), entretien technique 30 min, questionnaire professionnel 1 h 30 (dont **au moins une question en anglais**), entretien final 15 min |

Le site a été construit sur la logique de l'ancien référentiel (domaines techniques Hardware / Windows / Réseau / Linux / Cisco). Il reste très solide sur le socle technique de l'activité 2 ; les écarts se concentrent sur les **nouvelles compétences transverses** (IA, hybride/cloud, continuité, supervision, support « métier ») et sur quelques **mentions périmées** de l'ancien titre.

## 2. Couverture compétence par compétence

Légende : ✅ couvert · 🟠 partiel · 🔴 absent. Les slugs renvoient aux pages du site.

### AT1 — Assurer le support aux utilisateurs

**CP1 · Exploiter l'intelligence artificielle et encadrer son usage — 🔴 absent**
Aucune page ne traite de l'IA (diagnostic assisté, analyse de journaux, évaluation critique des résultats, prompts), ni du cadre RGPD / CNIL / IA Act, ni de la sensibilisation des utilisateurs (biais, désinformation, fuite de données), ni des impacts énergétiques de l'IA. C'est la compétence n° 1 du nouveau titre : trou principal.

**CP2 · Assurer le déploiement des équipements numériques et accompagner à l'utilisation des outils collaboratifs — 🟠 partiel**
- Couvert : préparation d'un poste (`procedure-vm-hyperv`, `procedure-renommer-poste`, `procedure-ip-fixe-windows`, `configurateur-vm`, `script-config-vm`), durcissement (`procedure-securite-poste`), inventaire (`procedure-glpi`, installation seulement), hardware (`hardware`, `carte-mere`…).
- Absent : **déploiement automatisé d'images système** (WDS/MDT, Clonezilla, Autopilot/Intune, sysprep) — savoir-faire explicite ; **outils collaboratifs** (Microsoft 365 / Teams / SharePoint / Google Workspace : configuration, prise en main) — zéro page ; **profils utilisateurs sur poste** ; **maintenance matérielle de premier niveau** (remplacement disque/RAM, procédure) ; **gestion du parc et DEEE / fin de vie / sobriété numérique** ; **ergonomie du poste, prévention des TMS** ; **accessibilité numérique / handicap** (outils d'accessibilité Windows).

**CP3 · Apporter une assistance technique — 🟠 partiel**
- Couvert : `le-ticketing` (cycle de vie, priorités, GLPI), `depannage`, `procedure-test-connectivite`, `diagnostic-reseau`, jeu `jeu-incidents-tssr`, `procedure-glpi`.
- Absent ou trop court : **ITIL** comme cadre (incident / demande / problème / escalade / SLA — une seule mention) ; **prise en main à distance sécurisée** (Assistance rapide, TeamViewer/AnyDesk, bonnes pratiques) — seul RDP est traité ; **sensibilisation des utilisateurs** (hameçonnage, MFA, supports amovibles, mots de passe) comme contenu à part entière ; **techniques de reformulation / communication adaptée** (y compris handicap) ; **compte rendu d'intervention** (modèle).

### AT2 — Exploiter les éléments de l'infrastructure

**CP4 · Exploiter un réseau IP — ✅ couvert (le point fort du site)**
- Couvert : adressage/subnetting (7 cours + outils), VLAN (4 cours, 3 TP, procédures), ACL, NAT/PAT, routes statiques, VPN (`le-vpn`, `opnsense-vpn-ids` : nomade et site-à-site), pare-feu (`le-pare-feu`, série OPNsense 5 volets + 3 TP), DMZ (3 volets), Wireshark, supervision (notion), schémas d'infrastructure, RADIUS/802.1X.
- Manques ponctuels : **routage dynamique** (OSPF/RIP : mentionné, pas de cours/procédure) ; **Wi-Fi d'entreprise** (WPA2/WPA3-Enterprise, SSID multiples, sécurisation — pas de page dédiée) ; **proxy / antivirus / anti-spam** comme protection d'accès Internet (Squid n'apparaît qu'en TP) ; **recommandations ANSSI** (jamais citées) ; **maintenance des équipements actifs** (mise à jour de firmware, sauvegarde de configuration de switch/routeur hors `copy run start`) ; QoS (notion seulement, acceptable au niveau visé).

**CP5 · Installer et assurer l'exploitation de serveurs Windows et Linux — ✅ couvert, sauf le volet Entra ID**
- Couvert : Windows Server (rôles, gestionnaire, AD installation/objets/AGDLP/GPO/profils/lecteurs/DFS/DHCP failover/DNS redondance/IIS/sauvegarde AD), Linux complet (17 cours, 16 procédures/TP : Debian, Rocky, services, systemd, cron, SSH, Apache, Samba, ProFTPd, BIND9), LDAP et Kerberos (pages dédiées).
- Absent : **Entra ID** (création de comptes, synchronisation des identités AD ↔ Entra ID via Entra Connect, relations AD/Entra) — cité trois fois dans la CP5 et absent du site ; **charte de sécurité informatique / PSSI** (politique de mots de passe existe via GPO, pas la charte) ; **SLA** (une page `serveur-fichiers-niveaux-sla`, notion à généraliser).

**CP6 · Exploiter des serveurs dans une infrastructure virtualisée — 🟠 partiel**
- Couvert : Hyper-V (théorie, `virtualisation`, `procedure-vm-hyperv`, `procedure-hyperv-ressources`, TP2), IaaS/PaaS/SaaS et conteneurs (une section de `virtualisation-theorie`), snapshots vs sauvegardes.
- Absent : **outil de gestion centralisée** (vCenter, Proxmox cluster, Hyper-V Manager multi-hôtes / SCVMM) pour surveiller ressources et performances ; **stockage cloud** et **offres des opérateurs** (Azure, AWS, OVH, Scaleway) ; **datacenter** (énergie, refroidissement, accès, risques physiques) ; **conteneurs** au-delà de la définition (un Docker « hello world » suffirait) ; **bases de cybersécurité** (gestion des risques, vulnérabilités, conformité).

**CP7 · Gérer les accès et la sécurité dans un environnement hybride — 🟠 partiel (fort sur site, absent côté cloud)**
- Couvert : AD (comptes, groupes, AGDLP, délégation, moindre privilège), filtrage IP (OPNsense, ACL Cisco, pare-feu Windows), DMZ (3 volets + TP), journalisation/IDS (OPNsense volet 5, DMZ volet 3), expiration de comptes, PKI de base (certificats auto-signés IIS/Apache, TLS).
- Absent : **Entra ID / Microsoft 365** (administration), **MFA**, **accès conditionnel**, **SSO / authentification fédérée**, **Zero Trust / IAM** (termes jamais définis), **cycle de vie des comptes** (procédure onboarding/offboarding), **PKI d'entreprise** (AD CS : autorité, émission, révocation), **gestion cloud du réseau** (Meraki, UniFi, Aruba Central), **PSSI / rôle du RSSI / ANSSI**.

### AT3 — Maintenir en conditions opérationnelles l'infrastructure

**CP8 · Optimiser des scripts à l'aide de l'intelligence artificielle — 🟠 partiel (Bash oui, PowerShell léger, IA absente)**
- Couvert : `linux-bash` (mode strict, arguments, tests, boucles, fonctions), `linux-cron-logs` + procédure, `cmd-et-powershell` (bases, pipeline, exécuter un .ps1), snippets PowerShell AD (`procedure-ad-objets`, `constructeur-ad`).
- Absent : **cours « scripts PowerShell »** structuré (variables, paramètres, structures de contrôle, fonctions, modules AD, planification par le Planificateur de tâches) ; **IA appliquée aux scripts** (analyser un script existant, concevoir un prompt contextualisé, faire proposer une optimisation, tester, documenter) ; **adapter un script d'éditeur** ; **gestion des versions** (Git n'est cité qu'en passant).

**CP9 · Assurer la continuité et la reprise de l'infrastructure — 🟠 partiel**
- Couvert : `procedure-sauvegarde` (3-2-1, complète/incrémentielle/différentielle, Windows Server Backup, test de restauration), `procedure-sauvegarde-ad` (état système, corbeille AD, DSRM), haute disponibilité par service (DHCP failover, DNS redondance, DFS-R, RAID), `dmz-surveillance-entretien` (sauvegardes tirées, restauration d'essai annuelle), sauvegarde de configuration OPNsense.
- Absent : **PRI / PCI (PRA / PCA)** comme plans — RTO/RPO, scénarios, simulation de continuité, tests de reprise d'exploitation ; **sauvegarde des machines virtuelles** (export/réplication Hyper-V, Veeam) ; **sauvegarde Linux** (rsync, restic/Borg, procédure) ; **sauvegarde de bases de données** ; **supports et classification** (on-line/off-line, rotation, bande, immuable) ; **gestion des espaces de stockage de sauvegarde** ; **veille sur les solutions du marché**.

**CP10 · Mettre à jour et superviser les éléments de l'infrastructure — 🟠 partiel**
- Couvert : `supervision` (états, seuils, sondes, SNMP, outils — 2 Ko), `dmz-surveillance-entretien` (journaux, IDS, sondes, scan d'exposition, calendrier), mises à jour ponctuelles (apt, OPNsense firmware, WSUS cité dans les GPO courantes).
- Absent : **procédure de supervision** (installer Zabbix/Centreon/Prometheus + Grafana, agent, sonde, seuil, alerte, tableau de bord, KPI) ; **gestion des mises à jour Windows** (WSUS/Windows Update for Business, anneaux, fenêtres de maintenance) ; **gestion des vulnérabilités** (CVE, CERT-FR, priorisation des correctifs) ; **mises à jour des équipements réseau et de la virtualisation** ; **planification des maintenances** et communication d'interruption.

### Compétences transversales

| Compétence | Statut | Constat |
|---|---|---|
| Communiquer | 🟠 | Anglais professionnel ✅ ; reformulation, adaptation au handicap, **compte rendu d'intervention**, documents d'exploitation : pas de page méthode |
| Mettre en œuvre une démarche de résolution de problème | ✅ | `depannage`, `procedure-test-connectivite`, `diagnostic-reseau`, `jeu-incidents-tssr`, dépannage intégré aux cours |
| Apprendre en continu | 🟠 | La veille est citée partout mais n'a pas de page (sources : ANSSI, CERT-FR, flux, communautés, IA comme outil de veille) |

## 3. Divergences avec le référentiel en vigueur

1. **Code RNCP périmé** : le glossaire affiche « RNCP 37682 » (codé en dur dans `client/src/components/Glossary.tsx`) → 42463.
2. **Épreuve d'anglais décrite selon l'ancien RE** (`anglais-professionnel` : « épreuve écrite intégrée au cas pratique » + « présentation orale de 3 à 5 minutes ») : en 2026, l'anglais est évalué par **au moins une question du questionnaire professionnel** (compréhension d'une documentation ou question technique) ; l'oral de la mise en situation est une **présentation en français de sa production** (30 min), suivie d'un **incident réseau résolu en direct devant le jury** (30 min).
3. **Structure en 2 CCP** encore mentionnée (`supervision` : « CCP2 TSSR ») → la supervision relève désormais du CCP3 « Maintenir en conditions opérationnelles ».
4. **Navigation par domaine technique, sans lecture REAC** : rien ne relie les pages aux 3 activités / 10 compétences ; un apprenant ne peut pas vérifier sa couverture du référentiel.
5. **ToIP** : `vlan-voix` reste pertinent comme cas VLAN, mais le REAC 2026 acte le recul de la téléphonie IP au profit des outils collaboratifs — que le site ne traite pas.
6. **Déploiement des postes** : l'ancienne compétence « services de déploiement des postes de travail » (WDS/MDT) n'a jamais été couverte, et sa version 2026 (images automatisées, Autopilot/Intune) ne l'est pas non plus.
7. **Préparation aux nouvelles modalités d'épreuve** : le site prépare bien les manipulations, pas la **présentation orale d'une production** (captures, déroulé, résultats) ni la **résolution d'incident en direct** ; `tp1-presentation-cybercafe` est un exercice d'exposé, pas la restitution d'une mise en situation.

## 4. Priorités proposées

| Priorité | Manque | Contenu proposé |
|---|---|---|
| **P1** | CP1 IA (compétence entière) | Cours « L'IA au service du technicien » (diagnostic assisté, analyse de journaux, évaluer/valider une réponse, prompts contextualisés, confidentialité, RGPD/CNIL/IA Act, sobriété) + cours « Sensibiliser les utilisateurs à l'IA » + TP « Diagnostiquer avec un assistant IA » + quiz |
| **P1** | CP8 scripts + IA | Cours « Scripts PowerShell » (structuré comme `linux-bash`) + procédure « Planifier une tâche Windows » + TP « Optimiser un script avec l'IA » (Bash et PowerShell, prompt, test, documentation, versions) |
| **P1** | CP7 hybride | Cours « Entra ID et Microsoft 365 » (comptes, groupes, synchronisation Entra Connect, MFA, accès conditionnel, SSO) + notions « Zero Trust, IAM, PSSI/RSSI, ANSSI » + procédure « Cycle de vie d'un compte » |
| **P1** | Modalités d'épreuve 2026 | Page « L'examen TSSR 2026 » (session complète et par CCP, durées, phases) + méthode « Présenter sa production » + entraînement « Incident réseau devant le jury » ; corriger `anglais-professionnel`, `supervision`, le code RNCP |
| **P2** | CP9 continuité | Cours « PRA / PCA : continuité et reprise » (RTO/RPO, scénarios, tests) + procédures « Sauvegarder une VM Hyper-V », « Sauvegarder un serveur Linux (rsync/restic) », « Sauvegarder une base de données » ; supports on-line/off-line, immuabilité |
| **P2** | CP10 supervision & MAJ | Procédure « Installer Zabbix (ou Centreon) et superviser un serveur » + cours « Gérer les mises à jour » (WSUS/WUfB, apt, firmware, fenêtres de maintenance, CVE/CERT-FR) |
| **P2** | CP2 déploiement & collaboratif | Procédure « Déployer une image Windows » (MDT/WDS ou Clonezilla, sysprep) + cours « Microsoft 365 / Teams pour le support » + fiche « Maintenance matérielle de 1er niveau » + fiches « DEEE et fin de vie », « Ergonomie et TMS », « Accessibilité Windows » |
| **P2** | CP3 support | Cours « ITIL pour le support » (incident/demande/problème/escalade/SLA) + procédure « Prise en main à distance sécurisée » + cours « Sensibiliser les utilisateurs » (hameçonnage, MFA, USB) + modèle « Compte rendu d'intervention » |
| **P3** | CP6 virtualisation/cloud | Cours « Gérer plusieurs hôtes » (Proxmox ou vCenter : cluster, ressources, performances) + « Premiers pas cloud » (une VM chez un fournisseur, stockage objet) + « Docker en 30 minutes » + fiche « Le datacenter » |
| **P3** | CP4 compléments | Cours « OSPF en 3 routeurs (Packet Tracer) », « Wi-Fi d'entreprise (WPA-Enterprise + RADIUS) », « Proxy Squid et filtrage web » ; citer les guides ANSSI |
| **P3** | Transversal | Page « Parcours REAC » (carte activités → compétences → pages du site, avec taux de couverture) + page « Organiser sa veille » + modèle de documentation d'exploitation |

## 5. Bilan chiffré

| | Compétences | ✅ | 🟠 | 🔴 |
|---|---|---|---|---|
| AT1 Support | 3 | 0 | 2 | 1 |
| AT2 Exploiter | 4 | 2 | 2 | 0 |
| AT3 Maintenir | 3 | 0 | 3 | 0 |
| Transversales | 3 | 1 | 2 | 0 |
| **Total** | **13** | **3** | **9** | **1** |

Le socle technique (réseau, Windows/AD, Linux, virtualisation Hyper-V, pare-feu) est au-dessus du niveau attendu. Ce qui manque est presque entièrement ce que le millésime 2026 a ajouté : l'IA, le cloud/hybride, la continuité formalisée, la supervision outillée, et la dimension « métier » du support (ITIL, collaboratif, accessibilité, sobriété).

---

## Suivi — réalisé le 14/09/2026

Les 39 cours du plan P1→P3 sont publiés, les pages survolées garnies et les mentions périmées corrigées (scripts `scripts/ia.py`, `hybride.py`, `powershell.py`, `examen.py`, `continuite.py`, `supervision.py`, `poste.py`, `support.py`, `reseau_complements.py`, socle `scripts/_cours.py`). L'index des cours passe de 89 à 128 cours dans 11 catégories.

| Chantier | Pages | Placement |
|---|---|---|
| IA (CP1, CP8) | `ia-technicien`, `ia-encadrer`, `ia-scripts` | Catégorie neuve **Intelligence artificielle** |
| Identité hybride, cloud (CP5, CP6, CP7) | `entra-id`, `mfa-acces-conditionnel`, `cycle-vie-compte`, `zero-trust-iam`, `pki-adcs`, `cloud-premiers-pas`, `datacenter` | Catégorie neuve **Cloud & identité hybride** |
| Virtualisation (CP6) | `docker-30-minutes`, `proxmox-multi-hotes` | Software › Virtualisation |
| Scripts Windows (CP8) | `scripts-powershell`, `planificateur-taches-windows` | Software › Administration Windows |
| Le titre et ses épreuves | `examen-tssr-2026`, `parcours-reac`, `presenter-sa-production`, `incident-devant-le-jury`, `organiser-sa-veille`, `compte-rendu-intervention` | Catégorie neuve **Le titre TSSR** |
| Continuité (CP9) | `pra-pca`, `sauvegarde-vm-hyperv`, `sauvegarde-linux`, `sauvegarde-bases-donnees` | Maintenance › Continuité & sauvegardes (neuf) |
| MAJ & supervision (CP10) | `supervision` (réécrit, 4 → 16 Ko), `installer-zabbix`, `gerer-mises-a-jour`, `gestion-vulnerabilites` | Maintenance › Supervision & mises à jour (neuf) |
| Déploiement (CP2) | `deployer-image-windows`, `microsoft-365-teams`, `maintenance-materielle-niveau-1` | Software › Déploiement & poste de travail (neuf) |
| Environnement de travail | `accessibilite-windows`, `ergonomie-tms`, `deee-sobriete` | Maintenance › Environnement de travail & responsabilité (neuf) |
| Support (CP3) | `itil-support`, `prise-en-main-distance`, `sensibiliser-utilisateurs` (+ renvoi dans `le-ticketing`) | Maintenance › Méthode & support |
| Compléments réseau (CP4) | `ospf` (Cisco › Routeurs), `wifi-entreprise` (Réseau › Équipements), `proxy-squid` (Réseau › Sécurité & accès distant) | |

Corrections : section « Les épreuves TSSR » de `anglais-professionnel` réécrite selon le RE V03 (question en anglais au questionnaire, plus d'oral en anglais) ; `supervision` et `quiz-supervision` ne parlent plus de « CCP2 » ; badge du glossaire `RNCP 37682` → `RNCP 42463` (client rebuildé).

Reste optionnel : des quiz `scripts/quiz-data/<slug>.json` pour les 39 nouveaux cours (puis `npx tsx scripts/seed-activites-local.ts`).
