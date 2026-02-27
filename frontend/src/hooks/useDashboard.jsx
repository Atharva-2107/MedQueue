// src/hooks/useDashboard.js
import { useState, useEffect } from "react";
import api from "../lib/api";

export const useDashboard = (role) => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const roleMap = {
    patient:        "patient",
    admin:          "admin",
    hospital_staff: "staff",
    driver:         "driver",
  };

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const endpoint = roleMap[role];
      if (!endpoint) throw new Error("Unknown role");
      const res = await api.get(`/dashboard/${endpoint}`);
      setData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role) fetchDashboard();
  }, [role]);

  return { data, loading, error, refetch: fetchDashboard };
};