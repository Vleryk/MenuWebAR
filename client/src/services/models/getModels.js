import { ENV } from "../../config/env";

export async function getModels() {
  const response = await fetch(`${ENV.API_URL}/modelos`, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Ha ocurrido un error al obtener los modelos");
  }

  const json = await response.json();

  return json;
}
