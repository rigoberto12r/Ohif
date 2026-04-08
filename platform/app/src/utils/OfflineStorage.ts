/**
 * OfflineStorage - IndexedDB-based storage for offline DICOM study caching.
 *
 * Provides:
 * - Cache frequently accessed studies for offline viewing
 * - Manage cached study metadata and image data
 * - Track storage usage and provide eviction policies
 * - Queue annotation changes for sync when reconnected
 */

const DB_NAME = 'ohif-offline-cache';
const DB_VERSION = 1;
const STORE_STUDIES = 'studies';
const STORE_IMAGES = 'images';
const STORE_ANNOTATIONS = 'annotations';
const STORE_SYNC_QUEUE = 'syncQueue';

interface CachedStudy {
  studyInstanceUID: string;
  patientName: string;
  studyDate: string;
  modality: string;
  studyDescription: string;
  cachedAt: number;
  lastAccessed: number;
  sizeBytes: number;
  seriesCount: number;
  metadata: Record<string, unknown>;
}

interface CachedImage {
  imageId: string;
  studyInstanceUID: string;
  seriesInstanceUID: string;
  data: ArrayBuffer;
  cachedAt: number;
}

interface SyncQueueItem {
  id: string;
  type: 'annotation_add' | 'annotation_update' | 'annotation_delete' | 'measurement';
  payload: Record<string, unknown>;
  createdAt: number;
  retries: number;
}

class OfflineStorage {
  private _db: IDBDatabase | null = null;
  private _isInitialized = false;

  /**
   * Initialize the IndexedDB database.
   */
  async init(): Promise<void> {
    if (this._isInitialized) {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Studies metadata store
        if (!db.objectStoreNames.contains(STORE_STUDIES)) {
          const studyStore = db.createObjectStore(STORE_STUDIES, {
            keyPath: 'studyInstanceUID',
          });
          studyStore.createIndex('cachedAt', 'cachedAt', { unique: false });
          studyStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        }

        // Image data store
        if (!db.objectStoreNames.contains(STORE_IMAGES)) {
          const imageStore = db.createObjectStore(STORE_IMAGES, { keyPath: 'imageId' });
          imageStore.createIndex('studyInstanceUID', 'studyInstanceUID', { unique: false });
        }

        // Annotations store
        if (!db.objectStoreNames.contains(STORE_ANNOTATIONS)) {
          db.createObjectStore(STORE_ANNOTATIONS, { keyPath: 'id' });
        }

        // Sync queue for offline changes
        if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
          const syncStore = db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'id' });
          syncStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };

      request.onsuccess = (event: Event) => {
        this._db = (event.target as IDBOpenDBRequest).result;
        this._isInitialized = true;
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to initialize offline storage'));
      };
    });
  }

  /**
   * Cache a study's metadata for offline access.
   */
  async cacheStudy(study: CachedStudy): Promise<void> {
    await this._ensureInit();
    return this._put(STORE_STUDIES, {
      ...study,
      cachedAt: Date.now(),
      lastAccessed: Date.now(),
    });
  }

  /**
   * Cache an image's pixel data for offline access.
   */
  async cacheImage(image: CachedImage): Promise<void> {
    await this._ensureInit();
    return this._put(STORE_IMAGES, {
      ...image,
      cachedAt: Date.now(),
    });
  }

  /**
   * Get a cached study by its UID.
   */
  async getStudy(studyInstanceUID: string): Promise<CachedStudy | null> {
    await this._ensureInit();
    const study = await this._get<CachedStudy>(STORE_STUDIES, studyInstanceUID);

    if (study) {
      // Update last accessed time
      await this._put(STORE_STUDIES, { ...study, lastAccessed: Date.now() });
    }

    return study;
  }

  /**
   * Get a cached image by its ID.
   */
  async getImage(imageId: string): Promise<CachedImage | null> {
    await this._ensureInit();
    return this._get<CachedImage>(STORE_IMAGES, imageId);
  }

  /**
   * Check if a study is cached.
   */
  async isStudyCached(studyInstanceUID: string): Promise<boolean> {
    const study = await this.getStudy(studyInstanceUID);
    return study !== null;
  }

  /**
   * Get all cached studies.
   */
  async getCachedStudies(): Promise<CachedStudy[]> {
    await this._ensureInit();
    return this._getAll<CachedStudy>(STORE_STUDIES);
  }

  /**
   * Remove a study and all its associated images from cache.
   */
  async removeStudy(studyInstanceUID: string): Promise<void> {
    await this._ensureInit();

    // Remove images for this study
    const images = await this._getAllByIndex<CachedImage>(
      STORE_IMAGES,
      'studyInstanceUID',
      studyInstanceUID
    );

    const tx = this._db!.transaction([STORE_IMAGES, STORE_STUDIES], 'readwrite');

    for (const image of images) {
      tx.objectStore(STORE_IMAGES).delete(image.imageId);
    }

    tx.objectStore(STORE_STUDIES).delete(studyInstanceUID);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Add an item to the sync queue for later synchronization.
   */
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retries'>): Promise<void> {
    await this._ensureInit();
    return this._put(STORE_SYNC_QUEUE, {
      ...item,
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      retries: 0,
    });
  }

  /**
   * Get all pending sync items.
   */
  async getSyncQueue(): Promise<SyncQueueItem[]> {
    await this._ensureInit();
    return this._getAll<SyncQueueItem>(STORE_SYNC_QUEUE);
  }

  /**
   * Remove a sync item after successful synchronization.
   */
  async removeSyncItem(id: string): Promise<void> {
    await this._ensureInit();
    return this._delete(STORE_SYNC_QUEUE, id);
  }

  /**
   * Process the sync queue when connection is restored.
   */
  async processSyncQueue(
    syncFn: (item: SyncQueueItem) => Promise<boolean>
  ): Promise<{ synced: number; failed: number }> {
    const queue = await this.getSyncQueue();
    let synced = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        const success = await syncFn(item);
        if (success) {
          await this.removeSyncItem(item.id);
          synced++;
        } else {
          failed++;
        }
      } catch {
        failed++;
        // Increment retry counter
        await this._put(STORE_SYNC_QUEUE, { ...item, retries: item.retries + 1 });
      }
    }

    return { synced, failed };
  }

  /**
   * Get estimated storage usage in bytes.
   */
  async getStorageUsage(): Promise<{ used: number; quota: number }> {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
    return { used: 0, quota: 0 };
  }

  /**
   * Clear all offline data.
   */
  async clearAll(): Promise<void> {
    await this._ensureInit();

    const stores = [STORE_STUDIES, STORE_IMAGES, STORE_ANNOTATIONS, STORE_SYNC_QUEUE];
    const tx = this._db!.transaction(stores, 'readwrite');

    for (const store of stores) {
      tx.objectStore(store).clear();
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Private helpers

  private async _ensureInit(): Promise<void> {
    if (!this._isInitialized) {
      await this.init();
    }
  }

  private _put<T>(storeName: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this._db!.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private _get<T>(storeName: string, key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const tx = this._db!.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private _getAll<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const tx = this._db!.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  private _getAllByIndex<T>(
    storeName: string,
    indexName: string,
    value: string
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const tx = this._db!.transaction(storeName, 'readonly');
      const index = tx.objectStore(storeName).index(indexName);
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  private _delete(storeName: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this._db!.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

// Singleton instance
const offlineStorage = new OfflineStorage();

export default offlineStorage;
export { OfflineStorage };
export type { CachedStudy, CachedImage, SyncQueueItem };
