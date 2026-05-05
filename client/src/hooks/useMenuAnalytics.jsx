import { useState, useCallback } from "react";
import { getMenuAnalytics } from "../services/logs/getMenuAnalytics";

export function useMenuAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getMenuAnalytics();
      setAnalytics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { analytics, loading, error, loadAnalytics };
}
