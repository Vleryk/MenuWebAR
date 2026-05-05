import { useEffect, useState } from "react";
import { getMenu } from "../services/menu/getMenu";

export const useMenu = () => {
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMenu()
      .then((items) => setMenu(items))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return {
    menu,
    setMenu,
    loading,
    setLoading,
  };
};
