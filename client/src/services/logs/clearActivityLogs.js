import { ENV } from "../../config/env";

function getHeaders() {
  const token = localStorage.getItem("admin_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function clearActivityLogs() {
  const res = await fetch(`${ENV.API_URL}/admin/logs/clear`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  if (!res.ok) {
    throw new Error("Ha ocurrido un error al eliminar los logs");
  }

  const json = res.json();

  return json;
}
