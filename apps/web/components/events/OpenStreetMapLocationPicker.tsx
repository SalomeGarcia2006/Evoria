'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getAddressFromCoordinates,
  getCoordinatesFromAddress,
  parseCoordinates,
} from '../../services/locations.service';

const bogota: [number, number] = [4.711, -74.0721];

type SearchResult = {
  display_name: string;
  lat: string;
  lon: string;
};

export function OpenStreetMapLocationPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  // shortcut: el formulario se vuelve a montar al editar otro evento; basta con ubicar el valor inicial una vez.
  const [initialValue] = useState(value);
  const selectLocation = useRef<
    (latitude: number, longitude: number, address?: string) => void
  >(() => undefined);
  const searchCache = useRef(new Map<string, SearchResult[]>());
  const lastSearchAt = useRef(0);
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isActive = true;
    let removeMap: (() => void) | undefined;

    void import('leaflet')
      .then((leaflet) => {
        if (!isActive || !mapContainer.current) return;

        const map = leaflet.map(mapContainer.current).setView(bogota, 12);
        let selectedMarker: ReturnType<typeof leaflet.circleMarker> | null =
          null;

        const setSelectedLocation = (
          latitude: number,
          longitude: number,
          address?: string,
        ) => {
          const point = leaflet.latLng(latitude, longitude);
          map.setView(point, 16);

          if (selectedMarker) {
            selectedMarker.setLatLng(point);
          } else {
            selectedMarker = leaflet
              .circleMarker(point, {
                color: '#14213D',
                fillColor: '#6A4CFF',
                fillOpacity: 1,
                radius: 9,
                weight: 3,
              })
              .addTo(map);
          }

          if (address) {
            onChange(address);
            return;
          }

          onChange('');
          setIsResolvingLocation(true);
          setLocationError('');
          void getAddressFromCoordinates({ latitude, longitude })
            .then(onChange)
            .catch(() =>
              setLocationError(
                'No fue posible obtener la dirección del punto.',
              ),
            )
            .finally(() => setIsResolvingLocation(false));
        };
        selectLocation.current = setSelectedLocation;

        leaflet
          .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19,
          })
          .addTo(map);

        const savedCoordinates = parseCoordinates(initialValue);
        if (savedCoordinates) {
          setSelectedLocation(
            savedCoordinates.latitude,
            savedCoordinates.longitude,
            initialValue,
          );
        } else if (initialValue) {
          void getCoordinatesFromAddress(initialValue)
            .then(({ latitude, longitude }) => {
              setSelectedLocation(latitude, longitude, initialValue);
            })
            .catch(() => {
              if (isActive)
                setLocationError(
                  'No fue posible ubicar la dirección guardada en el mapa.',
                );
            });
        }

        map.on('click', (event) => {
          setSelectedLocation(event.latlng.lat, event.latlng.lng);
        });

        removeMap = () => map.remove();
      })
      .catch(() => {
        if (isActive) setLoadError('No fue posible cargar el mapa.');
      });

    return () => {
      isActive = false;
      removeMap?.();
    };
  }, [initialValue, onChange]);

  async function searchPlaces() {
    const search = query.trim();
    if (!search) return;

    const cachedResults = searchCache.current.get(search.toLowerCase());
    if (cachedResults) {
      setResults(cachedResults);
      return;
    }

    if (Date.now() - lastSearchAt.current < 1000) {
      setSearchError('Espera un momento antes de hacer otra búsqueda.');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    lastSearchAt.current = Date.now();
    try {
      const parameters = new URLSearchParams({
        format: 'jsonv2',
        limit: '5',
        q: search,
      });
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${parameters}`,
      );
      if (!response.ok) throw new Error('No fue posible buscar lugares.');

      const places = (await response.json()) as SearchResult[];
      searchCache.current.set(search.toLowerCase(), places);
      setResults(places);
      if (places.length === 0)
        setSearchError('No encontramos lugares para esa búsqueda.');
    } catch {
      setSearchError('No fue posible buscar lugares. Inténtalo nuevamente.');
    } finally {
      setIsSearching(false);
    }
  }

  function chooseResult(result: SearchResult) {
    selectLocation.current(
      Number(result.lat),
      Number(result.lon),
      result.display_name,
    );
    setQuery(result.display_name);
    setResults([]);
    setSearchError('');
  }

  return (
    <div className="grid gap-2 md:col-span-2">
      <span className="text-sm font-semibold">Ubicación exacta</span>
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-lg border border-sky-blue px-3 py-2 outline-none focus:border-teal focus:ring-2 focus:ring-sky-blue"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            void searchPlaces();
          }}
          placeholder="Ej. Teatro Pablo Tobón, Medellín"
          type="search"
          value={query}
        />
        <button
          className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSearching}
          onClick={() => void searchPlaces()}
          type="button"
        >
          {isSearching ? 'Buscando…' : 'Buscar'}
        </button>
      </div>
      {searchError ? (
        <p className="text-sm text-red-700">{searchError}</p>
      ) : null}
      {locationError ? (
        <p className="text-sm text-red-700">{locationError}</p>
      ) : null}
      <p className="text-sm text-muted">
        Navega por el mapa y haz clic en el punto donde se realizará el evento.
      </p>
      <div className="relative h-72 overflow-hidden rounded-lg border border-sky-blue">
        <div
          aria-label="Mapa para seleccionar la ubicación exacta del evento"
          className="h-full"
          ref={mapContainer}
        />
        {results.length > 0 ? (
          <ul className="absolute inset-x-3 top-3 z-[1100] max-h-52 overflow-y-auto rounded-lg border border-sky-blue bg-white/95 shadow-lg backdrop-blur-sm">
            {results.map((result) => (
              <li
                className="border-b border-sky-blue last:border-b-0"
                key={`${result.lat}-${result.lon}`}
              >
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-beige focus:bg-beige focus:outline-none"
                  onClick={() => chooseResult(result)}
                  type="button"
                >
                  {result.display_name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {loadError ? <p className="text-sm text-red-700">{loadError}</p> : null}
      <p className="text-sm text-muted">
        {isResolvingLocation
          ? 'Identificando la dirección del punto…'
          : value
            ? `Punto seleccionado: ${value}`
            : 'Aún no has seleccionado un punto.'}
      </p>
    </div>
  );
}
