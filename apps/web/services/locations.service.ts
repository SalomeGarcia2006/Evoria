export type Coordinates = { latitude: number; longitude: number };

const coordinatesPattern = /^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/;
const addressCache = new Map<string, string>();
const coordinatesCache = new Map<string, Coordinates>();

export function parseCoordinates(value: string | null): Coordinates | null {
  if (!value) return null;
  const match = value.match(coordinatesPattern);
  if (!match) return null;

  return { latitude: Number(match[1]), longitude: Number(match[2]) };
}

export async function getAddressFromCoordinates(
  coordinates: Coordinates,
): Promise<string> {
  const key = `${coordinates.latitude.toFixed(6)},${coordinates.longitude.toFixed(6)}`;
  const cachedAddress = addressCache.get(key);
  if (cachedAddress) return cachedAddress;

  const parameters = new URLSearchParams({
    format: 'jsonv2',
    lat: String(coordinates.latitude),
    lon: String(coordinates.longitude),
  });
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${parameters}`,
  );
  if (!response.ok) throw new Error('No fue posible identificar la ubicación.');

  const result = (await response.json()) as { display_name?: string };
  if (!result.display_name)
    throw new Error('No fue posible identificar la ubicación.');

  addressCache.set(key, result.display_name);
  return result.display_name;
}

export async function getCoordinatesFromAddress(
  address: string,
): Promise<Coordinates> {
  const key = address.trim().toLowerCase();
  const cachedCoordinates = coordinatesCache.get(key);
  if (cachedCoordinates) return cachedCoordinates;

  const parameters = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    q: address,
  });
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${parameters}`,
  );
  if (!response.ok) throw new Error('No fue posible ubicar la dirección.');

  const [result] = (await response.json()) as Array<{
    lat?: string;
    lon?: string;
  }>;
  if (!result?.lat || !result.lon)
    throw new Error('No fue posible ubicar la dirección.');

  const coordinates = {
    latitude: Number(result.lat),
    longitude: Number(result.lon),
  };
  coordinatesCache.set(key, coordinates);
  return coordinates;
}
