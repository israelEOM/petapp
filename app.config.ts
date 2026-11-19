import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json with settings that depend on credentials kept out of git (.env.local):
 * - EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID enables native Google sign-in (its reversed ID is the iOS URL scheme).
 * - APPLE_SIGN_IN=1 adds the Sign in with Apple entitlement; it needs a paid Apple Developer team.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const plugins = [...(config.plugins ?? [])];

  if (googleIosClientId) {
    const iosUrlScheme = `com.googleusercontent.apps.${googleIosClientId.replace('.apps.googleusercontent.com', '')}`;
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme }]);
  }
  if (process.env.APPLE_SIGN_IN === '1') plugins.push('expo-apple-authentication');

  return {
    ...config,
    name: config.name ?? 'PetApp',
    slug: config.slug ?? 'petapp',
    plugins,
    ios: { ...config.ios, usesAppleSignIn: process.env.APPLE_SIGN_IN === '1' },
  };
};
