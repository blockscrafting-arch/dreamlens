import { useEffect, useState } from 'react';

/**
 * Tiny SPA-like pathname listener (popstate + pushState/replaceState overrides).
 * Keeps routing logic out of components and avoids duplication.
 */
export function usePathname(): string {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      const newPath = window.location.pathname;
      setPathname((prev) => (prev === newPath ? prev : newPath));
    };

    window.addEventListener('popstate', handleLocationChange);

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(history, args as never);
      // ensure listeners fire after state update
      queueMicrotask(handleLocationChange);
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(history, args as never);
      queueMicrotask(handleLocationChange);
    };

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, []);

  return pathname;
}

