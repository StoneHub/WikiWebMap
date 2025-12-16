/**
 * reCAPTCHA v3 Service
 * Provides bot protection for client-side operations
 *
 * Note: This is client-side verification only. For maximum security,
 * you should verify tokens on a backend server. However, for static
 * hosting, client-side checks still provide significant protection
 * against casual bots and automated scripts.
 */

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

export class RecaptchaService {
  // Get site key from environment variable
  // Test key will always pass - Replace with your actual key in production
  private static readonly SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeFqi0sAAAAAFtOhr-p-WVjbTvKe7XVdwAc_2aR';

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
      // Check if grecaptcha is loaded
      if (!window.grecaptcha) {
        console.warn('reCAPTCHA not loaded, skipping verification');
        return true; // Fail open - don't block users if reCAPTCHA fails to load
      }

      // Get reCAPTCHA token
      const token = await new Promise<string>((resolve, reject) => {
        window.grecaptcha.ready(() => {
          window.grecaptcha
            .execute(this.SITE_KEY, { action })
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
}
