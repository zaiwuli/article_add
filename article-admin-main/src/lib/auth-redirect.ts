const DEFAULT_AUTH_REDIRECT = '/'

export function buildRedirectTarget(
  pathname: string,
  searchStr?: string,
  hash?: string
) {
  return `${pathname}${searchStr || ''}${hash || ''}` || DEFAULT_AUTH_REDIRECT
}

export function normalizeRedirectTarget(redirectTo?: string) {
  if (!redirectTo) {
    return DEFAULT_AUTH_REDIRECT
  }

  try {
    if (redirectTo.startsWith('/')) {
      return redirectTo
    }

    const base =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost'
    const url = new URL(redirectTo, base)
    return buildRedirectTarget(url.pathname, url.search, url.hash)
  } catch {
    return DEFAULT_AUTH_REDIRECT
  }
}
