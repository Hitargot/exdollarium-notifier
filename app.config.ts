import { ExpoConfig, ConfigContext } from '@expo/config';
try {
  require('dotenv/config');
} catch {}

const withCustomAndroidManifest = require('./plugins/withAndroidManifest');
const fs = require('fs');

// Helper function to dynamically get the Bundle Identifier/Package Name
type AppVariant = 'development' | 'production' | 'preview' | string;

interface BundleIdentifierResolver {
  (variant: AppVariant): string;
}

const getBundleIdentifier: BundleIdentifierResolver = (variant: AppVariant): string => {
  const baseId: string = 'com.omarlareef.exdollarium';
  
  // Append a suffix for development/test builds
  if (variant === 'development') {
    return baseId + '.dev'; // e.g., com.omarlareef.exdollarium.dev
  }
  // This will be the standard ID for preview and production
  return baseId; 
};

interface EasConfig {
  projectId: string;
}

interface AppExtra {
  apiUrl: string;
  env: string;
  eas: EasConfig;
}

interface WebConfig {
  favicon: string;
}

interface BaseConfig {
  name: string;
  slug: string;
  jsEngine?: string;
  version: string;
  owner?: string;
  extra: AppExtra;
  web?: WebConfig;
  [key: string]: any;
}

interface AdaptiveIcon {
  foregroundImage: string;
  backgroundColor: string;
}

interface AndroidConfig {
  package?: string;
  jsEngine?: string;
  googleServicesFile?: string;
  versionCode?: number;
  adaptiveIcon?: AdaptiveIcon;
}

interface SplashConfig {
  image: string;
  resizeMode: string;
  backgroundColor: string;
}

interface NotificationConfig {
  icon: string;
  color: string;
}

interface IOSInfoPlist {
  NSPhotoLibraryUsageDescription?: string;
  NSPhotoLibraryAddUsageDescription?: string;
  NSCameraUsageDescription?: string;
  NSMicrophoneUsageDescription?: string;
  NSUserTrackingUsageDescription?: string;
  ITSAppUsesNonExemptEncryption?: boolean;
}

interface IOSConfig {
  bundleIdentifier?: string;
  jsEngine?: string;
  supportsTablet?: boolean;
  infoPlist?: IOSInfoPlist;
}

type Plugin = string | [string, any];

interface ManagedOnlyConfig {
  orientation?: string;
  icon?: string;
  userInterfaceStyle?: string;
  scheme?: string;
  android?: AndroidConfig;
  splash?: SplashConfig;
  notification?: NotificationConfig;
  ios?: IOSConfig;
  plugins?: Plugin[];
}

export default (ctx: ConfigContext): ExpoConfig => {
  const hasNative: boolean = fs.existsSync('./android') || fs.existsSync('./ios');
  
  // Read the environment variable set in eas.json
  const appVariant: string = process.env.APP_VARIANT || 'production'; 

  // Defensive parsing for API_URL: trim surrounding quotes/spaces which sometimes
  // appear when values are copied into .env files or CI environment variables.
  const rawApiUrl: string = typeof process !== 'undefined' ? (process.env.API_URL || '') : '';
  const parsedApiUrl = rawApiUrl.replace(/^['\"]|['\"]$/g, '').trim();

  const baseConfig: BaseConfig = {
    name: 'Exdollarium',
    slug: 'exdollarium',
    jsEngine: 'hermes',
    version: '1.0.0',
    owner: 'omarlareef',
    
    extra: {
      apiUrl: parsedApiUrl || 'http://192.168.113.183:22222',
      env: process.env.ENV || 'development',
      eas: {
        projectId: '0cbdd3e6-2417-42e7-aab8-d50a552f8077',
      },
    },

    web: {
      favicon: './assets/Exdollarium-11.png',
    },

    // Ensure iOS bundle identifier is defined for builds that require it, and
    // include ITSAppUsesNonExemptEncryption in infoPlist so EAS/expo builds
    // don't try to modify the dynamic config programmatically.
    ios: {
      bundleIdentifier: getBundleIdentifier(appVariant),
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
  };

  // Only applied when no native folders exist
  const managedOnlyConfig: ManagedOnlyConfig | {} = hasNative
    ? {}
    : {
        orientation: 'portrait',
        icon: './assets/IMG_940.PNG',
        userInterfaceStyle: 'light',
        scheme: 'exdollarium',

        android: {
          // DYNAMICALLY SETS ANDROID PACKAGE
          package: getBundleIdentifier(appVariant), 
          jsEngine: 'hermes',
          googleServicesFile: './google-services.json',
          versionCode: 14,
          adaptiveIcon: {
            foregroundImage: './assets/IMG_940.PNG',
            backgroundColor: '#162660',
          },
        },

        splash: {
          image: './assets/IMG_940.PNG',
          resizeMode: 'contain',
          backgroundColor: '#162660',
        },

        notification: {
          icon: './assets/IMG_940.PNG',
          color: '#162660',
        },

        ios: {
          // DYNAMICALLY SETS iOS BUNDLE IDENTIFIER
          bundleIdentifier: getBundleIdentifier(appVariant), 
          jsEngine: 'hermes',
          supportsTablet: true,
          infoPlist: {
            NSPhotoLibraryUsageDescription:
              'The app needs access to your photo library to save and share receipts and images.',
            NSPhotoLibraryAddUsageDescription:
              'The app needs to add photos to your library when exporting receipts or images.',
            NSCameraUsageDescription:
              'The app may use your camera to capture images for receipts or profile photos.',
            NSMicrophoneUsageDescription:
              'Microphone access may be needed for certain voice or media features.',
            NSUserTrackingUsageDescription:
              'We may use tracking to provide personalized experiences. You can opt out in settings.',
            ITSAppUsesNonExemptEncryption: false,
          },
        },

        plugins: [
          [
            'expo-build-properties',
            {
              android: {
                googleServicesFile: './google-services.json',
                package: 'com.omarlareef.exdollarium',
              },
            },
          ],
          'expo-secure-store',
        ],
      };

  let config: any = Object.assign({}, baseConfig, managedOnlyConfig);

  config = withCustomAndroidManifest(config);

  return config as ExpoConfig;
};