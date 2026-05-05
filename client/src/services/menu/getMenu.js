import { ENV } from "../../config/env";

export const getMenu = async () => {
  const response = await fetch(`${ENV.API_URL}/menu-items`);

  if (!response.ok) {
    throw new Error("Ha ocurrido un error al cargar el menú");
  }

  const json = await response.json();
  return json;
};
