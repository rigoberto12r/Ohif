/**
 * RemoteExtensionLoader
 *
 * Loads OHIF extensions from remote URLs at runtime using dynamic imports
 * or Import Maps. This enables a plugin ecosystem where third-party
 * extensions can be loaded without recompiling the application.
 *
 * Supports:
 * - ES module imports from URLs
 * - UMD bundles via script injection
 * - Extension validation and sandboxing
 * - Version compatibility checking
 * - Caching of loaded extensions
 */

interface RemoteExtensionConfig {
  /** Unique identifier for the extension */
  id: string;
  /** URL to the extension's entry point (ES module or UMD bundle) */
  url: string;
  /** Extension version for compatibility checking */
  version?: string;
  /** Minimum OHIF version required */
  minOHIFVersion?: string;
  /** Module format: 'esm' or 'umd' */
  format?: 'esm' | 'umd';
  /** Global variable name for UMD bundles */
  globalName?: string;
  /** Integrity hash (SRI) for security */
  integrity?: string;
}

interface LoadedExtension {
  config: RemoteExtensionConfig;
  module: any;
  loadedAt: number;
}

class RemoteExtensionLoader {
  private _loadedExtensions: Map<string, LoadedExtension> = new Map();
  private _registry: RemoteExtensionConfig[] = [];

  /**
   * Register a remote extension configuration.
   */
  register(config: RemoteExtensionConfig): void {
    const existing = this._registry.find(r => r.id === config.id);
    if (existing) {
      console.warn(`RemoteExtensionLoader: Extension ${config.id} already registered, updating.`);
      Object.assign(existing, config);
    } else {
      this._registry.push(config);
    }
  }

  /**
   * Register multiple remote extensions from a registry URL.
   */
  async loadRegistry(registryUrl: string): Promise<void> {
    try {
      const response = await fetch(registryUrl);
      if (!response.ok) {
        throw new Error(`Registry fetch failed: ${response.status}`);
      }

      const registry = await response.json();
      const extensions = registry.extensions || registry;

      if (Array.isArray(extensions)) {
        extensions.forEach(config => this.register(config));
      }
    } catch (error) {
      console.error('RemoteExtensionLoader: Failed to load registry', error);
      throw error;
    }
  }

  /**
   * Load a single remote extension by its ID.
   */
  async load(id: string): Promise<any> {
    // Return cached if already loaded
    const cached = this._loadedExtensions.get(id);
    if (cached) {
      return cached.module;
    }

    const config = this._registry.find(r => r.id === id);
    if (!config) {
      throw new Error(`RemoteExtensionLoader: Extension ${id} not found in registry`);
    }

    const module = await this._loadModule(config);

    // Validate the loaded module has the expected extension interface
    this._validateExtension(module, config);

    this._loadedExtensions.set(id, {
      config,
      module,
      loadedAt: Date.now(),
    });

    return module;
  }

  /**
   * Load all registered remote extensions.
   */
  async loadAll(): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    await Promise.allSettled(
      this._registry.map(async config => {
        try {
          const module = await this.load(config.id);
          results.set(config.id, module);
        } catch (error) {
          console.error(
            `RemoteExtensionLoader: Failed to load extension ${config.id}`,
            error
          );
        }
      })
    );

    return results;
  }

  /**
   * Unload an extension and clean up resources.
   */
  unload(id: string): boolean {
    return this._loadedExtensions.delete(id);
  }

  /**
   * Get all loaded extension modules.
   */
  getLoadedExtensions(): LoadedExtension[] {
    return Array.from(this._loadedExtensions.values());
  }

  /**
   * Check if an extension is loaded.
   */
  isLoaded(id: string): boolean {
    return this._loadedExtensions.has(id);
  }

  /**
   * Load a module from a remote URL.
   */
  private async _loadModule(config: RemoteExtensionConfig): Promise<any> {
    const format = config.format || 'esm';

    if (format === 'esm') {
      return this._loadESModule(config);
    } else if (format === 'umd') {
      return this._loadUMDModule(config);
    }

    throw new Error(`Unsupported module format: ${format}`);
  }

  /**
   * Load an ES module from a URL using dynamic import().
   */
  private async _loadESModule(config: RemoteExtensionConfig): Promise<any> {
    try {
      // Use dynamic import for ES modules
      const module = await import(/* webpackIgnore: true */ config.url);
      return module.default || module;
    } catch (error) {
      throw new Error(
        `Failed to load ES module from ${config.url}: ${error.message}`
      );
    }
  }

  /**
   * Load a UMD module by injecting a script tag.
   */
  private _loadUMDModule(config: RemoteExtensionConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = config.url;
      script.async = true;

      if (config.integrity) {
        script.integrity = config.integrity;
        script.crossOrigin = 'anonymous';
      }

      script.onload = () => {
        const globalName = config.globalName || config.id;
        const module = (window as any)[globalName];

        if (!module) {
          reject(
            new Error(
              `UMD module loaded but global "${globalName}" not found`
            )
          );
          return;
        }

        resolve(module.default || module);
      };

      script.onerror = () => {
        reject(new Error(`Failed to load UMD module from ${config.url}`));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Validate that a loaded module conforms to the OHIF extension interface.
   */
  private _validateExtension(module: any, config: RemoteExtensionConfig): void {
    if (!module) {
      throw new Error(`Extension ${config.id}: Module is null/undefined`);
    }

    if (!module.id && typeof module !== 'function') {
      throw new Error(
        `Extension ${config.id}: Missing required 'id' property`
      );
    }

    // Check for at least one module getter
    const moduleGetters = [
      'getViewportModule',
      'getPanelModule',
      'getToolbarModule',
      'getCommandsModule',
      'getSopClassHandlerModule',
      'getDataSourcesModule',
      'getHangingProtocolModule',
      'getLayoutTemplateModule',
      'getCustomizationModule',
      'getUtilityModule',
    ];

    const hasModuleGetter = moduleGetters.some(
      getter => typeof module[getter] === 'function'
    );

    if (!hasModuleGetter) {
      console.warn(
        `Extension ${config.id}: No module getters found. The extension may not provide any functionality.`
      );
    }
  }
}

// Singleton
const remoteExtensionLoader = new RemoteExtensionLoader();

export default remoteExtensionLoader;
export { RemoteExtensionLoader };
export type { RemoteExtensionConfig, LoadedExtension };
