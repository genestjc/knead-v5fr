export interface SignedRequestContext {
  method: string;
  path: string;
  bodyHash: string;
}

export function canonicalRequestPath(url: string | URL): string {
  const parsed = new URL(String(url), 'http://localhost');
  return `${parsed.pathname}${parsed.search}`;
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const bytes =
    typeof data === 'string'
      ? new TextEncoder().encode(data)
      : data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : data;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function requestBodyHash(request: Request): Promise<string> {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return sha256Hex('');
  }
  return sha256Hex(await request.clone().arrayBuffer());
}

