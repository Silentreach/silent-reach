"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Check } from "lucide-react";
import { TextInput } from "./FormPrimitives";

interface GeocodeResult {
  formattedAddress: string;
  lat: number;
  lng: number;
  neighborhood?: string;
  postalCode?: string;
}

interface AddressInputProps {
  value: string;
  onChange: (raw: string) => void;
  onResolved: (result: GeocodeResult | null) => void;
  placeholder?: string;
}

export default function AddressInput({ value, onChange, onResolved, placeholder }: AddressInputProps) {
  const [state, setState] = useState<"idle" | "looking" | "found" | "missing">("idle");
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef<string>("");

  useEffect(() => {
    // Reset on empty
    const trimmed = value.trim();
    if (trimmed.length < 8) {
      setState("idle");
      setResolvedAddress(null);
      onResolved(null);
      return;
    }

    // Skip if same query already resolved
    if (trimmed === lastQueryRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      lastQueryRef.current = trimmed;
      setState("looking");
      try {
        const res = await fetch("/api/enrichment/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: trimmed }),
          signal: AbortSignal.timeout(12_000),
        });
        if (!res.ok) {
          setState("missing");
          setResolvedAddress(null);
          onResolved(null);
          return;
        }
        const data = (await res.json()) as { result: GeocodeResult };
        setResolvedAddress(data.result.formattedAddress);
        onResolved(data.result);
        setState("found");
      } catch {
        setState("missing");
        setResolvedAddress(null);
        onResolved(null);
      }
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // We deliberately don't list onResolved as a dep — it'd re-trigger every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative">
      <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60" />
      <TextInput
        type="text"
        placeholder={placeholder ?? "868 Orono Ave, Saanich BC"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        className="pl-9 pr-9"
      />
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
        {state === "looking" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
        {state === "found" && <Check className="h-3.5 w-3.5 text-gold" />}
      </div>

      {state === "found" && resolvedAddress && resolvedAddress.toLowerCase() !== value.trim().toLowerCase() && (
        <div className="mt-1.5 text-[11px] text-gold/85">
          Resolved: {resolvedAddress}
        </div>
      )}
      {state === "missing" && (
        <div className="mt-1.5 text-[11px] text-muted/80">
          Couldn&rsquo;t resolve that address. Generation still works — Mintflow uses the raw
          string as location context.
        </div>
      )}
    </div>
  );
}
