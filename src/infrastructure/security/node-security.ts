import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { Security } from '../../application/ports/security';
const derive = promisify(scrypt);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${((await derive(password, salt, 64)) as Buffer).toString('hex')}`;
}
async function verifyPassword(password: string, hash: string) {
  const [salt, digest] = hash.split(':');
  const expected = Buffer.from(digest || '', 'hex');
  const actual = (await derive(password, salt || 'missing-user', 64)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export const tokenHash = (value: string) =>
  createHash('sha256').update(value).digest('hex');

export class NodeSecurity extends Security {
  id = randomUUID;
  token = () => randomBytes(32).toString('hex');
  tokenHash = tokenHash;
  hashPassword = hashPassword;
  verifyPassword = verifyPassword;
}
