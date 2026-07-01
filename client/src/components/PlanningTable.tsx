import { PLANNING_COLORS, type PlanningRecord } from '@shared/types';

const COLOR = Object.fromEntries(PLANNING_COLORS.map(c => [c.key, c]));

/** Rend un planning sous forme de grille colorée (jours en lignes, créneaux en colonnes). */
export function PlanningTable({ planning }: { planning: PlanningRecord }) {
  const cols = Math.max(1, planning.columns);
  return (
    <div className="planning">
      <div className="planning-head">
        {planning.section && <span className="planning-section">{planning.section}</span>}
        {planning.period && <span className="planning-period">{planning.period}</span>}
        <h3 className="planning-title">{planning.title}</h3>
      </div>
      <div className="planning-scroll">
        <table className="planning-grid">
          <tbody>
            {planning.rows.map((row, i) => (
              <tr key={i} className={row.weekend ? 'planning-weekend' : ''}>
                <th className="planning-daycol">
                  <span className="planning-wd">{row.weekday}</span>
                  <span className="planning-dn">{row.day}</span>
                </th>
                {Array.from({ length: cols }).map((_, ci) => {
                  const cell = row.cells[ci];
                  const c = cell ? COLOR[cell.color] : undefined;
                  return <td key={ci} style={c && c.key ? { background: c.bg, color: c.fg } : undefined}>{cell?.text || ''}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {planning.legend && planning.legend.length > 0 && (
        <div className="planning-legend">
          {planning.legend.map((l, i) => {
            const c = COLOR[l.color];
            return (
              <span key={i} className="planning-legend-item">
                <span className="planning-legend-swatch" style={c && c.key ? { background: c.bg } : undefined} aria-hidden />
                {l.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
