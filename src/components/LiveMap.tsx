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
  busy: boolean;
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
  showDriverList?: boolean;
}

/** Přesune mapu pouze když se změní klíč (výběr řidiče), ne při každé aktualizaci polohy. */
function FlyTo({ center, trigger }: { center: [number, number] | null; trigger: string }) {
  const map = useMap();
  const last = useRef<string>("");
  useEffect(() => {
    if (!center) return;
    if (last.current === trigger) return;
    last.current = trigger;
    map.setView(center, map.getZoom());
  }, [trigger, center?.[0], center?.[1]]); // eslint-disable-line
  return null;
}

export function LiveMap({ center, showOrders = false, onOrderClick, followDriverId, showDriverList = true }: Props) {
  const [drivers, setDrivers] = useState<DriverLoc[]>([]);
  const [orders, setOrders] = useState<OrderMarker[]>([]);
  const [geoCenter, setGeoCenter] = useState<[number, number] | null>(null);
  const [selected, setSelected] = useState<string>("all");
  const profilesRef = useRef<Record<string, { call_sign: string; full_name: string }>>({});

  // Try to center on the viewer's current position once at mount
  useEffect(() => {
    if (center || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeoCenter([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }, [center]);


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
        lat: l.lat, lng: l.lng, online: l.online, busy: !!l.busy,
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
            lat: row.lat, lng: row.lng, online: row.online, busy: !!row.busy,
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

  // Výchozí střed mapy (nastaví se jen jednou při mountu MapContaineru)
  const initialCenter: [number, number] = center ?? geoCenter ?? [50.0755, 14.4378];

  const activeFollowId = selected !== "all" ? selected : followDriverId;
  const focusDriver = activeFollowId
    ? drivers.find((d) => d.driver_id === activeFollowId)
    : null;
  const flyCenter: [number, number] | null =
    focusDriver?.lat != null && focusDriver?.lng != null
      ? [focusDriver.lat, focusDriver.lng]
      : center ?? null;

  // Zobrazujeme jen online řidiče (i obsazené), offline se nezobrazují
  const onlineDrivers = drivers.filter((d) => d.online);
  const sortedDrivers = [...onlineDrivers].sort((a, b) =>
    a.call_sign.localeCompare(b.call_sign),
  );

  const visibleDrivers = sortedDrivers.filter(
    (d) => d.lat != null && d.lng != null && (selected === "all" || d.driver_id === selected),
  );

  const selectedDriver = selected !== "all" ? drivers.find((d) => d.driver_id === selected) : null;
  const noPosition = !!selectedDriver && (selectedDriver.lat == null || selectedDriver.lng == null);

  return (
    <div className="w-full h-full flex flex-col">
      {showDriverList && (
        <div className="flex gap-1 overflow-x-auto pb-1 shrink-0">
          <button
            type="button"
            onClick={() => setSelected("all")}
            className={`px-2 py-1 rounded border font-mono text-[10px] font-bold whitespace-nowrap ${
              selected === "all"
                ? "border-primary text-primary bg-primary/10"
                : "border-border text-muted-foreground"
            }`}
          >
            VŠICHNI ({onlineDrivers.length})
          </button>
          {sortedDrivers.map((d) => (
            <button
              key={d.driver_id}
              type="button"
              onClick={() => setSelected(d.driver_id)}
              className={`px-2 py-1 rounded border font-mono text-[10px] font-bold whitespace-nowrap ${
                selected === d.driver_id
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground"
              }`}
              title={d.full_name}
            >
              {d.busy ? "◆" : "●"} {d.call_sign}
            </button>
          ))}
        </div>
      )}
      {noPosition && (
        <div className="shrink-0 px-2 py-1 font-mono text-[10px] font-bold text-orange-400">
          ⚠ {selectedDriver?.call_sign} zatím neodeslal polohu
        </div>
      )}
      <div className="flex-1 min-h-0">
        <MapContainer center={initialCenter} zoom={13} className="w-full h-full" style={{ minHeight: 300 }}>
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FlyTo center={flyCenter} trigger={activeFollowId ?? "none"} />
          {visibleDrivers.map((d) => (
            <Marker key={d.driver_id} position={[d.lat!, d.lng!]} icon={driverIcon(d.online, d.call_sign)}>
              <Popup>
                <div className="font-mono text-xs">
                  <div className="font-bold text-base">▸ {d.call_sign}</div>
                  <div>{d.full_name}</div>
                  <div className={d.busy ? "text-orange-400" : "text-primary"}>
                    {d.busy ? "◆ OBSAZENO" : "● VOLNÝ"}
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
      </div>
    </div>
  );
}

