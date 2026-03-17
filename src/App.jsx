import { useMemo, useState } from "react";
import Header from "./components/Header";
import CategoryTabs from "./components/CategoryTabs";
import MenuSection from "./components/MenuSection";
import ReservationSection from "./components/ReservationSection";
import Footer from "./components/Footer";
import { categories, menuItems } from "./data/menuData";

function App() {
  const [activeCategory, setActiveCategory] = useState(categories[0].id);

  const filteredItems = useMemo(
    () => menuItems.filter((item) => item.category === activeCategory),
    [activeCategory]
  );

  const activeLabel =
    categories.find((category) => category.id === activeCategory)?.label ||
    "Menu";

  return (
    <div className="app-shell">
      <Header />

      <main className="app-main">
        <CategoryTabs
          categories={categories}
          activeCategory={activeCategory}
          onChange={setActiveCategory}
        />

        <MenuSection title={activeLabel} items={filteredItems} />

        <ReservationSection />
      </main>

      <Footer />
    </div>
  );
}

export default App;