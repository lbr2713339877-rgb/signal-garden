/** True when the request is the public IndexNow key file. Safe for middleware. */
export function isIndexNowKeyPath(pathname: string, key: string | undefined): boolean {
  const trimmed = key?.trim();
  return Boolean(trimmed && pathname === `/${trimmed}.txt`);
}
