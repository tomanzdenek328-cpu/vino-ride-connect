import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { autocompleteAddress, resolvePlace, reverseGeocode } from "@/lib/places.functions";

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSelect?: (p: { address: string; lat?: number; lng?: number }) => void;
  required?: boolean;
  allowCurrentLocation?: boolean;
}

export function AddressAutocomplete({ label, value, onChange, onSelect, required, allowCurrentLocation }: Props) {
  const ac = useServerFn(autocompleteAddress);
  const resolve = useServerFn(resolvePlace);
  const reverse = useServerFn(reverseGeocode);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [suggestions, setSuggestions] = useState<{ placeId: string; text: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const sessionRef = useRef<string>(crypto.randomUUID());
  const skipNextRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (skipNextRef.current) { skipNextRef.current = false; return; }
    if (!value || value.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { suggestions } = await ac({ data: { input: value, sessionToken: sessionRef.current } });
        setSuggestions(suggestions);
        setOpen(suggestions.length > 0);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [value, ac]);

  const pick = async (s: { placeId: string; text: string }) => {
    skipNextRef.current = true;
    onChange(s.text);
    setOpen(false);
    setSuggestions([]);
    try {
      const p = await resolve({ data: { placeId: s.placeId, sessionToken: sessionRef.current } });
      sessionRef.current = crypto.randomUUID();
      skipNextRef.current = true;
      onChange(p.formattedAddress ?? s.text);
      onSelect?.({ address: p.formattedAddress ?? s.text, lat: p.lat, lng: p.lng });
    } catch (e) {
      console.error(e);
      onSelect?.({ address: s.text });
    }
  };


  return (
    <label className="block relative">
      <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        required={required}
        autoComplete="off"
        className="w-full bg-input border border-primary/40 px-2 py-1.5 text-primary text-sm focus:border-primary focus:outline-none"
      />
      {loading && <div className="absolute right-2 top-7 text-[10px] text-muted-foreground">...</div>}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-black border border-primary/60 max-h-60 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              className="w-full text-left px-2 py-1.5 text-xs text-primary hover:bg-primary/20 border-b border-primary/20 last:border-b-0"
            >
              ▸ {s.text}
            </button>
          ))}
        </div>
      )}
    </label>
  );
}
