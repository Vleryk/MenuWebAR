import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import CategoryTabs from "./components/CategoryTabs";
import MenuSection from "./components/MenuSection";
import ReservationSection from "./components/ReservationSection";
import Footer from "./components/Footer";
import {
  categories as staticCategories,
  menuItems as staticMenuItems,
} from "./data/menuData";
import styles from "./App.module.css";

function App() {
  const [categories, setCategories] = useState(staticCategories);
  const [menuItems, setMenuItems] = useState(staticMenuItems);
  const [activeCategory, setActiveCategory] = useState(staticCategories[0].id);

  useEffect(() => {
    fetch("/api/menu")
      .then((res) => res.json())
      .then((data) => {
        setCategories(data.categories);
        setMenuItems(data.menuItems);
        if (data.categories.length > 0) {
          setActiveCategory(data.categories[0].id);
        }
      })
      .catch(() => {
        // Fallback: usa datos estáticos si el servidor no está disponible
      });
  }, []);

  const filteredItems = useMemo(
    () => menuItems.filter((item) => item.category === activeCategory),
    [activeCategory, menuItems]
  );

  const activeLabel =
    categories.find((category) => category.id === activeCategory)?.label ||
    "Menu";

  return (
    <div className={styles.appShell}>
      <Header />

      <main className={styles.appMain}>
        <CategoryTabs
          categories={categories}
          activeCategory={activeCategory}
          onChange={setActiveCategory}
        />

        <div className={styles.layoutColumns}>
          <aside className={styles.adColumn} aria-label="Publicidad izquierda">
            <div className={styles.adCard}>
              <h3>Publicidad</h3>
              <p>Espacio disponible para anuncios de marcas asociadas.</p>
            </div>
          </aside>

          <div className={styles.mainColumn}>
            <MenuSection title={activeLabel} items={filteredItems} />
          </div>

          <aside className={styles.adColumn} aria-label="Publicidad derecha">
            <div className={styles.adCard}>
              <h3>Publicidad</h3>
              <p>Incluye promociones, eventos o convenios comerciales.</p>
            </div>
          </aside>
        </div>

        <ReservationSection />
      </main>

      <Footer />
    </div>
  );
}

export default App;