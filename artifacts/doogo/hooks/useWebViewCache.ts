import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

const PRECACHE_URLS = [
  "https://doogo.shop",
  "https://doogo.shop/shop",
  "https://doogo.shop/wishlist",
  "https://doogo.shop/my-account",
];

const CACHE_KEY_PREFIX = "webview_cache_";
const CACHE_TIMESTAMP_KEY = "webview_cache_timestamp_";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function useWebViewCache() {
  const [precachedUrls, setPrecachedUrls] = useState<Set<string>>(new Set());
  const cacheInitialized = useRef(false);

  const getCachedUrl = useCallback(async (url: string): Promise<string | null> => {
    try {
      const timestampStr = await AsyncStorage.getItem(CACHE_TIMESTAMP_KEY + url);
      if (!timestampStr) return null;
      const timestamp = parseInt(timestampStr, 10);
      if (Date.now() - timestamp > CACHE_TTL) {
        await AsyncStorage.removeItem(CACHE_KEY_PREFIX + url);
        await AsyncStorage.removeItem(CACHE_TIMESTAMP_KEY + url);
        return null;
      }
      return await AsyncStorage.getItem(CACHE_KEY_PREFIX + url);
    } catch {
      return null;
    }
  }, []);

  const setCachedUrl = useCallback(async (url: string, html: string) => {
    try {
      await AsyncStorage.setItem(CACHE_KEY_PREFIX + url, html);
      await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY + url, Date.now().toString());
    } catch {
    }
  }, []);

  useEffect(() => {
    if (cacheInitialized.current) return;
    cacheInitialized.current = true;

    const checkCached = async () => {
      const cached = new Set<string>();
      for (const url of PRECACHE_URLS) {
        const html = await getCachedUrl(url);
        if (html) cached.add(url);
      }
      setPrecachedUrls(cached);
    };

    checkCached();
  }, [getCachedUrl]);

  const isPrecacheUrl = useCallback((url: string) => {
    return PRECACHE_URLS.some((u) => url.startsWith(u));
  }, []);

  return { precachedUrls, getCachedUrl, setCachedUrl, isPrecacheUrl, PRECACHE_URLS };
}
