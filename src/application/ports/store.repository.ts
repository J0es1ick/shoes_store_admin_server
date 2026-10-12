import { StoreData } from '../../domain/models';
/** Atomic unit of work keeps orders, inventory and session writes consistent. */
export abstract class StoreRepository {
  abstract read(): Promise<StoreData>;
  abstract transaction<T>(
    operation: (data: StoreData) => T | Promise<T>,
  ): Promise<T>;
}
