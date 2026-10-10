import { describe, expect, it } from 'vitest';
import { REDACTED, redactDeep, redactObject } from './redact';

describe('redactDeep', () => {
  it('redacts sensitive keys at any depth', () => {
    const input = {
      headers: { authorization: 'Bearer x', cookie: 'a=b', 'set-cookie': ['c'], accept: '*/*' },
      user: { password: 'p', profile: { apiKey: 'k', api_key: 'k', name: 'Ann' } },
      items: [{ refreshToken: 't', clientSecret: 's' }],
    };
    expect(redactDeep(input)).toEqual({
      headers: { authorization: REDACTED, cookie: REDACTED, 'set-cookie': REDACTED, accept: '*/*' },
      user: { password: REDACTED, profile: { apiKey: REDACTED, api_key: REDACTED, name: 'Ann' } },
      items: [{ refreshToken: REDACTED, clientSecret: REDACTED }],
    });
  });

  it('keeps errors and primitives untouched', () => {
    const error = new Error('boom');
    expect(redactObject({ err: error }).err).toBe(error);
    expect(redactDeep('text')).toBe('text');
  });

  it('does not mutate the input', () => {
    const input = { token: 'secret-value' };
    redactDeep(input);
    expect(input.token).toBe('secret-value');
  });
});
