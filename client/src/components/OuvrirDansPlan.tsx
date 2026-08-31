import { useMemo, useState } from 'react';
import type { Ctx, Plan } from './NetworkWorkshop';
import {
  versDocumentPlan, urlDeTransfert, LIMITE_URL, encoderPourUrl,
  type EntreeTopologie, type InterfaceResolue,
} from '@/lib/vers-plan';

/*
 * @id      tssr.atelier.ouvrirDansPlan
 * @do      transferer_le_schema_vers_plan
 * @role    ui
 * @layer   ui
 * @human   Envoie la topologie de l'atelier vers plan.miyukini.org, pour la
 *          continuer sur une toile infinie.
 *
 * DEUX CHEMINS, PARCE QU'UN SEUL NE SUFFIT PAS.
 * Le lien direct passe le schéma dans le fragment de l'URL : rien ne part au
 * serveur, aucun compte n'est demandé, un clic suffit. Mais un fragment a une
 * longueur praticable limitée, et une topologie fournie la dépasse. Le fichier
 * n'a pas cette limite et s'importe par le bouton « Importer » de Plan.
 *
 * On ne cache donc pas le second derrière le premier : les deux sont visibles,
 * et le lien direct se désactive de lui-même quand la charge est trop lourde,
 * en disant pourquoi.
 */

const BASE_PLAN = 'https://plan.miyukini.org';

const ipToStr = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');

export function OuvrirDansPlan({ ctx, plan }: { ctx: Ctx; plan: Plan }) {
  const [dit, setDit] = useState('');

  const { enveloppe, url, poids } = useMemo(() => {
    // Les interfaces telles que le moteur les a résolues : c'est ce qui fait la
    // différence entre un schéma de câblage et un schéma d'adressage.
    const interfaces: InterfaceResolue[] = (plan.ifaces ?? []).map((i) => ({
      routerId: i.routerId,
      iface: i.iface,
      ip: ipToStr(i.ip),
      cidr: i.cidr,
      vlan: i.vlan,
      role: i.role,
    }));

    const entree: EntreeTopologie = {
      materiels: ctx.materiels ?? [],
      cables: ctx.cables ?? [],
      positions: ctx.physPos ?? {},
      interfaces,
      titre: ctx.entreprise ? `Réseau ${ctx.entreprise}` : 'Schéma réseau',
    };

    const env = versDocumentPlan(entree);
    return { enveloppe: env, url: urlDeTransfert(BASE_PLAN, env), poids: encoderPourUrl(env).length };
  }, [ctx, plan]);

  const vide = enveloppe.document.noeuds.length === 0;

  const telecharger = () => {
    const blob = new Blob([JSON.stringify(enveloppe, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(ctx.entreprise || 'schema').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-reseau.json`;
    a.click();
    // Sans révocation, l'objet reste en mémoire pour la durée de la page.
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
    setDit('Fichier téléchargé. Dans Plan : bouton « Importer ».');
  };

  return (
    <div style={{
      marginTop: 12, padding: '12px 14px', border: '1px solid var(--border)',
      borderRadius: 10, background: 'var(--surface-2, var(--surface))',
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <strong style={{ fontSize: 13 }}>🗺️ Continuer le schéma dans Plan</strong>
        <span className="meta" style={{ fontSize: 11.5 }}>
          {enveloppe.document.noeuds.length} équipement(s), {enveloppe.document.liens.length} lien(s)
        </span>
      </div>

      <p className="meta" style={{ fontSize: 11.5, margin: '6px 0 10px' }}>
        Les équipements, les câbles et les adresses déjà calculées partent sur une toile infinie : on y ajoute
        les annotations, les sites distants, ce que l'atelier ne modélise pas. Aucun compte n'est nécessaire — le
        schéma reste dans votre navigateur.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <a
          href={url ?? undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!url || vide}
          onClick={(e) => { if (!url || vide) e.preventDefault(); }}
          className="btn"
          style={{
            pointerEvents: !url || vide ? 'none' : undefined,
            opacity: !url || vide ? 0.45 : 1,
          }}
        >
          Ouvrir dans Plan ↗
        </a>
        <button type="button" className="btn secondary" onClick={telecharger} disabled={vide}>
          Télécharger le schéma (.json)
        </button>
      </div>

      {vide && (
        <p className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>
          Ajoutez au moins un équipement dans l'inventaire ci-dessus pour pouvoir exporter.
        </p>
      )}

      {!vide && !url && (
        <p className="meta" style={{ fontSize: 11.5, marginTop: 8, color: 'var(--warning, #b45309)' }}>
          Cette topologie pèse {Math.round(poids / 1024)} Ko une fois encodée, au-delà des {Math.round(LIMITE_URL / 1024)} Ko
          qu'une URL transporte sans risque d'être tronquée. Passez par le fichier : le résultat est identique.
        </p>
      )}

      {dit && <p className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>{dit}</p>}
    </div>
  );
}
