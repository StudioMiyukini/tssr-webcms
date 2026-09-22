// Harnais : génère les scripts du configurateur duo web + base pour les jouer dans des conteneurs.
import { writeFileSync } from 'node:fs';
import { genererScripts, type Params } from '../client/src/lib/web-db-scripts';

const p: Params = {
  hv: 'hyperv', master: 'master-debian', masterId: '9000', exportPath: 'C:\TEMP', vhdDir: 'C:\Hyper-V\VHDs', sw: 'COM_private', copierFichiers: true,
  vmWeb: 'SRV_WEB_01', vmBdd: 'SRV_BDD_01', idWeb: '201', idBdd: '202', vcpu: '2', ram: '2',
  ipWeb: process.env.IP_WEB || '192.168.30.5', cidrWeb: '24', gwWeb: process.env.GW || '192.168.30.254', dnsWeb: process.env.GW || '192.168.30.254',
  ipBdd: process.env.IP_BDD || '192.168.20.5', cidrBdd: '24', gwBdd: process.env.GW || '192.168.20.254', dnsBdd: process.env.GW || '192.168.20.254', iface: '',
  bdd: 'appdb', utilisateur: 'appuser', nodeSource: false, mdpSysteme: true,
  mail: process.env.MAIL !== '0', vmMail: 'SRV_MAIL_01', idMail: '203', ipMail: process.env.IP_MAIL || '192.168.10.5', cidrMail: '24', gwMail: process.env.GW || '192.168.10.254', dnsMail: process.env.GW || '192.168.10.254',
  domaineMail: 'entreprise.lan', boites: 'alice, bob',
  glpi: process.env.GLPI !== '0',
};
const dir = process.argv[2] || '.smoke-webdb';
for (const s of genererScripts(p)) writeFileSync(`${dir}/${s.fichier}`, s.code.replace(/\r\n/g, '\n') + '\n');
console.log('scripts écrits dans', dir);
