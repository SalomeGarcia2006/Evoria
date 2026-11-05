'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getCoordinatesFromAddress,
  parseCoordinates,
  type Coordinates,
} from '../../services/locations.service';

export function EventLocationMap({ value }: { value: string | null }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [addressCoordinates, setAddressCoordinates] =
    useState<Coordinates | null>(null);
  const [error, setError] = useState('');
  const directCoordinates = parseCoordinates(value);
  const coordinates = directCoordinates ?? addressCoordinates;

  useEffect(() => {
    if (directCoordinates || !value) return;

    let isMounted = true;
    void getCoordinatesFromAddress(value)
      .then((result) => {
        if (isMounted) setAddressCoordinates(result);
      })
      .catch(() => {
        if (isMounted)
          setError('No fue posible ubicar esta dirección en el mapa.');
      });

    return () => {
      isMounted = false;
    };
  }, [directCoordinates, value]);

  useEffect(() => {
    if (!coordinates || !mapContainer.current) return;

    let isMounted = true;
    let removeMap: (() => void) | undefined;
    void import('leaflet').then((leaflet) => {
      if (!isMounted || !mapContainer.current) return;

      const point = leaflet.latLng(coordinates.latitude, coordinates.longitude);
      const map = leaflet.map(mapContainer.current).setView(point, 16);
      leaflet
        .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        })
        .addTo(map);
      leaflet
        .circleMarker(point, {
          color: '#14213D',
          fillColor: '#6A4CFF',
          fillOpacity: 1,
          radius: 9,
          weight: 3,
        })
        .addTo(map);
      window.setTimeout(() => map.invalidateSize(), 0);
      removeMap = () => map.remove();
    });

    return () => {
      isMounted = false;
      removeMap?.();
    };
  }, [coordinates]);

  if (!value) {
    return (
      <div className="grid h-64 place-items-center rounded-[1.125rem] border border-dashed border-sky-blue bg-beige px-4 text-center text-sm text-muted">
        Este evento no tiene una ubicación registrada.
      </div>
    );
  }

  if (!coordinates && error) {
    return (
      <div className="grid h-64 place-items-center rounded-[1.125rem] border border-dashed border-sky-blue bg-beige px-4 text-center text-sm text-muted">
        {error}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[1.125rem] border border-sky-blue bg-beige">
      <div
        aria-label="Mapa de la ubicación del evento"
        className="h-64 w-full"
        ref={mapContainer}
      />
      {!coordinates ? (
        <div className="absolute inset-0 grid place-items-center bg-beige/85 text-sm font-medium text-muted">
          Ubicando el evento en el mapa…
        </div>
      ) : null}
    </div>
  );
}
