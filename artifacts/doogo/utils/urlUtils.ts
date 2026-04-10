const TRUSTED_DOMAINS = ["doogo.shop", "www.doogo.shop"];

export function isTrustedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return TRUSTED_DOMAINS.some(
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

export function isExternalUrl(url: string): boolean {
  return !isTrustedUrl(url);
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.href;
  } catch {
    return url;
  }
}

const PRECACHE_PATHS = ["/", "/shop", "/wishlist", "/my-account"];

export function isPrecachePath(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!isTrustedUrl(url)) return false;
    const path = parsed.pathname;
    return PRECACHE_PATHS.some(
      (p) => path === p || path === p + "/"
    );
  } catch {
    return false;
  }
}
