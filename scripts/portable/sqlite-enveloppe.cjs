/* Enveloppe de better-sqlite3 pour l'exécutable autonome.

   Le module natif ne peut pas être chargé depuis le système de fichiers virtuel
   du paquet : le chargeur du système d'exploitation veut un vrai fichier. Le
   lanceur en dépose donc une copie sur le disque et en donne le chemin ici.

   La recherche habituelle (« bindings ») est ainsi court-circuitée : c'est elle
   qui échoue une fois l'application empaquetée. Hors paquet, la variable est
   absente et better-sqlite3 reprend son comportement normal.

   __REEL__ est remplacé par le chemin absolu du vrai module au moment de la
   construction (scripts/build-exe.mjs) : écrit en clair, « better-sqlite3/… »
   serait repris par l'alias qui mène ici, et l'enveloppe s'appellerait elle-même. */
const Reel = require('__REEL__');

class Base extends Reel {
  constructor(fichier, options) {
    const nativeBinding = process.env.TSSR_SQLITE_NODE || undefined;
    super(fichier, nativeBinding ? { ...(options || {}), nativeBinding } : options);
  }
}

module.exports = Base;
