// Harnais : génère les scripts du configurateur duo web + base pour les jouer dans des conteneurs.
import { writeFileSync } from 'node:fs';
import { genererScripts, type Params } from '../client/src/lib/web-db-scripts';

const p: Params = {
  hv: 'hyperv', master: 'master-debian', masterId: '9000', exportPath: 'C:\TEMP', vhdDir: 'C:\Hyper-V\VHDs', sw: 'COM_private', copierFichiers: true,
  vmWeb: 'SRV_WEB_01', vmBdd: 'SRV_BDD_01', idWeb: '201', idBdd: '202', vcpu: '2', ram: '2',
  ipWeb: process.env.IP_WEB || '192.168.10.21', ipBdd: process.env.IP_BDD || '192.168.10.22', cidr: '24', passerelle: process.env.GW || '192.168.10.254', dns: process.env.GW || '192.168.10.254', iface: '',
  bdd: 'appdb', utilisateur: 'appuser', nodeSource: false, mdpSysteme: true,
};
const dir = process.argv[2] || '.smoke-webdb';
for (const s of genererScripts(p)) writeFileSync(`${dir}/${s.fichier}`, s.code.replace(/\r\n/g, '\n') + '\n');
console.log('scripts écrits dans', dir);
