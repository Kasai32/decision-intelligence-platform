import { ConfigService } from '@nestjs/config';
import { CredentialsEncryptionService } from './credentials-encryption.service';

function makeService(secret = 'dev-only-test-key'): CredentialsEncryptionService {
  const configService = {
    getOrThrow: jest.fn().mockReturnValue(secret),
  } as unknown as ConfigService;
  return new CredentialsEncryptionService(configService);
}

describe('CredentialsEncryptionService', () => {
  it('round-trips plaintext through encrypt/decrypt', () => {
    const service = makeService();
    const plaintext = JSON.stringify({ apiKey: 'sk-fixture-123', webhookSecret: 'whsec-fixture' });

    const ciphertext = service.encrypt(plaintext);
    expect(ciphertext).not.toContain('sk-fixture-123');
    expect(service.decrypt(ciphertext)).toBe(plaintext);
  });

  it('produces different ciphertext for the same plaintext each time (random IV)', () => {
    const service = makeService();
    const a = service.encrypt('same-secret');
    const b = service.encrypt('same-secret');
    expect(a).not.toBe(b);
    expect(service.decrypt(a)).toBe('same-secret');
    expect(service.decrypt(b)).toBe('same-secret');
  });

  it('rejects a tampered ciphertext (GCM auth tag mismatch)', () => {
    const service = makeService();
    const ciphertext = service.encrypt('sensitive-value');
    const [iv, authTag, data] = ciphertext.split('.');
    const tampered = [iv, authTag, `${data.slice(0, -4)}AAAA`].join('.');

    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('rejects a malformed ciphertext string', () => {
    const service = makeService();
    expect(() => service.decrypt('not-a-valid-ciphertext')).toThrow('Malformed ciphertext');
  });

  it('cannot decrypt data encrypted with a different key', () => {
    const serviceA = makeService('key-a');
    const serviceB = makeService('key-b');
    const ciphertext = serviceA.encrypt('secret-for-a');
    expect(() => serviceB.decrypt(ciphertext)).toThrow();
  });
});
