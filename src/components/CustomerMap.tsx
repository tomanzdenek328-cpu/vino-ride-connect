import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";

const carIcon = L.divIcon({
  className: "",
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  html: `<div style="width:38px;height:38px;border-radius:50%;background:rgba(57,255,20,0.18);
    border:2px solid #39FF14;box-shadow:0 0 14px #39FF14;display:flex;align-items:center;
    justify-content:center;font-size:18px">🚕</div>`,
});

const pinIcon = L.divIcon({
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
    background:#000;border:2px solid #FFA500;box-shadow:0 0 10px #FFA500;display:flex;
    align-items:center;justify-content:center;">
    <span style="transform:rotate(45deg);font-size:13px">📍</span></div>`,
});

/** Fits the map once on first load (and when the pickup point appears), never fighting the user's zoom afterwards. */
function FitOnce({ points }: { points: [number, number][] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || points.length === 0) return;
    done.current = true;
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length]);
  return null;
}

/** Keeps the car in view without snapping: only recenters when it drifts off-screen. */
function FollowCar({ car }: { car: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!car) return;
    if (!map.getBounds().pad(-0.15).contains(L.latLng(car))) {
      map.panTo(car, { animate: true, duration: 1 });
    }
  }, [car, map]);
  return null;
}

/**
 * Smoothly interpolates between the last two known car positions so the marker
 * glides instead of jumping each time a new position arrives.
 */
function useSmoothPosition(target: { lat: number; lng: number } | null | undefined, durationMs = 1800) {
  const [pos, setPos] = useState<[number, number] | null>(target ? [target.lat, target.lng] : null);
  const fromRef = useRef<[number, number] | null>(pos);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!target) return;
    const to: [number, number] = [target.lat, target.lng];
    const from = fromRef.current;
    if (!from) {
      fromRef.current = to;
      setPos(to);
      return;
    }
    if (Math.abs(from[0] - to[0]) < 1e-7 && Math.abs(from[1] - to[1]) < 1e-7) return;

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = t * (2 - t); // ease-out
      const next: [number, number] = [
        from[0] + (to[0] - from[0]) * eased,
        from[1] + (to[1] - from[1]) * eased,
      ];
      setPos(next);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = pos ?? from;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.lat, target?.lng, durationMs]);

  return pos;
}

interface Props {
  pickup?: { lat: number; lng: number } | null;
  car?: { lat: number; lng: number } | null;
}

export default function CustomerMap({ pickup, car }: Props) {
  const smoothCar = useSmoothPosition(car);
  const points: [number, number][] = [];
  if (pickup) points.push([pickup.lat, pickup.lng]);
  if (smoothCar) points.push(smoothCar);
  const center: [number, number] = points[0] ?? [48.85, 16.8];

  return (
    <MapContainer center={center} zoom={14} className="w-full h-full" style={{ minHeight: 260 }}>
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitOnce points={points} />
      <FollowCar car={smoothCar} />
      {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={pinIcon} />}
      {smoothCar && <Marker position={smoothCar} icon={carIcon} />}
    </MapContainer>
  );
}
