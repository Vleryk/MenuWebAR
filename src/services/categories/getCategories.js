import { ENV } from "../../config/env";

export const getCategories = async () => {
  const response = await fetch(`${ENV.API_URL}/categories`);

  if (!response.ok) {
    throw new Error("Ha ocurrido un error al cargar las categorías");
  }

  const json = await response.json();

  return json;
};
