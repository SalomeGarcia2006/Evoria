import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export function deriveProviderConfirmationToken(
  secret: string,
  serviceId: string,
  version: number,
): string {
  return createHmac('sha256', secret)
    .update(`evoria:provider-service:${serviceId}:${version}`)
    .digest('hex');
}

/** Only the digest is stored with the request; the raw token goes to the recipient. */
export function createProviderConfirmationToken(): {
  token: string;
  digest: string;
} {
  const token = randomBytes(32).toString('hex');
  return { token, digest: digestProviderConfirmationToken(token) };
}

export function digestProviderConfirmationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function matchesProviderConfirmationToken(
  token: string,
  digest: string,
): boolean {
  if (!/^[0-9a-f]{64}$/.test(token) || !/^[0-9a-f]{64}$/.test(digest))
    return false;
  const candidate = Buffer.from(digestProviderConfirmationToken(token), 'hex');
  return timingSafeEqual(candidate, Buffer.from(digest, 'hex'));
}
