import { useEffect, useState } from "react";
import { getCategories } from "../services/categories/getCategories";

export const useCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("");

  useEffect(() => {
    getCategories()
      .then((categories) => {
        setCategories(categories);
        setActiveCategory(categories[0]?.id ?? "");
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return {
    categories,
    setCategories,
    loading,
    setLoading,
    activeCategory,
    setActiveCategory,
  };
};
