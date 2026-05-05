import restaurantConfig from "../config/restaurant";
import { useCategories } from "../hooks/useCategories";
import { useMenu } from "../hooks/useMenu";
import { getUsernameFromUrl } from "../utils/getUsernameFromUrl";
import { Icon3D } from "./icons/Icon3D";

import { QRCodeSVG } from "qrcode.react";

import styles from "./menuPrint.module.css";
import { useEffect } from "react";
import { currencyFormatter } from "../config/currencyFormatter";

function MenuPrint() {
  const { categories } = useCategories();
  const { menu } = useMenu();

  const today = new Date().toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const baseUrl = restaurantConfig.links.web ?? window.location.origin;

  const menuByCategory = categories
    .map((category) => ({
      ...category,
      items: menu.filter((item) => item.category === category.id),
    }))
    .filter((category) => category.items.length > 0);

  useEffect(() => {
    const timeout = setTimeout(() => window.print(), 1500);
    return () => clearTimeout(timeout);
  }, []);

  const normalizeHighlightText = (text) => {
    if (!text) return "";

    const cleaned = text
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .toUpperCase();

    return cleaned ? `¡${cleaned}!` : "";
  };

  return (
    <div className={styles.menuPrint}>
      <header className={styles.menuHeader}>
        <img src={restaurantConfig.links.logo} alt={`Logo de ${restaurantConfig.name}`} />
        <h1 className={styles.menuTitle}>{restaurantConfig.name}</h1>

        <p className={styles.menuSubtitle}>CARTA MENÚ</p>
      </header>

      <main>
        {menuByCategory.map((category) => (
          <div key={category.id} className={styles.category}>
            <h2 className={styles.categoryTitle}>{category.label}</h2>

            {category.items.map((item) => {
              const priceFormatted = currencyFormatter.format(item.price);

              return (
                <div key={item.id} className={styles.item}>
                  <img
                    src={item.image}
                    alt={item.name}
                    className={styles.itemImage}
                    loading="lazy"
                  />

                  <div className={styles.itemRow}>
                    <div className={styles.itemContent}>
                      <div>
                        <span className={styles.itemName}>{item.name}</span>
                        {item.cardMessage && (
                          <span
                            className={styles.itemHighlight}
                            style={{ backgroundColor: item.cardColor || "#333" }}
                          >
                            {normalizeHighlightText(item.cardMessage)}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className={styles.itemDescription}>{item.description}</p>
                      )}
                      {item.ingredients.length > 0 && (
                        <div className={styles.itemIngredients}>
                          {item.ingredients.slice(0, 4).map((ingredient, index) => (
                            <span key={index} className={styles.ingredientsBadge}>
                              {ingredient}
                            </span>
                          ))}
                          {item.ingredients.length > 4 && (
                            <span className={styles.ingredientsMore}>
                              +{item.ingredients.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className={styles.infoContainer}>
                      <span className={styles.itemPrice}>{priceFormatted}</span>
                      {item.modelAR && (
                        <span title="Disponible en 3D" className={styles.info3D}>
                          <Icon3D />
                          3D
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </main>

      <footer className={styles.menuFooter}>
        <div className={styles.footerContent}>
          <section className={styles.footerBrand}>
            <img
              src={restaurantConfig.links.logo}
              alt={`logo del restaurante ${restaurantConfig.name}`}
            />
            <h3>{restaurantConfig.name}</h3>
          </section>

          <section className={styles.footerSocials}>
            <p>Síguenos</p>

            {Object.entries(restaurantConfig.social).map(([key, value], index) => (
              <a
                key={index}
                href={value}
                rel="noopener noreferrer"
                target="_blank"
                className={styles.socialLink}
              >
                {key}: {getUsernameFromUrl(value)}
              </a>
            ))}
          </section>

          <section className={styles.footerQR}>
            <p>Explora el menú completo.</p>
            <p>Escanea el código QR para ver ingredientes y modelos 3D</p>
            <QRCodeSVG value={baseUrl || ""} className={styles.qrImage} level="H" />
          </section>
        </div>
        <p>Menú actualizado el {today}</p>
      </footer>
    </div>
  );
}

export { MenuPrint };
