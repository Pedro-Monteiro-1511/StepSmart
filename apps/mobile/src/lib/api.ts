import axios from 'axios';
import { clearToken, getStoredToken } from './storage';

// Expo inlines EXPO_PUBLIC_* env vars at build time. On a physical device/simulator
// "localhost" means the device itself, not your dev machine — point this at your
// machine's LAN IP (e.g. http://192.168.1.20:3000) via apps/mobile/.env.
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(async (config) => {
  const token = await getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await clearToken();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);
