// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Force Metro to resolve `react-async-hook` from the top-level
// node_modules to avoid picking up a nested package.json that
// points to non-existent ESM entry files inside some dependencies.
config.resolver = config.resolver || {};
config.resolver.extraNodeModules = Object.assign({}, config.resolver.extraNodeModules, {
	'react-async-hook': path.resolve(__dirname, 'node_modules', 'react-async-hook'),
});

module.exports = config;
