export type StoredObject = {
  key: string;
  contentType: string;
  bytes: Uint8Array;
};

export interface StorageProvider {
  put(object: StoredObject): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}
