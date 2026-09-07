import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration.
 *
 * The app ships as a static Angular build loaded from the device. The API is
 * NOT bundled: `server.url` is deliberately unset so a release build can never
 * be pointed at a development machine, and the API base URL comes from the
 * environment file compiled into the bundle.
 *
 * Note what is absent: no microphone, audio, or telephony plugins. AutoCall
 * bridges calls on the provider's network and the conversation happens on the
 * user's own handset dialler, so the app never captures or plays call audio
 * and must not request permissions implying otherwise.
 */
const config: CapacitorConfig = {
  appId: 'com.automail.autocaller',
  appName: 'AutoCall & AutoMail',
  webDir: 'dist/automail-frontend/browser',

  android: {
    // Cleartext stays off: the API is reached over HTTPS in every build.
    allowMixedContent: false,
  },

  ios: {
    contentInset: 'always',
    limitsNavigationsToAppBoundDomains: true,
  },

  plugins: {
    CapacitorHttp: {
      /**
       * Native HTTP is enabled so requests are issued by the OS stack rather
       * than the WebView. This is what allows the session cookie to persist
       * on a native origin, where a browser-style third-party cookie would
       * otherwise be dropped.
       */
      enabled: true,
    },
  },
};

export default config;
