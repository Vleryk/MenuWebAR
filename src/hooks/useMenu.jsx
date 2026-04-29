import { useEffect, useState } from "react";
import { getMenu } from "../services/menu/getMenu";

export const useMenu = () => {
  const [menu, setMenu] = useState([]);

  useEffect(() => {
    getMenu()
      .then((items) => setMenu(items))
      .catch((err) => console.error(err));
  }, []);

  return {
    menu,
    setMenu,
  };
};
