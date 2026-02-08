Test setup for opt-in feature testing

This document shows quick ways testers can opt into the backend `newApi` feature without changing production builds.

1) Recommended (no app code changes): use curl/Postman with header

- Set the backend TEST_CLIENT_TOKEN in Heroku (or your backend env):

```powershell
heroku config:set TEST_CLIENT_TOKEN="some-strong-token" --app your-heroku-app
```

- Test using curl:

```bash
curl -X POST "https://your-heroku-app.herokuapp.com/api/auth/signup" \
  -H "Content-Type: application/json" \
  -H "X-Test-Token: some-strong-token" \
  -d '{"username":"t","email":"t@t.com","password":"pass","agreedToTerms":true}'
```

2) Quick dev device (no rebuild) — use React Native debug console

- In development, open Remote JS Debugger (or Flipper JS console) and run:

```javascript
// set test token in AsyncStorage
require('./src/utils/testTokenHelper').setTestToken('some-strong-token');
// confirm
require('./src/utils/testTokenHelper').getTestToken().then(console.log);
```

- The app's API client will attach `X-Test-Token` automatically from AsyncStorage and requests will be opt-in.

3) Test build (recommended for QA): include token in EAS / Expo config

- Add `TEST_CLIENT_TOKEN` to your app config `extra` in `app.json` / `app.config.js` or set as an EAS secret for the build profile.
- Example `app.config.js` snippet:

```js
export default ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    TEST_CLIENT_TOKEN: process.env.TEST_CLIENT_TOKEN,
  }
});
```

- Build a QA/test release and distribute to testers. The client automatically reads `Constants.expoConfig.extra.TEST_CLIENT_TOKEN` and attaches `X-Test-Token` to requests.

Security notes
- Never commit the test token to git or ship it in production builds. Use Heroku/EAS/Netlify secret stores.
- Rotate or revoke the test token after QA sessions.

How QA can verify activity
- Use the backend QA endpoint (protected by the same token):

```bash
curl -H "X-Test-Token: some-strong-token" https://your-heroku-app.herokuapp.com/internal/feature-events
```

This returns recent opt-in events (method, path, userId if available, queryKeys).
