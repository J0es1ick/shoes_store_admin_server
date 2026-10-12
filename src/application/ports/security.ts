export abstract class Security {
  abstract id(): string;
  abstract token(): string;
  abstract tokenHash(value: string): string;
  abstract hashPassword(password: string): Promise<string>;
  abstract verifyPassword(password: string, hash: string): Promise<boolean>;
}
