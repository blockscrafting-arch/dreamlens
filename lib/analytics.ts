/**
 * Analytics utilities for Google Analytics 4
 */

// Google Analytics 4 Measurement ID
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';

/**
 * Initialize Google Analytics
 */
export function initAnalytics() {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined') {
    return;
  }

  // Load gtag script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  // Initialize gtag
  if (!window.dataLayer) {
    window.dataLayer = [];
  }
  function gtag(...args: unknown[]) {
    if (window.dataLayer) {
      window.dataLayer.push(args);
    }
  }
  (window as any).gtag = gtag;

  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, {
    page_path: window.location.pathname,
  });
}

/**
 * Track page view
 */
export function trackPageView(path: string) {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined' || !(window as any).gtag) {
    return;
  }

  (window as any).gtag('config', GA_MEASUREMENT_ID, {
    page_path: path,
  });
}

/**
 * Track custom event
 */
export function trackEvent(
  eventName: string,
  eventParams?: Record<string, unknown>
) {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined' || !(window as any).gtag) {
    return;
  }

  (window as any).gtag('event', eventName, eventParams);
}

/**
 * Track conversion events
 */
export const trackConversion = {
  signUp: () => trackEvent('sign_up'),
  purchase: (value: number, currency: string = 'RUB') => 
    trackEvent('purchase', { value, currency }),
  generateImage: (plan: string) => 
    trackEvent('generate_image', { plan }),
  upgradeSubscription: (plan: string, value: number) =>
    trackEvent('upgrade_subscription', { plan, value }),
};


