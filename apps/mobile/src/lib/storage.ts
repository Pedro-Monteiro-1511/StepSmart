import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'stepsmart_access_token';

// expo-secure-store has no web implementation (no OS keychain to back it) — fall back to
// localStorage there. Native (iOS/Android), the actual target platforms, always use SecureStore.
const isWeb = Platform.OS === 'web';

export async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    return window.localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

export async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    window.localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const saveToken = (token: string) => setItem(TOKEN_KEY, token);
export const getStoredToken = () => getItem(TOKEN_KEY);
export const clearToken = () => deleteItem(TOKEN_KEY);
