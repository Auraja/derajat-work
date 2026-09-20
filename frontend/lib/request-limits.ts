export const MAX_REQUEST_BODY_BYTES = 1024 * 1024;

export function requestBodyTooLarge(contentLength: string | null, bufferedBytes = 0): boolean {
  const declaredBytes = contentLength === null ? 0 : Number(contentLength);
  return (
    (Number.isFinite(declaredBytes) && declaredBytes > MAX_REQUEST_BODY_BYTES) ||
    bufferedBytes > MAX_REQUEST_BODY_BYTES
  );
}

export async function readLimitedBody(request: Request): Promise<Uint8Array> {
  if (requestBodyTooLarge(request.headers.get("content-length"))) {
    throw new RangeError("Request body too large");
  }
  if (request.body === null) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (requestBodyTooLarge(null, total)) {
      await reader.cancel();
      throw new RangeError("Request body too large");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
