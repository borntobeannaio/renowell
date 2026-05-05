import { Capacitor } from '@capacitor/core';

/**
 * Инициализация нативных плагинов Capacitor.
 * Вызывается один раз при старте приложения.
 * На вебе тихо ничего не делает.
 */
export async function initNativeApp() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#6366f1' });
    }
  } catch (err) {
    console.warn('[NativeInit] StatusBar', err);
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch (err) {
    console.warn('[NativeInit] SplashScreen', err);
  }

  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else App.exitApp();
    });
  } catch (err) {
    console.warn('[NativeInit] App back button', err);
  }
}
