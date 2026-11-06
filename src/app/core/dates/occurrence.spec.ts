import { byNext, daysUntil, nextOccurrence, validDay, yearsAt } from './occurrence';

const from = new Date(2026, 10, 6); // 6 nov 2026

describe('fechas que se repiten cada año', () => {
  it('días que faltan', () => {
    expect(daysUntil({ day: 6, month: 11 }, from)).toBe(0);   // hoy
    expect(daysUntil({ day: 8, month: 11 }, from)).toBe(2);
    expect(daysUntil({ day: 5, month: 11 }, from)).toBe(364); // ya pasó → el año que viene
  });
  it('29 de febrero en año no bisiesto → 28', () => {
    expect(nextOccurrence({ day: 29, month: 2 }, from).getDate()).toBe(28);
    expect(nextOccurrence({ day: 29, month: 2 }, new Date(2027, 5, 1)).getFullYear()).toBe(2028);
  });
  it('años que cumple en la próxima fecha', () => {
    expect(yearsAt({ day: 8, month: 11, year: 1985 }, from)).toBe(41);
    expect(yearsAt({ day: 1, month: 1, year: 2000 }, from)).toBe(27);
    expect(yearsAt({ day: 1, month: 1 }, from)).toBeNull();
  });
  it('días válidos', () => {
    expect(validDay(29, 2)).toBe(true);
    expect(validDay(31, 4)).toBe(false);
    expect(validDay(0, 1)).toBe(false);
    expect(validDay(29, 2, 1985)).toBe(false); // 1985 no es bisiesto
    expect(validDay(29, 2, 1988)).toBe(true);
    expect(validDay(29, 2, 1900)).toBe(false); // divisible por 100 y no por 400
  });
  it('ordenar por cercanía', () => {
    expect(byNext([{ day: 1, month: 1 }, { day: 7, month: 11 }, { day: 25, month: 12 }], from).map((d) => d.month)).toEqual([11, 12, 1]);
  });
});
