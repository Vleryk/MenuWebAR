// Tabs horizontales con las categorias del menu (Entradas, Hamburguesas,
// Bebidas, etc). Es un componente "controlado": no maneja estado propio,
// recibe la categoria activa y un callback por props.
//
// El padre (App.jsx) es el que guarda el state. Este componente solo dibuja.

import styles from "./CategoryTabs.module.css";

function CategoryTabs({ categories, activeCategory, onChange }) {
  return (
    <nav className={styles.categoryTabs} aria-label="Categorias del menu">
      {categories.map((category) => {
        // Comparamos por id, no por label, porque dos categorias podrian
        // tener el mismo nombre eventualmente.
        const isActive = activeCategory === category.id;

        return (
          <button
            key={category.id}
            type="button"
            className={`${styles.categoryBtn} ${isActive ? styles.active : ""}`}
            onClick={() => onChange(category.id)}
          >
            {category.label}
          </button>
        );
      })}
    </nav>
  );
}

export default CategoryTabs;
