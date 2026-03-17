function CategoryTabs({ categories, activeCategory, onChange }) {
  return (
    <nav className="category-tabs" aria-label="Categorias del menu">
      {categories.map((category) => {
        const isActive = activeCategory === category.id;

        return (
          <button
            key={category.id}
            type="button"
            className={`category-btn ${isActive ? "active" : ""}`}
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
