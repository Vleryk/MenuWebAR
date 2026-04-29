export const getMenu = async () => {
  const response = await fetch(`${import.meta.env.API_URL || "/api"}/menu-items`);

  if (!response.ok) {
    throw new Error("Ha ocurrido un error al cargar el menú");
  }

  const json = await response.json();

  return json;
};
