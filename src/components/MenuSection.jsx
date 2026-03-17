import MenuCard from "./MenuCard";

function MenuSection({ title, items }) {
  return (
    <section className="menu-section" id="menu">
      <h2>{title}</h2>
      <div className="menu-grid">
        {items.map((item) => (
          <MenuCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

export default MenuSection;
