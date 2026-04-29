export const getCategories = async () => {
  const response = await fetch(`${import.meta.env.VITE_API_URL || "/api"}/categories`);

  if (!response.ok) {
    throw new Error("Ha ocurrido un error al cargar las categorías");
  }

  const json = await response.json();

  return json;
};
