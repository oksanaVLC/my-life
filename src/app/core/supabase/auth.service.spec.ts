import { errorCode } from './auth.service';

describe('errorCode (errores de Supabase → código)', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
  it('usa el código de Supabase', () => {
    expect(errorCode({ code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' })).toBe('invalid_credentials');
  });
  it('sin conexión', () => {
    expect(errorCode({ status: 0, message: 'Failed to fetch' })).toBe('network');
  });
  it('demasiados intentos', () => {
    expect(errorCode({ status: 429, message: 'Too many requests' })).toBe('over_request_rate_limit');
  });
  it('otro', () => {
    expect(errorCode({ status: 500, message: 'boom' })).toBe('other');
  });
});
