// Centralized API base URL helper for exdollarium-notifier
// Prefer the Expo-configured value (extra.apiUrl) for native/EAS builds, then
// fall back to the web-style REACT_APP_API_URL. Ensure the URL has no trailing slash.
let API_BASE = '';

try {
	// Importing expo-constants is safe on native; on web this may be undefined, so guard access.
	const Constants = require('expo-constants');
	const extraApi = Constants?.expoConfig?.extra?.apiUrl;
	if (extraApi) {
		API_BASE = String(extraApi).replace(/\/$/, '');
	}
} catch (e) {
	// expo-constants not available (e.g., simple web build), we'll fallback below
}

if (!API_BASE && process.env.REACT_APP_API_URL) {
	API_BASE = String(process.env.REACT_APP_API_URL).replace(/\/$/, '');
}

export default API_BASE;
