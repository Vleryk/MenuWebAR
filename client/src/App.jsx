import { useMemo } from "react";
import Header from "./components/Header";
import CategoryTabs from "./components/CategoryTabs";
import MenuSection from "./components/MenuSection";
import { MenuSkeleton } from "./components/MenuCardSkeleton";
import ReservationSection from "./components/ReservationSection";
import Footer from "./components/Footer";
import styles from "./App.module.css";

import { useCategories } from "./hooks/useCategories";
import { useMenu } from "./hooks/useMenu";

function App() {
  const { categories, activeCategory, setActiveCategory } = useCategories();
  const { menu: menuItems, loading } = useMenu();

  const filteredItems = useMemo(
    () => menuItems.filter((item) => item.category === activeCategory),
    [activeCategory, menuItems],
  );

  const activeLabel = categories.find((category) => category.id === activeCategory)?.label;

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
            {loading ? (
              <MenuSkeleton count={6} />
            ) : (
              <MenuSection title={activeLabel} items={filteredItems} />
            )}
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
