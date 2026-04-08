/**
 * WhiteLabelingConfig - Enhanced white labeling support for OHIF Viewer.
 *
 * Allows institutions to customize:
 * - Logo and branding
 * - Application title and favicon
 * - Custom CSS variables (colors, fonts)
 * - Footer text and links
 * - Custom theme presets
 *
 * Configuration is loaded from the app config (`whiteLabeling` key)
 * and applied at runtime without rebuilding.
 */

export interface WhiteLabelingOptions {
  /** Custom application title (shown in browser tab) */
  appTitle?: string;
  /** URL to custom favicon */
  faviconUrl?: string;
  /** URL to custom logo image */
  logoUrl?: string;
  /** Logo alt text for accessibility */
  logoAlt?: string;
  /** Logo link URL (default: '/') */
  logoLink?: string;
  /** Footer text (HTML supported) */
  footerText?: string;
  /** Institution name */
  institutionName?: string;
  /** Theme preset: 'clinical-light', 'radiology-dark', 'high-contrast' */
  themePreset?: 'clinical-light' | 'radiology-dark' | 'high-contrast';
  /** Custom CSS variables to override */
  cssVariables?: Record<string, string>;
  /** Custom CSS string to inject */
  customCSS?: string;
  /** Hide investigational use dialog */
  hideInvestigationalDialog?: boolean;
  /** Custom support URL */
  supportUrl?: string;
  /** Custom about dialog content */
  aboutContent?: string;
}

/**
 * Apply white labeling configuration to the application.
 * Should be called during app initialization.
 */
function applyWhiteLabeling(options: WhiteLabelingOptions): void {
  if (!options) {
    return;
  }

  // Set document title
  if (options.appTitle) {
    document.title = options.appTitle;
  }

  // Set favicon
  if (options.faviconUrl) {
    const existingFavicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (existingFavicon) {
      existingFavicon.href = options.faviconUrl;
    } else {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = options.faviconUrl;
      document.head.appendChild(link);
    }
  }

  // Apply CSS variables
  if (options.cssVariables) {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(options.cssVariables)) {
      // Ensure the variable name starts with --
      const varName = key.startsWith('--') ? key : `--${key}`;
      root.style.setProperty(varName, value);
    }
  }

  // Inject custom CSS
  if (options.customCSS) {
    const style = document.createElement('style');
    style.id = 'ohif-white-labeling';
    style.textContent = options.customCSS;

    // Remove existing custom style if present
    const existing = document.getElementById('ohif-white-labeling');
    if (existing) {
      existing.remove();
    }

    document.head.appendChild(style);
  }

  // Apply theme preset
  if (options.themePreset) {
    applyThemePreset(options.themePreset);
  }
}

/**
 * Apply a predefined theme preset.
 */
function applyThemePreset(preset: string): void {
  const root = document.documentElement;

  // Remove existing theme classes
  root.classList.remove('dark', 'light', 'high-contrast');

  switch (preset) {
    case 'clinical-light':
      root.classList.add('light');
      root.style.setProperty('--background', '0 0% 98%');
      root.style.setProperty('--foreground', '222 47% 11%');
      root.style.setProperty('--primary', '210 100% 40%');
      root.style.setProperty('--muted', '210 40% 96%');
      break;

    case 'radiology-dark':
      root.classList.add('dark');
      // Uses default dark theme - no overrides needed
      break;

    case 'high-contrast':
      root.classList.add('high-contrast');
      break;

    default:
      root.classList.add('dark');
  }
}

/**
 * Remove all white labeling customizations and restore defaults.
 */
function resetWhiteLabeling(): void {
  // Remove custom CSS
  const customStyle = document.getElementById('ohif-white-labeling');
  if (customStyle) {
    customStyle.remove();
  }

  // Reset inline CSS variables
  document.documentElement.removeAttribute('style');

  // Reset title
  document.title = 'OHIF Viewer';
}

export { applyWhiteLabeling, applyThemePreset, resetWhiteLabeling };
