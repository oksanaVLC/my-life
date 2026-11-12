import { dayNumber, quoteIndex, quoteOfDay } from './quotes';

describe('frase del día', () => {
  const q = [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }];

  it('sin frases no hay ninguna', () => {
    expect(quoteOfDay([])).toBeNull();
    expect(quoteOfDay(undefined)).toBeNull();
  });

  it('va rotando un día tras otro', () => {
    const d = 19_998; // múltiplo de 3 → empieza por la primera
    expect([0, 1, 2, 3].map((i) => quoteOfDay(q, 0, d + i)?.id)).toEqual(['a', 'b', 'c', 'a']);
  });

  it('«Otra frase» avanza y también hacia atrás sin salirse', () => {
    expect(quoteIndex(3, 20_000, 1)).toBe(0);
    expect(quoteIndex(3, 20_000, -5)).toBe(0);
  });

  it('el día cambia a medianoche local', () => {
    expect(dayNumber(new Date(2026, 10, 12, 0, 5))).toBe(dayNumber(new Date(2026, 10, 12, 23, 55)));
    expect(dayNumber(new Date(2026, 10, 13, 0, 5)) - dayNumber(new Date(2026, 10, 12, 23, 55))).toBe(1);
  });
});
