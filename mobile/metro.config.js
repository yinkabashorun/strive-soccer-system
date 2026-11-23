// Metro for the Strive Elite iPhone app.
//
// The app shares the site's pure rules (session flow, the set timer, the
// quiz, time trained, the experience rules) straight from ../lib/elite
// through the "@shared/*" path in tsconfig.json, so a rule is never written
// twice. Metro only bundles files it watches, so that one folder is
// watched too. tests/app-shared.test.ts (in the site) holds that every file
// reached that way imports nothing that runs on the server.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const shared = path.resolve(__dirname, "../lib/elite");

config.watchFolders = [...(config.watchFolders ?? []), shared];
// Shared files resolve packages from the app's own node_modules only.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];

module.exports = config;
