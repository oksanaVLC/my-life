/**
 * Normaliza un texto para buscar sin distinguir mayúsculas ni acentos.
 * «Canción» → «cancion», «Español» → «espanol». No corrige faltas.
 * El ruso no cambia (salvo mayúsculas): «й» no es «и».
 * Mantiene la misma longitud que el texto original (en NFC), así que los
 * índices sirven para resaltar la coincidencia en el texto original.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFC')
    .split('')
    .map((ch) => {
      // Solo letras latinas: «ñ» → «n», «á» → «a». El cirílico («й», «ё») se queda igual.
      const base = ch.normalize('NFD')[0];
      return base !== ch && /[a-z]/i.test(base) ? base : ch;
    })
    .join('')
    .toLowerCase();
}

export interface Highlight {
  pre: string;
  hit: string;
  post: string;
}

/** Divide el texto en antes / coincidencia / después para pintar <mark>. */
export function highlight(text: string, query: string): Highlight {
  const q = normalize(query.trim());
  const i = q ? normalize(text).indexOf(q) : -1;
  if (i < 0) return { pre: text, hit: '', post: '' };
  return { pre: text.slice(0, i), hit: text.slice(i, i + q.length), post: text.slice(i + q.length) };
}

export function matches(haystack: string, query: string): boolean {
  const q = normalize(query.trim());
  return !q || normalize(haystack).includes(q);
}
