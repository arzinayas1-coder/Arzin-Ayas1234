import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function resolveDataDir(): string {
  const preferred = path.resolve(process.cwd(), '.forge-data');
  try {
    if (!fs.existsSync(preferred)) {
      fs.mkdirSync(preferred, { recursive: true });
    }
    fs.accessSync(preferred, fs.constants.W_OK | fs.constants.R_OK);
    return preferred;
  } catch {
    const fallback = path.join(os.tmpdir(), 'forge-ai-data');
    if (!fs.existsSync(fallback)) {
      fs.mkdirSync(fallback, { recursive: true });
    }
    return fallback;
  }
}

const DATA_DIR = resolveDataDir();
const KEY_FILE = path.join(DATA_DIR, '.master.key');

let cachedSecret: Buffer | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getMasterSecret(): Buffer {
  if (cachedSecret) return cachedSecret;
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    cachedSecret = crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest();
    return cachedSecret;
  }
  ensureDataDir();
  try {
    if (fs.existsSync(KEY_FILE)) {
      const raw = fs.readFileSync(KEY_FILE, 'utf8').trim();
      cachedSecret = Buffer.from(raw, 'hex');
      if (cachedSecret.length === 32) return cachedSecret;
    }
    const generated = crypto.randomBytes(32);
    fs.writeFileSync(KEY_FILE, generated.toString('hex'), { mode: 0o600 });
    cachedSecret = generated;
    return cachedSecret;
  } catch {
    const fallbackKeyFile = path.join(os.tmpdir(), 'forge-ai-master.key');
    if (fs.existsSync(fallbackKeyFile)) {
      const raw = fs.readFileSync(fallbackKeyFile, 'utf8').trim();
      const buf = Buffer.from(raw, 'hex');
      if (buf.length === 32) {
        cachedSecret = buf;
        return cachedSecret;
      }
    }
    const generated = crypto.randomBytes(32);
    fs.writeFileSync(fallbackKeyFile, generated.toString('hex'), { mode: 0o600 });
    cachedSecret = generated;
    return cachedSecret;
  }
}

export function encryptSecret(plaintext: string): string {
  const key = getMasterSecret();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(payload: string): string {
  if (!payload) return '';
  const parts = payload.split(':');
  if (parts.length !== 3) return '';
  const [ivHex, tagHex, dataHex] = parts;
  const key = getMasterSecret();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
