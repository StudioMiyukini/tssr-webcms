// Harnais : génère les scripts du configurateur bastion pour les jouer dans des conteneurs.
import { readFileSync, writeFileSync } from 'node:fs';
import { genererScriptsBastion, type ParamsBastion } from '../client/src/lib/bastion-scripts';

const dir = process.argv[2] || '.smoke-bastion';
let cle = '';
try { cle = readFileSync(`${dir}/id_test.pub`, 'utf8').trim(); } catch { /* pas de cle */ }
const p: ParamsBastion = {
  hv: 'hyperv', master: 'master-debian', masterId: '9000', exportPath: 'C:\TEMP', vhdDir: 'C:\Hyper-V\VHDs', sw: 'COM_private', copierFichiers: true,
  vm: 'SRV_BASTION_01', id: '204', ip: process.env.IP_BASTION || '192.168.40.5', cidr: '24', gw: process.env.GW || '192.168.40.254', dns: process.env.GW || '192.168.40.254', iface: '',
  port: process.env.PORT_SSH || '22',
  admins: `jean ${cle}\nmarie`,
  cibles: `srv-web-01 ${process.env.IP_WEB || '192.168.30.5'}\nsrv-bdd-01 ${process.env.IP_BDD || '192.168.20.5'}`,
  auth: (process.env.AUTH as 'mdp' | 'cle' | 'les-deux') || 'cle', genererCles: process.env.GEN === '1', mfa: false, fail2ban: true, mdpSysteme: true,
};
for (const s of genererScriptsBastion(p)) writeFileSync(`${dir}/${s.fichier}`, s.code.replace(/\r\n/g, '\n') + '\n');
console.log('scripts écrits dans', dir);
