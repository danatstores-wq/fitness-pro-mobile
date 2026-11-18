const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// expo-sqlite uses a WebAssembly module on the web platform.
config.resolver.assetExts = [...config.resolver.assetExts, "wasm"];

module.exports = config;
