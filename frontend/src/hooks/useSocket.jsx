// src/hooks/useSocket.jsx
// Socket.IO context — provides a shared socket connection with Supabase JWT auth
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { supabase } from "../supabaseClient";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
    const socketRef = useRef(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        let mounted = true;

        const connect = async () => {
            // Get Supabase JWT token for socket auth
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token || !mounted) return;

            const socket = io(
                import.meta.env.VITE_SOCKET_URL || "http://localhost:5000",
                {
                    auth: { token: session.access_token },
                    reconnection: true,
                    reconnectionDelay: 2000,
                    transports: ["websocket", "polling"],
                }
            );

            socket.on("connect", () => { if (mounted) setConnected(true); });
            socket.on("disconnect", () => { if (mounted) setConnected(false); });
            socketRef.current = socket;
        };

        connect();
        return () => {
            mounted = false;
            socketRef.current?.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
