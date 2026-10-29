// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The web preview uses sql.js's pure-JavaScript build (src/data/local/DbProvider.web.tsx).
// It contains Node-only branches that are never taken in a browser; stub those modules for web.
const NODE_ONLY = new Set(['node:fs', 'node:crypto', 'fs', 'crypto', 'path']);
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && NODE_ONLY.has(moduleName) && context.originModulePath.includes('sql.js')) {
    return { type: 'empty' };
  }
  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
