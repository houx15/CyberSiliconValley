import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword, signJWT, verifyJWT } from '../index';

describe('auth', () => {
  it('hashes and verifies passwords', async () => {
    const password = 'csv2026';
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(await comparePassword(password, hash)).toBe(true);
    expect(await comparePassword('wrong', hash)).toBe(false);
  });

  it('signs and verifies JWT', async () => {
    const payload = { userId: '123', role: 'talent' as const, email: 'test@csv.dev' };
    const token = await signJWT(payload);
    expect(typeof token).toBe('string');
    const decoded = await verifyJWT(token);
    expect(decoded.userId).toBe('123');
    expect(decoded.role).toBe('talent');
    expect(decoded.email).toBe('test@csv.dev');
  });

  it('rejects invalid JWT', async () => {
    await expect(verifyJWT('invalid-token')).rejects.toThrow();
  });
});
