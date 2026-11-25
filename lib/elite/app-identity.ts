// Who the iPhone app is, to Apple. Both are public identifiers, not
// secrets: the Team ID of the Apple Developer account and the app's bundle
// ID (mobile/app.json). Together they name the app in the file an iPhone
// reads from thestriveapp.com (app/.well-known/apple-app-site-association).
export const APPLE_TEAM_ID = "LPZWVS6D54";
export const IOS_BUNDLE_ID = "com.strivesoccer.elite";
export const IOS_APP_ID = `${APPLE_TEAM_ID}.${IOS_BUNDLE_ID}`;
// The domain the app and the site share passwords on.
export const APP_DOMAIN = "thestriveapp.com";
