import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';

export function useCapacitor() {
  const [isNative, setIsNative] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [platform, setPlatform] = useState<'web' | 'ios' | 'android'>('web');

  useEffect(() => {
    const isNativeApp = Capacitor.isNativePlatform();
    setIsNative(isNativeApp);
    setPlatform(Capacitor.getPlatform() as 'web' | 'ios' | 'android');

    if (isNativeApp) {
      initializeNativeApp();
    }
  }, []);

  const initializeNativeApp = async () => {
    try {
      // Hide splash screen after app is ready
      await SplashScreen.hide();

      // Configure status bar
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#2d5a47' });

      // Setup keyboard listeners
      Keyboard.addListener('keyboardWillShow', (info) => {
        setKeyboardVisible(true);
        setKeyboardHeight(info.keyboardHeight);
        document.body.classList.add('keyboard-open');
        document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
      });

      Keyboard.addListener('keyboardWillHide', () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
        document.body.classList.remove('keyboard-open');
        document.documentElement.style.setProperty('--keyboard-height', '0px');
      });
    } catch (error) {
      console.warn('Error initializing native app:', error);
    }
  };

  // Haptic feedback functions
  const hapticImpact = useCallback(async (style: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      const impactStyle = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
      }[style];
      
      await Haptics.impact({ style: impactStyle });
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }, []);

  const hapticNotification = useCallback(async (type: 'success' | 'warning' | 'error' = 'success') => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      const notificationType = {
        success: NotificationType.Success,
        warning: NotificationType.Warning,
        error: NotificationType.Error,
      }[type];
      
      await Haptics.notification({ type: notificationType });
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }, []);

  const hapticSelection = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      await Haptics.selectionStart();
      await Haptics.selectionChanged();
      await Haptics.selectionEnd();
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }, []);

  // Status bar functions
  const setStatusBarDark = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    await StatusBar.setStyle({ style: Style.Dark });
  }, []);

  const setStatusBarLight = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    await StatusBar.setStyle({ style: Style.Light });
  }, []);

  const hideStatusBar = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    await StatusBar.hide();
  }, []);

  const showStatusBar = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    await StatusBar.show();
  }, []);

  // Keyboard functions
  const hideKeyboard = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    await Keyboard.hide();
  }, []);

  return {
    isNative,
    platform,
    keyboardVisible,
    keyboardHeight,
    hapticImpact,
    hapticNotification,
    hapticSelection,
    setStatusBarDark,
    setStatusBarLight,
    hideStatusBar,
    showStatusBar,
    hideKeyboard,
  };
}

// Utility hook for detecting if running in Capacitor
export function useIsNative() {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  return isNative;
}

// Utility to get platform
export function usePlatform() {
  const [platform, setPlatform] = useState<'web' | 'ios' | 'android'>('web');

  useEffect(() => {
    setPlatform(Capacitor.getPlatform() as 'web' | 'ios' | 'android');
  }, []);

  return platform;
}
