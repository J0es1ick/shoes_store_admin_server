import { AppError } from '../../domain/errors';
import { publicUser, StoreData, StoreUser } from '../../domain/models';
import { Registration } from '../inputs';
import { Security } from '../ports/security';
import { StoreRepository } from '../ports/store.repository';
export class AuthService {
  private attempts = new Map<string, { count: number; until: number }>();
  constructor(
    private readonly repo: StoreRepository,
    private readonly security: Security,
  ) {}
  throttle(key: string) {
    const now = Date.now();
    for (const [k, value] of this.attempts)
      if (value.until <= now) this.attempts.delete(k);
    const item = this.attempts.get(key) || {
      count: 0,
      until: now + 15 * 60_000,
    };
    item.count++;
    this.attempts.set(key, item);
    if (item.count > 20 || this.attempts.size > 10000)
      throw new AppError(
        'rate_limit',
        'Слишком много попыток. Попробуйте через 15 минут.',
      );
  }

  async register(input: Registration) {
    const passwordHash = await this.security.hashPassword(input.password);
    return this.repo.transaction((data) => {
      const email = input.email.trim().toLowerCase();
      const name = input.name.trim();
      if (name.length < 2) throw new AppError('validation', 'Укажите имя.');
      if (data.users.some((user) => user.email === email))
        throw new AppError(
          'conflict',
          'Этот email уже зарегистрирован. Войдите в аккаунт.',
        );
      const user: StoreUser = {
        id: this.security.id(),
        email,
        name,
        passwordHash,
        role: 'customer',
        phone: '',
        address: '',
        favorites: [],
        createdAt: new Date().toISOString(),
      };
      data.users.push(user);
      return {
        user: publicUser(user),
        token: this.createSession(data, user.id),
      };
    });
  }

  async login(email: string, password: string) {
    const user = (await this.repo.read()).users.find(
      (u) => u.email === email.trim().toLowerCase(),
    );
    if (
      !(await this.security.verifyPassword(
        password,
        user?.passwordHash || 'missing:00',
      )) ||
      !user
    )
      throw new AppError('unauthorized', 'Неверный email или пароль.');
    return this.repo.transaction((data) => ({
      user: publicUser(user),
      token: this.createSession(data, user.id),
    }));
  }

  private createSession(data: StoreData, userId: string) {
    data.sessions = data.sessions.filter(
      (s) => Date.parse(s.expiresAt) > Date.now(),
    );
    const token = this.security.token();
    data.sessions.push({
      id: this.security.tokenHash(token),
      userId,
      expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
    });
    return token;
  }

  async session(token?: string) {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const data = await this.repo.read();
    const session = data.sessions.find(
      (s) =>
        s.id === this.security.tokenHash(token) &&
        Date.parse(s.expiresAt) > Date.now(),
    );
    return session
      ? data.users.find((u) => u.id === session.userId) || null
      : null;
  }

  async logout(token: string) {
    await this.repo.transaction((data) => {
      data.sessions = data.sessions.filter(
        (s) => s.id !== this.security.tokenHash(token),
      );
    });
  }
}
