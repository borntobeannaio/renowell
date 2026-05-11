import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.renowell.app',
  appName: 'Renowell',
  webDir: 'dist',
  // В production-сборке server не задаётся: приложение должно грузить локальные файлы из webDir.
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#6366f1',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#6366f1',
    },
    Keyboard: {
      resize: 'body',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  ios: {
    contentInset: 'always',
  },
};

export default config;
