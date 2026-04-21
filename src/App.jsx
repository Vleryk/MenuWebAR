import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import CategoryTabs from "./components/CategoryTabs";
import MenuSection from "./components/MenuSection";
import { MenuSkeleton } from "./components/MenuCardSkeleton";
import ReservationSection from "./components/ReservationSection";
import Footer from "./components/Footer";
import { supabase } from "./utils/supabase";
import styles from "./App.module.css";

function App() {
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [todos, setTodos] = useState([]);
  const [todosError, setTodosError] = useState("");

  useEffect(() => {
    fetch("/api/menu")
      .then((res) => {
        if (!res.ok) throw new Error("Error al conectar con el servidor");
        return res.json();
      })
      .then((data) => {
        setCategories(data.categories || []);
        setMenuItems(data.menuItems || []);

        if (data.categories && data.categories.length > 0) {
          setActiveCategory(data.categories[0].id);
        }
      })
      .catch((err) => {
        console.error("Error cargando el menú principal:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    async function getTodos() {
      const { data, error } = await supabase.from("todos").select();

      if (error) {
        console.error("Error cargando todos desde Supabase:", error);
        setTodosError("No se pudieron cargar tareas desde Supabase.");
        return;
      }

      setTodos(data || []);
    }

    getTodos();
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

        <section className={styles.todoSection} aria-label="Tareas desde Supabase">
          <h2>Todos</h2>

          {todosError ? (
            <p className={styles.todoError}>{todosError}</p>
          ) : (
            <ul className={styles.todoList}>
              {todos.map((todo) => (
                <li key={todo.id}>{todo.name}</li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default App;