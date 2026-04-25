// Seccion de platos. Recibe un titulo (label de la categoria activa) y la
// lista filtrada de items, y los renderea en un grid.
//
// Detalle: usamos `key={title}` en el div del grid para forzar a React a
// remontarlo cuando cambia la categoria. Eso reinicia la animacion fadeIn
// asi cada vez que el user cambia de tab se ven los platos aparecer.

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
