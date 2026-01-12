import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { getTelegramWebApp, isTelegramWebApp } from '../lib/telegram';
import WebApp from '@twa-dev/sdk';

/**
 * Hook to control Telegram MainButton
 * MainButton is the native blue button at the bottom of Telegram Mini App
 */
export function useTelegramMainButton() {
  const [isVisible, setIsVisible] = useState(false);
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  
  // Use ref to store the handler function to avoid re-attaching listeners
  const onClickRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isTelegramWebApp()) return;

    // Use @twa-dev/sdk directly
    const webApp = WebApp;

    // Set initial state
    if (isVisible && text) {
      webApp.MainButton.setText(text);
      webApp.MainButton.show();
    } else {
      webApp.MainButton.hide();
    }

    if (isLoading) {
      webApp.MainButton.showProgress();
    } else {
      webApp.MainButton.hideProgress();
    }

    if (isEnabled) {
      webApp.MainButton.enable();
    } else {
      webApp.MainButton.disable();
    }

    // Set click handler using ref
    const currentHandler = onClickRef.current;
    if (currentHandler) {
      webApp.MainButton.onClick(currentHandler);
    }

    // Cleanup
    return () => {
      if (currentHandler) {
        webApp.MainButton.offClick(currentHandler);
      }
    };
  }, [isVisible, text, isLoading, isEnabled]);

  const show = useCallback((buttonText: string, handler: () => void, enabled = true) => {
    setText(buttonText);
    onClickRef.current = handler;
    setIsVisible(true);
    setIsEnabled(enabled);
  }, []);

  const hide = useCallback(() => {
    setIsVisible(false);
    setText('');
    onClickRef.current = null;
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabled(enabled);
  }, []);

  // Memoize return object to prevent unnecessary re-renders
  return useMemo(() => ({
    show,
    hide,
    setLoading,
    setEnabled,
    isVisible,
    text,
    isLoading,
  }), [show, hide, setLoading, setEnabled, isVisible, text, isLoading]);
}

/**
 * Hook to control Telegram BackButton
 * BackButton is the native back arrow in Telegram header
 */
export function useTelegramBackButton() {
  const [isVisible, setIsVisible] = useState(false);
  
  // Use ref to store the handler function to avoid re-attaching listeners
  const onClickRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isTelegramWebApp()) return;

    // Use @twa-dev/sdk directly
    const webApp = WebApp;

    if (isVisible) {
      webApp.BackButton.show();
    } else {
      webApp.BackButton.hide();
    }

    const currentHandler = onClickRef.current;
    if (currentHandler) {
      webApp.BackButton.onClick(currentHandler);
    }

    // Cleanup
    return () => {
      if (currentHandler) {
        webApp.BackButton.offClick(currentHandler);
      }
    };
  }, [isVisible]);

  const show = useCallback((handler: () => void) => {
    onClickRef.current = handler;
    setIsVisible(true);
  }, []);

  const hide = useCallback(() => {
    setIsVisible(false);
    onClickRef.current = null;
  }, []);

  // Memoize return object to prevent unnecessary re-renders
  return useMemo(() => ({
    show,
    hide,
    isVisible,
  }), [show, hide, isVisible]);
}

/**
 * Hook to trigger haptic feedback
 */
export function useTelegramHaptics() {
  const impactOccurred = useCallback((style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') => {
    if (!isTelegramWebApp()) return;

    try {
      WebApp.HapticFeedback.impactOccurred(style);
    } catch (error) {
      console.warn('Haptic feedback not available:', error);
    }
  }, []);

  const notificationOccurred = useCallback((type: 'error' | 'success' | 'warning' = 'success') => {
    if (!isTelegramWebApp()) return;

    try {
      WebApp.HapticFeedback.notificationOccurred(type);
    } catch (error) {
      console.warn('Haptic feedback not available:', error);
    }
  }, []);

  return {
    impactOccurred,
    notificationOccurred,
  };
}

/**
 * Hook to get Telegram theme colors
 * Returns CSS variables that can be used in styles
 */
export function useTelegramTheme() {
  const [theme, setTheme] = useState<{
    bgColor: string;
    textColor: string;
    hintColor: string;
    linkColor: string;
    buttonColor: string;
    buttonTextColor: string;
  } | null>(null);

  useEffect(() => {
    if (!isTelegramWebApp()) {
      setTheme(null);
      return;
    }

    // Use @twa-dev/sdk directly
    const webApp = WebApp;

    // Get theme colors from Telegram
    const colors = {
      bgColor: webApp.themeParams.bg_color || '#ffffff',
      textColor: webApp.themeParams.text_color || '#000000',
      hintColor: webApp.themeParams.hint_color || '#999999',
      linkColor: webApp.themeParams.link_color || '#2481cc',
      buttonColor: webApp.themeParams.button_color || '#2481cc',
      buttonTextColor: webApp.themeParams.button_text_color || '#ffffff',
    };

    setTheme(colors);

    // Apply CSS variables to document root
    const root = document.documentElement;
    root.style.setProperty('--tg-theme-bg-color', colors.bgColor);
    root.style.setProperty('--tg-theme-text-color', colors.textColor);
    root.style.setProperty('--tg-theme-hint-color', colors.hintColor);
    root.style.setProperty('--tg-theme-link-color', colors.linkColor);
    root.style.setProperty('--tg-theme-button-color', colors.buttonColor);
    root.style.setProperty('--tg-theme-button-text-color', colors.buttonTextColor);

    // Listen for theme changes
    const handleThemeChange = () => {
      const updatedColors = {
        bgColor: webApp.themeParams.bg_color || '#ffffff',
        textColor: webApp.themeParams.text_color || '#000000',
        hintColor: webApp.themeParams.hint_color || '#999999',
        linkColor: webApp.themeParams.link_color || '#2481cc',
        buttonColor: webApp.themeParams.button_color || '#2481cc',
        buttonTextColor: webApp.themeParams.button_text_color || '#ffffff',
      };
      setTheme(updatedColors);
      
      root.style.setProperty('--tg-theme-bg-color', updatedColors.bgColor);
      root.style.setProperty('--tg-theme-text-color', updatedColors.textColor);
      root.style.setProperty('--tg-theme-hint-color', updatedColors.hintColor);
      root.style.setProperty('--tg-theme-link-color', updatedColors.linkColor);
      root.style.setProperty('--tg-theme-button-color', updatedColors.buttonColor);
      root.style.setProperty('--tg-theme-button-text-color', updatedColors.buttonTextColor);
    };

    // Telegram WebApp may emit theme change events
    webApp.onEvent('themeChanged', handleThemeChange);

    return () => {
      webApp.offEvent('themeChanged', handleThemeChange);
    };
  }, []);

  return theme;
}
