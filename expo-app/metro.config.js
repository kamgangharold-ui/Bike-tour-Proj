const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Expo SDK 54 sets unstable_conditionNames to [] by default, which means Metro
// ignores the react-native export condition when resolving packages.json exports.
// @firebase/auth has a react-native export that points to its RN bundle — without
// this fix Metro loads the browser bundle which fails to register the auth component.
config.resolver.unstable_conditionNames = ['react-native', 'browser', 'require'];

module.exports = config;
