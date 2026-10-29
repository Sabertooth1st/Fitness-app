// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web build loads a WebAssembly SQLite binary (used for browser smoke tests).
config.resolver.assetExts.push('wasm');

module.exports = config;
