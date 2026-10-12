import { AppError } from '../../domain/errors';
import { publicUser } from '../../domain/models';
import { ProfileInput } from '../inputs';
import { StoreRepository } from '../ports/store.repository';
export class AccountService {
  constructor(private readonly repo: StoreRepository) {}
  async updateProfile(id: string, input: ProfileInput) {
    return this.repo.transaction((data) => {
      const user = data.users.find((u) => u.id === id)!;
      if (input.name.trim().length < 2)
        throw new AppError('validation', 'Укажите имя.');
      Object.assign(user, {
        name: input.name.trim(),
        phone: input.phone.trim(),
        address: input.address.trim(),
      });
      return publicUser(user);
    });
  }

  async favorite(userId: string, productId: string, saved: boolean) {
    return this.repo.transaction((data) => {
      const user = data.users.find((u) => u.id === userId)!;
      if (saved && !data.products.some((p) => p.id === productId && p.active))
        throw new AppError('not_found', 'Товар не найден.');
      user.favorites = user.favorites.filter((id) => id !== productId);
      if (saved) user.favorites.push(productId);
      return publicUser(user);
    });
  }
}
