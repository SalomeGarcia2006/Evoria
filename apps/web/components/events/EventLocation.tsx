'use client';

import { useEffect, useState } from 'react';
import {
  getAddressFromCoordinates,
  parseCoordinates,
} from '../../services/locations.service';

export function EventLocation({ value }: { value: string | null }) {
  const [address, setAddress] = useState<string | null>(null);
  const hasCoordinates = parseCoordinates(value) !== null;

  useEffect(() => {
    const coordinates = parseCoordinates(value);
    if (!coordinates) return;

    let isMounted = true;
    void getAddressFromCoordinates(coordinates)
      .then((result) => {
        if (isMounted) setAddress(result);
      })
      .catch(() => {
        if (isMounted) setAddress('Ubicación seleccionada en el mapa');
      });

    return () => {
      isMounted = false;
    };
  }, [value]);

  if (!hasCoordinates) return value ?? 'Sin ubicación';
  return address ?? 'Buscando dirección…';
}
