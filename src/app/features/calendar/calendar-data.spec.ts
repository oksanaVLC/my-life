import { addDays, iso, monthCells, parseIso, startOfWeek } from './calendar-data';

describe('calendar-data', () => {
  it('iso ↔ fecha local', () => {
    expect(iso(parseIso('2026-11-14'))).toBe('2026-11-14');
    expect(iso(addDays(parseIso('2026-10-31'), 1))).toBe('2026-11-01');
    expect(iso(addDays(parseIso('2026-03-28'), 2))).toBe('2026-03-30'); // cambio de hora
  });
  it('semana empieza en lunes', () => {
    expect(iso(startOfWeek(parseIso('2026-11-14')))).toBe('2026-11-09'); // sábado → lunes 9
    expect(iso(startOfWeek(parseIso('2026-11-09')))).toBe('2026-11-09');
    expect(iso(startOfWeek(parseIso('2026-11-15')))).toBe('2026-11-09'); // domingo
  });
  it('celdas del mes', () => {
    const cells = monthCells(2026, 10); // noviembre 2026 empieza en domingo
    expect(cells.filter((c) => c === null).length).toBe(6);
    expect(cells.length).toBe(36);
  });
});
