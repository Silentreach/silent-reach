"use client";

import { useEffect } from "react";
import { migrateLocalStorageIfNeeded } from "@/lib/db/migrateLocalStorage";

// Renders nothing. Mounts inside the global layout so every signed-in
// pageview gets a chance to run the localStorage→DB migration. The function
// is idempotent and bails immediately if already migrated.
export default function MigrationGate() {
  useEffect(() => {
    migrateLocalStorageIfNeeded().catch((err) => {
      console.warn("[MigrationGate] migration failed:", err);
    });
  }, []);
  return null;
}
