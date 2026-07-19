import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/**
 * AES-256-GCM encryption for per-tenant integration credentials (see
 * ADR-0012) — never stored in plaintext or in a global environment
 * variable. The key is derived (SHA-256) from
 * INTEGRATION_CREDENTIALS_ENCRYPTION_KEY so the env var itself doesn't need
 * to be an exact 32-byte value. Ciphertext is `iv.authTag.data`, each
 * base64 — a tampered value fails GCM's auth tag check and throws.
 */
@Injectable()
export class CredentialsEncryptionService {
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    const secret = configService.getOrThrow<string>('INTEGRATION_CREDENTIALS_ENCRYPTION_KEY');
    this.key = createHash('sha256').update(secret).digest();
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv, authTag, encrypted].map((buffer) => buffer.toString('base64')).join('.');
  }

  decrypt(ciphertext: string): string {
    const [ivB64, authTagB64, dataB64] = ciphertext.split('.');
    if (!ivB64 || !authTagB64 || !dataB64) {
      throw new Error('Malformed ciphertext');
    }

    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}
