// expo-file-system v19 moved classic API to /legacy
import * as FileSystem from "expo-file-system/legacy";
import { CSS_OVERRIDES } from "@/utils/injectedJS";

const CACHE_DIR = `${FileSystem.documentDirectory}doogo_page_cache/`;
const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

/**
 * Critical pages to pre-fetch and serve instantly.
 * key        — filename on disk (no extension)
 * url        — canonical URL to fetch
 * urlAliases — other URL forms that should also resolve to this cache entry
 */
export const CRITICAL_PAGES: Array<{
  key: string;
  url: string;
  urlAliases: string[];
}> = [
  {
    key: "home",
    url: "https://doogo.shop/",
    urlAliases: ["https://doogo.shop"],
  },
  {
    key: "shop",
    url: "https://doogo.shop/shop/",
    urlAliases: ["https://doogo.shop/shop"],
  },
  {
    key: "wishlist",
    url: "https://doogo.shop/wishlist/",
    urlAliases: ["https://doogo.shop/wishlist"],
  },
  {
    key: "account",
    url: "https://doogo.shop/my-account/",
    urlAliases: ["https://doogo.shop/my-account"],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function htmlPath(key: string) {
  return `${CACHE_DIR}${key}.html`;
}
function metaPath(key: string) {
  return `${CACHE_DIR}${key}.meta.json`;
}

async function ensureCacheDir() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

/** Returns the cache key for a given URL, or null if not a critical page */
export function urlToCacheKey(url: string): string | null {
  for (const page of CRITICAL_PAGES) {
    if (url === page.url || page.urlAliases.includes(url)) return page.key;
  }
  return null;
}

/** Returns the canonical URL for a cache key */
export function cacheKeyToUrl(key: string): string {
  return CRITICAL_PAGES.find((p) => p.key === key)?.url ?? "";
}

// ─── CSS + base injection ─────────────────────────────────────────────────────

/**
 * Bake CSS overrides and a <base> tag directly into the cached HTML.
 * This means the HTML served from disk needs zero JS to apply styles — no flash ever.
 */
function embedOverrides(html: string, canonicalUrl: string): string {
  const baseTag = `<base href="${canonicalUrl}">`;
  const styleTag = `<style id="doogo-app-overrides">${CSS_OVERRIDES}</style>`;
  const viewportTag = `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">`;

  // Remove existing viewport/base if present to avoid duplicates
  let patched = html
    .replace(/<base[^>]*>/gi, "")
    .replace(/<meta[^>]*name=["']viewport["'][^>]*>/gi, "");

  // Inject into <head> — right after the opening tag
  patched = patched.replace(
    /<head([^>]*)>/i,
    `<head$1>${baseTag}${viewportTag}${styleTag}`
  );

  return patched;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Read cached HTML from disk. Returns null if missing or stale. */
export async function getCachedHtml(key: string): Promise<string | null> {
  try {
    const file = htmlPath(key);
    const meta = metaPath(key);

    const [fileInfo, metaInfo] = await Promise.all([
      FileSystem.getInfoAsync(file),
      FileSystem.getInfoAsync(meta),
    ]);
    if (!fileInfo.exists) return null;

    if (metaInfo.exists) {
      const m = JSON.parse(await FileSystem.readAsStringAsync(meta));
      if (Date.now() - m.timestamp > CACHE_MAX_AGE_MS) return null;
    }

    return FileSystem.readAsStringAsync(file);
  } catch {
    return null;
  }
}

/** Fetch a single page from the network, embed overrides, and save to disk. */
export async function fetchAndCachePage(
  key: string,
  url: string
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;

    const rawHtml = await res.text();
    const patchedHtml = embedOverrides(rawHtml, url);

    await ensureCacheDir();
    await Promise.all([
      FileSystem.writeAsStringAsync(htmlPath(key), patchedHtml),
      FileSystem.writeAsStringAsync(
        metaPath(key),
        JSON.stringify({ timestamp: Date.now(), url })
      ),
    ]);

    return patchedHtml;
  } catch {
    return null;
  }
}

/**
 * Load all critical pages into the in-memory map.
 * Returns a map of key → html for all pages that were already cached on disk.
 * Kicks off background network refresh for each page concurrently.
 */
export async function initPageCache(onUpdate: (key: string, html: string) => void): Promise<Map<string, string>> {
  const cached = new Map<string, string>();

  await Promise.all(
    CRITICAL_PAGES.map(async ({ key, url }) => {
      // 1. Serve whatever is on disk immediately (may be stale or absent)
      const diskHtml = await getCachedHtml(key);
      if (diskHtml) {
        cached.set(key, diskHtml);
      }

      // 2. Always fetch fresh copy in background, notify caller when done
      fetchAndCachePage(key, url)
        .then((freshHtml) => {
          if (freshHtml) onUpdate(key, freshHtml);
        })
        .catch(() => {});
    })
  );

  return cached;
}
