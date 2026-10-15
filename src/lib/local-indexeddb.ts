export type LocalTransactionScope<T> = {
  transaction: IDBTransaction;
  result: (value: T) => void;
  fail: (error: unknown) => void;
  read: <V>(request: IDBRequest<V>, success: (value: V) => void) => void;
};

type DatabaseOptions = {
  name: string;
  version: number;
  factory: () => IDBFactory | undefined;
  upgrade: (database: IDBDatabase) => void;
  error: (message: string) => Error;
  blockedMessage: string;
};

// Shared browser persistence mechanics only. Schemas, validation, migration,
// conflict rules and domain errors remain with each feature's storage layer.
export class LocalIndexedDatabase {
  constructor(private options: DatabaseOptions) {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      let abandoned = false;
      const fail = (error: unknown) => {
        abandoned = true;
        clearTimeout(timer);
        reject(error);
      };
      const timer = setTimeout(
        () =>
          fail(
            this.options.error(
              "Browser storage did not respond. Close other InstaScope tabs and try again.",
            ),
          ),
        10000,
      );
      try {
        const factory = this.options.factory();
        if (!factory) throw new Error("IndexedDB unavailable");
        const request = factory.open(this.options.name, this.options.version);
        request.onblocked = () =>
          fail(this.options.error(this.options.blockedMessage));
        request.onerror = () => fail(request.error);
        request.onupgradeneeded = () => {
          try {
            if (abandoned) request.transaction?.abort();
            else this.options.upgrade(request.result);
          } catch (error) {
            request.transaction?.abort();
            fail(error);
          }
        };
        request.onsuccess = () => {
          clearTimeout(timer);
          const db = request.result;
          db.onversionchange = () => db.close();
          if (abandoned) db.close();
          else resolve(db);
        };
      } catch (error) {
        fail(error);
      }
    });
  }

  async run<T>(
    stores: string[],
    mode: IDBTransactionMode,
    action: (scope: LocalTransactionScope<T>) => void,
  ): Promise<T> {
    const db = await this.open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(stores, mode);
        let value: T, failure: unknown;
        const timer = setTimeout(() => {
          failure = this.options.error(
            "Browser storage did not respond. The operation was cancelled; try again.",
          );
          transaction.abort();
        }, 15000);
        transaction.oncomplete = () => {
          clearTimeout(timer);
          resolve(value);
        };
        transaction.onabort = () => {
          clearTimeout(timer);
          reject(
            failure ??
              transaction.error ??
              new Error("Storage operation aborted"),
          );
        };
        transaction.onerror = (event) => {
          failure ??= (event.target as IDBRequest).error ?? transaction.error;
        };
        const fail = (error: unknown) => {
          failure = error;
          transaction.abort();
        };
        try {
          action({
            transaction,
            result: (result) => {
              value = result;
            },
            fail,
            read: (request, success) => {
              request.onsuccess = () => {
                try {
                  success(request.result);
                } catch (error) {
                  fail(error);
                }
              };
            },
          });
        } catch (error) {
          fail(error);
        }
      });
    } finally {
      db.close();
    }
  }
}
