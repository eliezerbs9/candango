// The mobile app is a self-contained project (excluded from the monorepo npm
// workspaces) with its own node_modules, so the default Metro config is all we
// need — no monorepo watchFolders/nodeModulesPaths (those would pull the root's
// SDK-57 copies back in and reintroduce duplicate native modules).
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
