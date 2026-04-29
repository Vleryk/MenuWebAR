import { useEffect, useState } from "react";
import { getCategories } from "../services/categories/getCategories";

export const useCategories = () => {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    getCategories()
      .then((categories) => setCategories(categories))
      .catch((err) => console.error(err));
  }, []);

  return {
    categories,
    setCategories,
  };
};
