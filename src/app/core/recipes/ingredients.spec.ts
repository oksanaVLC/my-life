import { formatMinutes, parseIngredient, scaleIngredient } from './ingredients';

describe('parseIngredient', () => {
  it('cantidad, unidad y nombre', () => {
    expect(parseIngredient('250 g harina de trigo')).toEqual({ qty: 250, unit: 'g', name: 'harina de trigo' });
    expect(parseIngredient('1 cda de azúcar')).toEqual({ qty: 1, unit: 'cda', name: 'azúcar' });
  });
  it('sin unidad', () => {
    expect(parseIngredient('3 huevos')).toEqual({ qty: 3, unit: '', name: 'huevos' });
  });
  it('decimales y fracciones', () => {
    expect(parseIngredient('1,5 kg patatas').qty).toBe(1.5);
    expect(parseIngredient('1/2 taza leche')).toEqual({ qty: 0.5, unit: 'taza', name: 'leche' });
    expect(parseIngredient('1 1/2 tazas leche').qty).toBe(1.5);
    expect(parseIngredient('½ cebolla')).toEqual({ qty: 0.5, unit: '', name: 'cebolla' });
  });
  it('sin cantidad', () => {
    expect(parseIngredient('sal al gusto')).toEqual({ qty: null, unit: '', name: 'sal al gusto' });
  });
  it('ruso', () => {
    expect(parseIngredient('200 г муки')).toEqual({ qty: 200, unit: 'г', name: 'муки' });
  });
});

describe('scaleIngredient', () => {
  it('recalcula para otras raciones', () => {
    expect(scaleIngredient('250 g harina', 0.5, 'es')).toEqual({ amount: '125 g', name: 'harina' });
    expect(scaleIngredient('3 huevos', 2, 'es')).toEqual({ amount: '6', name: 'huevos' });
    expect(scaleIngredient('1/2 taza leche', 3, 'es')).toEqual({ amount: '1,5 taza', name: 'leche' });
    expect(scaleIngredient('sal al gusto', 2, 'es')).toEqual({ amount: '', name: 'sal al gusto' });
  });
});

describe('formatMinutes', () => {
  it('min y horas', () => {
    expect(formatMinutes(25)).toBe('25 min');
    expect(formatMinutes(60)).toBe('1 h');
    expect(formatMinutes(80)).toBe('1 h 20 min');
    expect(formatMinutes(undefined)).toBe('');
  });
});
