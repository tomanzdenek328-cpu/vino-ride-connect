import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import carImg from "@/assets/car-3d-white.png";

const carIcon = L.divIcon({
  className: "",
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  html: `<img src="${carImg}" alt="vůz" style="width:44px;height:44px;object-fit:contain;
    filter:drop-shadow(0 2px 4px rgba(0,0,0,0.55))" />`,
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
function useSmoothPosition(target: { lat: number; lng: number } | null | undefined, durationMs = 1100) {
  const [pos, setPos] = useState<[number, number] | null>(target ? [target.lat, target.lng] : null);
  const currentRef = useRef<[number, number] | null>(pos);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!target) return;
    const to: [number, number] = [target.lat, target.lng];
    const from = currentRef.current;
    if (!from) {
      currentRef.current = to;
      setPos(to);
      return;
    }
    if (Math.abs(from[0] - to[0]) < 1e-7 && Math.abs(from[1] - to[1]) < 1e-7) return;

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // A linear segment keeps the car moving at a constant speed between GPS
      // samples. Ease-out visibly slows/stops the marker before every update.
      const eased = t;
      const next: [number, number] = [
        from[0] + (to[0] - from[0]) * eased,
        from[1] + (to[1] - from[1]) * eased,
      ];
      currentRef.current = next;
      setPos(next);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else currentRef.current = to;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
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
