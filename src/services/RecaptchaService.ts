/**
 * reCAPTCHA v3 Service
 * Provides bot protection for client-side operations
 *
 * Note: This is client-side verification only. For maximum security,
 * you should verify tokens on a backend server. However, for static
 * hosting, client-side checks still provide significant protection
 * against casual bots and automated scripts.
 */

import { runtimeConfig } from '../config/runtimeConfig';

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

export class RecaptchaService {
  private static readonly SITE_KEY = runtimeConfig.recaptchaSiteKey;
  private static readonly SCRIPT_ID = 'wikiwebmap-recaptcha-loader';
  private static loadPromise: Promise<boolean> | null = null;

  // Cache for recent verifications to avoid excessive checks
  private static lastVerification: { timestamp: number; passed: boolean } | null = null;
  private static readonly CACHE_DURATION = 60000; // 1 minute

  /**
   * Verify if the user passes reCAPTCHA check
   * @param action - The action being performed (e.g., 'pathfinding', 'search')
   * @returns true if user passes bot check, false otherwise
   */
  static async verify(action: string): Promise<boolean> {
    // Check cache to avoid excessive verification
    if (this.lastVerification && Date.now() - this.lastVerification.timestamp < this.CACHE_DURATION) {
      return this.lastVerification.passed;
    }

    try {
      if (!this.SITE_KEY) {
        console.warn('reCAPTCHA site key not configured, skipping verification');
        return true;
      }

      const loaded = await this.ensureLoaded();
      if (!loaded) {
        console.warn('reCAPTCHA failed to load, skipping verification');
        return true;
      }

      // Check if grecaptcha is loaded
      if (!window.grecaptcha) {
        console.warn('reCAPTCHA not loaded, skipping verification');
        return true; // Fail open - don't block users if reCAPTCHA fails to load
      }

      // Get reCAPTCHA token
      const siteKey = this.SITE_KEY;
      const token = await new Promise<string>((resolve, reject) => {
        window.grecaptcha.ready(() => {
          window.grecaptcha
            .execute(siteKey!, { action })
            .then(resolve)
            .catch(reject);
        });
      });

      // For client-side only verification, we can't validate the token server-side
      // So we just check that a token was generated (basic bot deterrent)
      const passed = token.length > 0;

      // Cache result
      this.lastVerification = { timestamp: Date.now(), passed };

      return passed;
    } catch (error) {
      console.error('reCAPTCHA verification failed:', error);
      // Fail open - don't block users if reCAPTCHA fails
      return true;
    }
  }

  /**
   * Force clear the verification cache
   * Useful when you want to force a fresh check
   */
  static clearCache(): void {
    this.lastVerification = null;
  }

  /**
   * Check if reCAPTCHA is loaded and ready
   */
  static isLoaded(): boolean {
    return typeof window.grecaptcha !== 'undefined';
  }

  private static async ensureLoaded(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false;
    }

    if (this.isLoaded()) return true;
    if (this.loadPromise) return this.loadPromise;

    const existingScript = document.getElementById(this.SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      this.loadPromise = new Promise(resolve => {
        existingScript.addEventListener('load', () => resolve(true), { once: true });
        existingScript.addEventListener('error', () => resolve(false), { once: true });
      });
      return this.loadPromise;
    }

    this.loadPromise = new Promise(resolve => {
      const script = document.createElement('script');
      script.id = this.SCRIPT_ID;
      script.async = true;
      script.defer = true;
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(this.SITE_KEY!)}`;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });

    return this.loadPromise;
  }
}
