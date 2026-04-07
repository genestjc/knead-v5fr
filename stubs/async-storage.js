// Browser stub for @react-native-async-storage/async-storage
// MetaMask SDK imports this for React Native storage — in a browser we route to localStorage.
const AsyncStorage = {
  getItem: async (key) => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: async (key, value) => {
    try { localStorage.setItem(key, value); } catch {}
  },
  removeItem: async (key) => {
    try { localStorage.removeItem(key); } catch {}
  },
  clear: async () => {
    try { localStorage.clear(); } catch {}
  },
  getAllKeys: async () => {
    try { return Object.keys(localStorage); } catch { return []; }
  },
  multiGet: async (keys) => {
    try { return keys.map(key => [key, localStorage.getItem(key)]); } catch { return []; }
  },
  multiSet: async (pairs) => {
    try { pairs.forEach(([key, value]) => localStorage.setItem(key, value)); } catch {}
  },
  multiRemove: async (keys) => {
    try { keys.forEach(key => localStorage.removeItem(key)); } catch {}
  },
};

module.exports = AsyncStorage;
module.exports.default = AsyncStorage;
