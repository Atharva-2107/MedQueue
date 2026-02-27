// src/hooks/useRealtime.js
// Subscribe to Supabase Postgres real-time changes with auto-cleanup.
// Usage:
//   useRealtime("bookings", { filter: "hospital_id=eq.abc" }, reload);
//   useRealtime("dispatches", { filter: "ambulance_id=is.null" }, reload);
import { useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";

let channelCounter = 0;

export function useRealtime(table, { filter, event = "*" } = {}, callback) {
    const cbRef = useRef(callback);
    cbRef.current = callback;

    useEffect(() => {
        if (!table) return;
        const name = `rt_${table}_${++channelCounter}`;
        const cfg = { event, schema: "public", table };
        if (filter) cfg.filter = filter;

        const channel = supabase
            .channel(name)
            .on("postgres_changes", cfg, (payload) => {
                cbRef.current?.(payload);
            })
            .subscribe((status) => {
                if (status === "CLOSED" || status === "CHANNEL_ERROR") {
                    console.warn(`[realtime] ${name} — ${status}`);
                }
            });

        return () => { supabase.removeChannel(channel); };
    }, [table, filter, event]);
}
