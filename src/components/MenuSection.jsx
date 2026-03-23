import MenuCard from "./MenuCard";
import styles from "./MenuSection.module.css";

function MenuSection({ title, items }) {
  return (
    <section className={styles.menuSection} id="menu">
      <h2 className={styles.title}>{title}</h2>
      <div key={title} className={`${styles.menuGrid} ${styles.fadeIn}`}>
        {items.map((item) => (
          <MenuCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

export default MenuSection;
