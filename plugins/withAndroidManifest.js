// Load `withAndroidManifest` from either `expo/config-plugins` or
// `@expo/config-plugins` when available. If neither package is
// installed (e.g., during initial `npm install`), fall back to a
// safe no-op implementation so the Expo CLI can evaluate app.config.ts
// without failing.
let withAndroidManifest;
try {
  // Prefer the re-export provided by the `expo` package
  ({ withAndroidManifest } = require('expo/config-plugins'));
} catch (e1) {
  try {
    // Fallback to the standalone package name if present
    ({ withAndroidManifest } = require('@expo/config-plugins'));
  } catch (e2) {
    // Last-resort shim: a no-op implementation that invokes the
    // provided modifier function (if any) but always returns the
    // original config synchronously. We intentionally do NOT
    // propagate Promises here because returning a Promise from the
    // root config file causes the Expo CLI to fail with
    // "Config file cannot return a Promise".
    withAndroidManifest = (config, modFn) => {
      try {
        if (typeof modFn === 'function') {
          // Call the modifier for side-effects if possible but do not
          // rely on any asynchronous return value.
          try {
            modFn(config);
          } catch (err) {
            // ignore modifier errors in shim mode
          }
        }
      } catch (err) {
        // ignore
      }
      return config;
    };
  }
}

const withCustomAndroidManifest = (config) => {
  // Use a synchronous modifier function to avoid returning a Promise
  // from the top-level config file. The real `withAndroidManifest`
  // implementation will accept sync modifiers; this keeps behavior
  // consistent even when running before all packages are installed.
  return withAndroidManifest(config, (config) => {
    try {
      // Be defensive: `config.modResults` may be undefined in some CLI
      // evaluation contexts (or if the plugin system isn't fully
      // initialized). Default to empty objects to avoid TypeErrors.
      const androidManifest = config.modResults || {};
      const application = androidManifest.manifest?.application?.[0];
      const manifest = config.modResults || {};

      if (application) {
        const metaData = application['meta-data'] || [];
      
      // Firebase Default Notification Color
      const firebaseMessagingMetaData = metaData?.find(
        (item) => item?.$['android:name'] === 'com.google.firebase.messaging.default_notification_color'
      );

      if (firebaseMessagingMetaData) {
        // Modify the existing Firebase entry with tools:replace
        firebaseMessagingMetaData.$['android:resource'] = '@color/notification_icon_color';
        firebaseMessagingMetaData.$['tools:replace'] = 'android:resource';
        console.log('✅ Replaced Firebase default notification color in AndroidManifest.xml');
      } else {
        // Add Firebase default notification color if not present
        if (!application['meta-data']) {
          application['meta-data'] = [];
        }
        application['meta-data'].push({
          $: {
            'android:name': 'com.google.firebase.messaging.default_notification_color',
            'android:resource': '@color/notification_icon_color',
            'tools:replace': 'android:resource',
          },
        });
        console.log('✅ Added Firebase default notification color to AndroidManifest.xml');
      }

      // Ensure the app has an intent-filter for the custom URI scheme so deep links work on Android
      try {
        const scheme = 'exdollarium'; // keep in sync with app.config.ts
        // application.activity is an array of activity entries
        if (application) {
          if (!application.activity) application.activity = [];
          // try to find the main activity (common names: MainActivity, HostActivity)
          let mainActivity = application.activity.find((a) => {
            const name = a?.$?.['android:name'] || '';
            return /MainActivity|HostActivity|MainActivityDelegate/.test(name);
          }) || application.activity[0];

          if (mainActivity) {
            if (!mainActivity['intent-filter']) mainActivity['intent-filter'] = [];
            const hasScheme = mainActivity['intent-filter'].some((f) => {
              return Array.isArray(f.data) && f.data.some(d => d && d.$ && (d.$['android:scheme'] === scheme));
            });

            if (!hasScheme) {
              // Add a VIEW intent-filter with BROWSABLE + DEFAULT categories and the scheme data
              mainActivity['intent-filter'].push({
                action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
                category: [
                  { $: { 'android:name': 'android.intent.category.DEFAULT' } },
                  { $: { 'android:name': 'android.intent.category.BROWSABLE' } }
                ],
                data: [ { $: { 'android:scheme': scheme } } ]
              });
              console.log(`✅ Added deep link intent-filter for scheme '${scheme}' to AndroidManifest`);
            }
          }
        }
      } catch (err) {
        console.error('[withAndroidManifest] Failed to add deep link intent-filter:', err);
      }

        // Expo Default Notification Color
        const expoNotificationsMetaData = metaData.find(
          (item) => item?.$?.['android:name'] === 'expo.modules.notifications.default_notification_color'
        );

        if (expoNotificationsMetaData) {
          // Modify the existing Expo entry with tools:replace
          expoNotificationsMetaData.$['android:resource'] = '@color/notification_icon_color';
          expoNotificationsMetaData.$['tools:replace'] = 'android:resource';
          console.log('✅ Replaced Expo default notification color in AndroidManifest.xml');
        } else {
          // Add Expo default notification color if not present
          if (!application['meta-data']) {
            application['meta-data'] = [];
          }
          application['meta-data'].push({
            $: {
              'android:name': 'expo.modules.notifications.default_notification_color',
              'android:resource': '@color/notification_icon_color',
              'tools:replace': 'android:resource',
            },
          });
          console.log('✅ Added Expo default notification color to AndroidManifest.xml');
        }
      
      // Expo Default Notification Icon
      const expoIconMetaData = metaData?.find(
        (item) => item?.$['android:name'] === 'expo.modules.notifications.default_notification_icon'
      );

      if (expoIconMetaData) {
        // Modify the existing Expo entry with tools:replace
        expoIconMetaData.$['android:resource'] = '@drawable/notification_icon';
        expoIconMetaData.$['tools:replace'] = 'android:resource';
        console.log('✅ Replaced Expo default notification icon in AndroidManifest.xml');
      } else {
        // Add Expo default notification icon if not present
        if (!application['meta-data']) {
          application['meta-data'] = [];
        }
        application['meta-data'].push({
          $: {
            'android:name': 'expo.modules.notifications.default_notification_icon',
            'android:resource': '@drawable/notification_icon',
            'tools:replace': 'android:resource',
          },
        });
        console.log('✅ Added Expo default notification icon to AndroidManifest.xml');
      }
    }

    // Ensure the notification color is defined in colors.xml
    const resources = androidManifest.manifest?.resources;
    if (resources) {
      let colorArray = resources.color;
      if (!colorArray) {
        resources.color = [];
        colorArray = resources.color;
      }

      const notificationColorDefined = colorArray.some(
        (color) => color?.$?.name === 'notification_icon_color'
      );

      if (!notificationColorDefined) {
        // Use '_' to set inner text for xml-js compatibility
        colorArray.push({
          $: { name: 'notification_icon_color' },
          _: '#FF6600',
        });
        console.log('✅ Ensured notification_icon_color is defined in colors.xml');
      }
    }

      if (!manifest.manifest) manifest.manifest = {};
      if (!manifest.manifest['$']) manifest.manifest['$'] = {};
      manifest.manifest['$']['xmlns:tools'] = 'http://schemas.android.com/tools';

      return config;
    } catch (err) {
      console.error('[withAndroidManifest] Failed to modify AndroidManifest:', err);
      // Fail-safe: return original config unmodified so Expo can continue without the plugin changes
      return config;
    }
  });
};

module.exports = withCustomAndroidManifest;
