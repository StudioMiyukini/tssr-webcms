/** Îlot « configurateur pfSense » (data-block="pfsense-configurator"). */
import { FirewallConfigurator } from './FirewallConfigurator';

/*
 * @id     tssr.atelier.pfsenseConfigurator
 * @do     configurer_pfsense
 * @role   ui
 * @layer  ui
 * @human  Atelier : plan de configuration pfSense + config.xml par zone.
 */
export function PfsenseConfigurator() {
  return <FirewallConfigurator variante="pfsense" />;
}
