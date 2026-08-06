import { useEffect } from "react";
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

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)]);
  return null;
}

interface Props {
  pickup?: { lat: number; lng: number } | null;
  car?: { lat: number; lng: number } | null;
}

export default function CustomerMap({ pickup, car }: Props) {
  const points: [number, number][] = [];
  if (pickup) points.push([pickup.lat, pickup.lng]);
  if (car) points.push([car.lat, car.lng]);
  const center: [number, number] = points[0] ?? [48.85, 16.8];

  return (
    <MapContainer center={center} zoom={13} className="w-full h-full" style={{ minHeight: 260 }}>
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Fit points={points} />
      {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={pinIcon} />}
      {car && <Marker position={[car.lat, car.lng]} icon={carIcon} />}
    </MapContainer>
  );
}
