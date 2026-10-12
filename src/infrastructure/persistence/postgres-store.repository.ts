import { DataSource } from 'typeorm';
import { StoreRepository } from '../../application/ports/store.repository';
import { emptyStore, StoreData } from '../../domain/models';

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
}
/** One transactional document collection suits the scale of this pet project.
 * The port allows replacing this schema without changing any use case. */
export class PostgresStoreRepository extends StoreRepository {
  private readonly db: DataSource;
  private ready?: Promise<void>;
  constructor(config: DatabaseConfig) {
    super();
    this.db = new DataSource({
      type: 'postgres',
      host: config.host,
      port: config.port,
      username: config.user,
      password: config.password,
      database: config.name,
    });
  }
  onModuleInit() {
    return (this.ready ||= this.open());
  }
  private async open() {
    await this.db.initialize();
    await this.db.query('SELECT id FROM step_store_records LIMIT 1');
  }
  async onModuleDestroy() {
    if (this.db.isInitialized) await this.db.destroy();
  }
  private decode(
    rows: { kind: keyof StoreData; payload: unknown }[],
  ): StoreData {
    const data = emptyStore();
    for (const row of rows) (data[row.kind] as unknown[]).push(row.payload);
    for (const product of data.products) product.version ??= 0;
    return data;
  }
  async read() {
    await this.onModuleInit();
    return this.decode(
      await this.db.query('SELECT kind, payload FROM step_store_records'),
    );
  }
  async transaction<T>(
    operation: (data: StoreData) => T | Promise<T>,
  ): Promise<T> {
    await this.onModuleInit();
    return this.db.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(7351026)');
      const before = this.decode(
        await manager.query('SELECT kind, payload FROM step_store_records'),
      );
      const data = structuredClone(before);
      const result = await operation(data);
      for (const kind of Object.keys(data) as (keyof StoreData)[]) {
        const old = new Map<string, string>(
          before[kind].map(
            (item) => [item.id, JSON.stringify(item)] as [string, string],
          ),
        );
        for (const item of data[kind]) {
          if (old.get(item.id) !== JSON.stringify(item))
            await manager.query(
              'INSERT INTO step_store_records(kind,id,payload) VALUES($1,$2,$3) ON CONFLICT(kind,id) DO UPDATE SET payload = EXCLUDED.payload',
              [kind, item.id, JSON.stringify(item)],
            );
          old.delete(item.id);
        }
        for (const id of old.keys())
          await manager.query(
            'DELETE FROM step_store_records WHERE kind=$1 AND id=$2',
            [kind, id],
          );
      }
      return result;
    });
  }
}
