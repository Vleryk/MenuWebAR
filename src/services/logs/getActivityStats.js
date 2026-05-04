import { ENV } from "../../config/env";

function getHeaders() {
  const token = localStorage.getItem("admin_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const DEFAULT_DAYS = 7;

export async function getActivityStats({ days = DEFAULT_DAYS, username } = {}) {
  const params = new URLSearchParams();

  if (days) {
    params.set("days", String(days));
  }

  if (username) {
    params.set("username", username);
  }

  const res = await fetch(`${ENV.API_URL}/admin/logs/stats?${params}`, { headers: getHeaders() });

  if (!res.ok) {
    throw new Error("Ha ocurrido un error al obtener las estadísticas de actividades");
  }

  const json = await res.json();

  return json;
}
