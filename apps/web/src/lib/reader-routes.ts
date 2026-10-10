/** A shared static shell reads any downloaded law/article from IndexedDB. */
export function articleHref(id: string): string {
  return `/read/?article=${encodeURIComponent(id)}`;
}

export function lawHref(id: string): string {
  return `/read/?law=${encodeURIComponent(id)}`;
}
