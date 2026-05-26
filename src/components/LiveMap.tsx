import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { supabase } from "@/integrations/supabase/client";

// Phosphor SVG marker
const driverIcon = (online: boolean, label: string) =>
  L.divIcon({
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `
      <div style="
        width:40px;height:40px;border-radius:50%;
        background:${online ? "rgba(57,255,20,0.18)" : "rgba(180,180,180,0.1)"};
        border:2px solid ${online ? "#39FF14" : "#666"};
        box-shadow:0 0 ${online ? "14px" : "0"} #39FF14;
        display:flex;align-items:center;justify-content:center;
        font-family:JetBrains Mono,monospace;font-size:10px;font-weight:800;
        color:${online ? "#39FF14" : "#888"};
        ${online ? "animation:blink 1.4s steps(1) infinite;" : ""}
      ">${label.slice(0, 4).toUpperCase()}</div>`,
  });

const orderIcon = L.divIcon({
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  html: `<div style="
    width:28px;height:28px;border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);background:#000;border:2px solid #FFA500;
    box-shadow:0 0 10px #FFA500;
    display:flex;align-items:center;justify-content:center;color:#FFA500;
    font-weight:800;font-family:JetBrains Mono,monospace;
  "><span style='transform:rotate(45deg);font-size:13px'>?</span></div>`,
});

interface DriverLoc {
  driver_id: string;
  lat: number | null;
  lng: number | null;
  online: boolean;
  call_sign: string;
  full_name: string;
}

interface OrderMarker {
  id: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
}

interface Props {
  center?: [number, number];
  showOrders?: boolean;
  onOrderClick?: (id: string) => void;
  followDriverId?: string;
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, map.getZoom()); }, [center[0], center[1]]); // eslint-disable-line
  return null;
}

export function LiveMap({ center = [50.0755, 14.4378], showOrders = false, onOrderClick, followDriverId }: Props) {
  const [drivers, setDrivers] = useState<DriverLoc[]>([]);
  const [orders, setOrders] = useState<OrderMarker[]>([]);
  const profilesRef = useRef<Record<string, { call_sign: string; full_name: string }>>({});

  useEffect(() => {
    const load = async () => {
      const [{ data: locs }, { data: profs }] = await Promise.all([
        supabase.from("driver_locations").select("*"),
        supabase.from("profiles").select("id,call_sign,full_name"),
      ]);
      const pmap: Record<string, { call_sign: string; full_name: string }> = {};
      (profs ?? []).forEach((p: any) => { pmap[p.id] = { call_sign: p.call_sign, full_name: p.full_name }; });
      profilesRef.current = pmap;
      const list: DriverLoc[] = (locs ?? []).map((l: any) => ({
        driver_id: l.driver_id,
        lat: l.lat, lng: l.lng, online: l.online,
        call_sign: pmap[l.driver_id]?.call_sign ?? "—",
        full_name: pmap[l.driver_id]?.full_name ?? "",
      }));
      setDrivers(list);
    };
    load();

    const ch = supabase
      .channel("driver_locations_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations" }, (payload) => {
        setDrivers((prev) => {
          const next = [...prev];
          const row: any = payload.new ?? payload.old;
          const idx = next.findIndex((d) => d.driver_id === row.driver_id);
          if (payload.eventType === "DELETE") {
            return next.filter((d) => d.driver_id !== row.driver_id);
          }
          const merged: DriverLoc = {
            driver_id: row.driver_id,
            lat: row.lat, lng: row.lng, online: row.online,
            call_sign: profilesRef.current[row.driver_id]?.call_sign ?? "—",
            full_name: profilesRef.current[row.driver_id]?.full_name ?? "",
          };
          if (idx >= 0) next[idx] = merged; else next.push(merged);
          return next;
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (!showOrders) return;
    const load = async () => {
      const { data } = await supabase
        .from("orders")
        .select("id,pickup_lat,pickup_lng,pickup_address,status")
        .in("status", ["pending", "assigned", "accepted", "in_progress"]);
      setOrders((data ?? []).filter((o: any) => o.pickup_lat && o.pickup_lng) as OrderMarker[]);
    };
    load();
    const ch = supabase
      .channel("orders_rt_map")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [showOrders]);

  const focusDriver = followDriverId
    ? drivers.find((d) => d.driver_id === followDriverId)
    : null;
  const mapCenter: [number, number] = focusDriver?.lat && focusDriver?.lng
    ? [focusDriver.lat, focusDriver.lng]
    : center;

  return (
    <MapContainer center={mapCenter} zoom={13} className="w-full h-full" style={{ minHeight: 300 }}>
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter center={mapCenter} />
      {drivers.filter((d) => d.lat && d.lng).map((d) => (
        <Marker key={d.driver_id} position={[d.lat!, d.lng!]} icon={driverIcon(d.online, d.call_sign)}>
          <Popup>
            <div className="font-mono text-xs">
              <div className="font-bold text-base">▸ {d.call_sign}</div>
              <div>{d.full_name}</div>
              <div className={d.online ? "text-primary" : "text-muted-foreground"}>
                {d.online ? "● ONLINE" : "○ OFFLINE"}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
      {showOrders && orders.map((o) => (
        <Marker key={o.id} position={[o.pickup_lat, o.pickup_lng]} icon={orderIcon}
          eventHandlers={onOrderClick ? { click: () => onOrderClick(o.id) } : undefined}>
          <Popup>
            <div className="font-mono text-xs">
              <div className="font-bold">▸ ZAKÁZKA</div>
              <div>{o.pickup_address}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
