// Supabase may return provider errors in either the URL query or fragment.
export function oauthErrorCode(href) {
  const url = new URL(href);
  return url.searchParams.get('error_code') || new URLSearchParams(url.hash.slice(1)).get('error_code') ||
    (url.searchParams.has('error') || new URLSearchParams(url.hash.slice(1)).has('error') ? 'oauth_cancelled' : null);
}
