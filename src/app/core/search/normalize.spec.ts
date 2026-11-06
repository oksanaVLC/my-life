import { highlight, matches, normalize } from './normalize';

describe('normalize', () => {
  it('quita acentos y la tilde de la ñ', () => {
    expect(normalize('Canción Español')).toBe('cancion espanol');
  });
  it('mantiene la longitud para poder resaltar', () => {
    const s = 'Árbol de Navidad';
    expect(normalize(s).length).toBe(s.length);
  });
  it('no toca el cirílico salvo mayúsculas', () => {
    expect(normalize('Русский')).toBe('русский');
  });
});

describe('matches / highlight', () => {
  it('encuentra «cancion» en «Canción»', () => {
    expect(matches('Mi canción favorita', 'CANCION')).toBe(true);
    expect(matches('Mi canción favorita', 'cancon')).toBe(false); // sin corrector de faltas
  });
  it('consulta vacía = todo coincide', () => {
    expect(matches('lo que sea', '  ')).toBe(true);
  });
  it('resalta en el texto original', () => {
    expect(highlight('Diseño web', 'diseno')).toEqual({ pre: '', hit: 'Diseño', post: ' web' });
    expect(highlight('Diseño web', 'zzz')).toEqual({ pre: 'Diseño web', hit: '', post: '' });
  });
});
