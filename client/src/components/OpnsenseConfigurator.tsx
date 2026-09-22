/** Îlot « configurateur OPNsense » (data-block="opnsense-configurator"). */
import { FirewallConfigurator } from './FirewallConfigurator';

/*
 * @id     tssr.atelier.opnsenseConfigurator
 * @do     configurer_opnsense
 * @role   ui
 * @layer  ui
 * @human  Atelier : plan de configuration OPNsense (interfaces, DHCP, NAT, règles).
 */
export function OpnsenseConfigurator() {
  return <FirewallConfigurator variante="opnsense" />;
}
