import styles from "./CategoryTabs.module.css";

function CategoryTabs({ categories, activeCategory, onChange }) {
  return (
    <nav className={styles.categoryTabs} aria-label="Categorias del menu">
      {categories.map((category) => {
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
