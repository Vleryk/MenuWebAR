import { useState, useCallback } from "react";
import { getActivityStats } from "../services/logs/getActivityStats";

export function useActivityStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadStats = useCallback(async (days = 7) => {
    setLoading(true);
    setError("");
    try {
      const data = await getActivityStats({ days });
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearStats = useCallback(() => {
    setStats(null);
    setError("");
  }, []);

  return { stats, loading, error, loadStats, clearStats };
}
