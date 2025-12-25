function base64UrlToBase64(input: string): string {
  const pad = '='.repeat((4 - (input.length % 4)) % 4);
  return (input + pad).replace(/-/g, '+').replace(/_/g, '/');
}

export function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const b64 = base64UrlToBase64(parts[1]);

    // SSR (Node) ima Buffer, browser ima atob
    const json =
      typeof Buffer !== 'undefined'
        ? Buffer.from(b64, 'base64').toString('utf-8')
        : decodeURIComponent(
          Array.prototype.map
            .call(atob(b64), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );

    return JSON.parse(json);
  } catch {
    return null;
  }
}
