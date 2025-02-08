import crypto from 'node:crypto';

const algorithm = 'aes-256-cbc'; // 选择加密算法
const baseKey = process.env.CRYPTO_SECRET // please change this key

const makeKey = (key: string): string => {
  return crypto
    .createHash('sha256')
    .update(`${baseKey}.${key}`)
    .digest('base64')
    .substring(0, 32);
};

export function encrypt(
  text: string,
  key: string
): { iv: string; encrypted: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, makeKey(key), iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return { iv: iv.toString('hex'), encrypted: encrypted.toString('base64') };
}

export function decrypt(encrypted: string, key: string, ivHex: string): string {
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, makeKey(key), iv);
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
