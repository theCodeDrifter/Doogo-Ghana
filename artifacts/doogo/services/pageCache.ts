import AsyncStorage from "@react-native-async-storage/async-storage";

import { CSS_OVERRIDES } from "@/utils/injectedJS";

const CACHE_PREFIX = "@doogo:page:";
const META_PREFIX = "@doogo:meta:";
const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

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

export function urlToCacheKey(url: string): string | null {
  for (const page of CRITICAL_PAGES) {
    if (url === page.url || page.urlAliases.includes(url)) return page.key;
  }
  return null;
}

export function cacheKeyToUrl(key: string): string {
  return CRITICAL_PAGES.find((p) => p.key === key)?.url ?? "";
}

async function getStored(key: string): Promise<string | null> {
  try {
    const [html, metaStr] = await Promise.all([
      AsyncStorage.getItem(CACHE_PREFIX + key),
      AsyncStorage.getItem(META_PREFIX + key),
    ]);
    if (!html) return null;
    if (metaStr) {
      const meta = JSON.parse(metaStr);
      if (Date.now() - meta.timestamp > CACHE_MAX_AGE_MS) return null;
    }
    return html;
  } catch {
    return null;
  }
}

async function setStored(key: string, html: string): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.setItem(CACHE_PREFIX + key, html),
      AsyncStorage.setItem(
        META_PREFIX + key,
        JSON.stringify({ timestamp: Date.now() })
      ),
    ]);
  } catch {
    // silently skip if storage is full or unavailable
  }
}

function embedOverrides(html: string, canonicalUrl: string): string {
  const baseTag = `<base href="${canonicalUrl}">`;
  const styleTag = `<style id="doogo-app-overrides">${CSS_OVERRIDES}</style>`;
  const viewportTag = `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">`;

  let patched = html
    .replace(/<base[^>]*>/gi, "")
    .replace(/<meta[^>]*name=["']viewport["'][^>]*>/gi, "");

  patched = patched.replace(
    /<head([^>]*)>/i,
    `<head$1>${baseTag}${viewportTag}${styleTag}`
  );
  return patched;
}

async function fetchAndCachePage(
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
    await setStored(key, patchedHtml);
    return patchedHtml;
  } catch {
    return null;
  }
}

/**
 * Reads all critical pages from AsyncStorage immediately.
 * Simultaneously kicks off a background network refresh for each page.
 * Calls onUpdate(key, freshHtml) whenever a fresher version arrives.
 */
export async function initPageCache(
  onUpdate: (key: string, html: string) => void
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  await Promise.all(
    CRITICAL_PAGES.map(async ({ key, url }) => {
      const stored = await getStored(key);
      if (stored) result.set(key, stored);

      // always refresh in background
      fetchAndCachePage(key, url)
        .then((fresh) => {
          if (fresh) onUpdate(key, fresh);
        })
        .catch(() => {});
    })
  );

  return result;
}
