import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { StoreRepository } from '../../application/ports/store.repository';
import { emptyStore, StoreData } from '../../domain/models';

/** Development adapter; writes are serialized and replace the file atomically. */
export class FileStoreRepository extends StoreRepository {
  private data: StoreData = emptyStore();
  private queue: Promise<unknown> = Promise.resolve();
  private ready?: Promise<void>;
  constructor(private readonly filename: string) {
    super();
  }
  onModuleInit() {
    return (this.ready ||= this.open());
  }
  private async open() {
    try {
      this.data = JSON.parse(await readFile(this.filename, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  async onModuleDestroy() {
    await this.queue;
  }
  async read() {
    await this.onModuleInit();
    await this.queue;
    return structuredClone(this.data);
  }
  async transaction<T>(
    operation: (data: StoreData) => T | Promise<T>,
  ): Promise<T> {
    await this.onModuleInit();
    const work = this.queue.then(async () => {
      const copy = structuredClone(this.data);
      const result = await operation(copy);
      await mkdir(dirname(this.filename), { recursive: true });
      await writeFile(`${this.filename}.tmp`, JSON.stringify(copy, null, 2), {
        mode: 0o600,
      });
      await rename(`${this.filename}.tmp`, this.filename);
      this.data = copy;
      return structuredClone(result);
    });
    this.queue = work.catch(() => undefined);
    return work;
  }
}
