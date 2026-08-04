class SafeBrowserStorage {
  get(key, fallback = null) {
    try {
      return window.localStorage.getItem(key) ?? fallback;
    } catch (error) {
      console.warn(`could not read ${key}:`, error);
      return fallback;
    }
  }

  set(key, value) {
    try {
      window.localStorage.setItem(key, String(value));
      return true;
    } catch (error) {
      console.warn(`could not save ${key}:`, error);
      return false;
    }
  }

  remove(key) {
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`could not remove ${key}:`, error);
      return false;
    }
  }

  getJson(key, fallback = null) {
    const storedValue = this.get(key);
    if (storedValue === null) return fallback;
    try {
      return JSON.parse(storedValue);
    } catch (error) {
      console.warn(`could not parse ${key}:`, error);
      return fallback;
    }
  }

  setJson(key, value) {
    try {
      return this.set(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`could not serialize ${key}:`, error);
      return false;
    }
  }
}

const appStorage = new SafeBrowserStorage();

function initializeFirebaseDatabase(config = firebaseConfig) {
  if (typeof firebase === "undefined") throw new Error("Firebase SDK is not loaded");
  if (!config?.databaseURL) throw new Error("Firebase database configuration is missing");
  if (!firebase.apps.length) firebase.initializeApp(config);
  return firebase.database();
}
