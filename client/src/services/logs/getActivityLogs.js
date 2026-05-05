import { ENV } from "../../config/env";

function getHeaders() {
  const token = localStorage.getItem("admin_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function getActivityLogs({
  limit = 50,
  offset = 0,
  action,
  entityType,
  username,
} = {}) {
  const params = new URLSearchParams();

  params.set("limit", String(limit));
  params.set("offset", String(offset));

  if (action) params.set("action", action);

  if (entityType) params.set("entityType", entityType);

  if (username) params.set("username", username);

  const res = await fetch(`${ENV.API_URL}/admin/logs?${params}`, { headers: getHeaders() });

  if (!res.ok) {
    throw new Error("Ha ocurrido un error al obtener los logs de las actividades");
  }

  const json = await res.json();

  return json;
}
