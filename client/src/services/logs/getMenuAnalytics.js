import { getCategories } from "../categories/getCategories";
import { getModels } from "../models/getModels";
import { getMenu } from "../menu/getMenu";

export async function getMenuAnalytics() {
  const [items, modelos, categories] = await Promise.all([getMenu(), getModels(), getCategories()]);

  const itemsWithImage = items.filter((i) => i.image && i.image.trim() !== "");
  const itemsWithoutImage = items.filter((i) => !i.image || i.image.trim() === "");

  const itemsWithModel = items.filter((i) => i.modelAR && i.modelAR.trim() !== "");
  const itemsWithoutModel = items.filter((i) => !i.modelAR || i.modelAR.trim() === "");

  const itemsByCategory = categories.map((cat) => ({
    ...cat,
    count: items.filter((i) => i.category === cat.id).length,
  }));
  const emptyCategories = itemsByCategory.filter((c) => c.count === 0);

  const usedModelIds = new Set(items.map((i) => i.modelAR).filter(Boolean));
  const modelosAssigned = modelos.filter((m) => usedModelIds.has(m.src));
  const modelosUnassigned = modelos.filter((m) => !usedModelIds.has(m.src));

  const prices = items
    .map((i) => parseFloat(String(i.price || "0").replace(/[^\d.]/g, "")))
    .filter((p) => !Number.isNaN(p) && p > 0);

  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

  const ingredientsCount = {};
  items.forEach((item) => {
    if (Array.isArray(item.ingredients)) {
      item.ingredients.forEach((ing) => {
        const key = String(ing).trim().toLowerCase();
        if (key) ingredientsCount[key] = (ingredientsCount[key] || 0) + 1;
      });
    }
  });
  const topIngredients = Object.entries(ingredientsCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  return {
    totalPlatos: items.length,
    itemsWithImage: itemsWithImage.length,
    itemsWithoutImage: itemsWithoutImage.length,
    itemsWithModel: itemsWithModel.length,
    itemsWithoutModel: itemsWithoutModel.length,
    categoriesTotal: categories.length,
    emptyCategories: emptyCategories.length,
    categorias: itemsByCategory,
    modelosTotal: modelos.length,
    modelosAssigned: modelosAssigned.length,
    modelosUnassigned: modelosUnassigned.length,
    priceMin: minPrice,
    priceMax: maxPrice,
    topIngredients,
  };
}
