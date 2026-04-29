// Footer del menu publico. Contiene cuatro columnas:
//   1. Brand: logo + tagline (y redes en mobile)
//   2. Info: contacto + horarios + badge "abierto/cerrado" en vivo
//   3. Links: navegacion interna + redes (en desktop)
//   4. Mapa de Google embebido
//
// Lo mas interesante aca es el badge de "Abierto/Cerrado" que se calcula en
// tiempo real comparando la hora actual con los horarios del local.

import { useEffect, useState } from "react";
import restaurantConfig from "../config/restaurant";
import styles from "./Footer.module.css";
import { IconFacebook } from "./icons/IconFacebook";
import { IconInstagram } from "./icons/IconInstagram";

function Footer() {
  // Estado para saber si el restaurante esta abierto en este momento
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Funcion que chequea la hora actual contra los horarios.
    // Calculamos en minutos desde medianoche para comparar facil.
    const checkIfOpen = () => {
      const now = new Date();
      const day = now.getDay(); // 0=domingo, 1=lunes, etc
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      // Horarios: abre a las 12:30 todos los dias.
      // Cierra a las 23:00 dom-mar, 00:00 mie-sab.
      // OJO: hardcodeamos aca en lugar de usar restaurantConfig.hours porque
      // ese formato es texto libre ("Dom - Mie", "12:30 a 00:00") y seria
      // un parseo complicado. Si cambian los horarios hay que tocar los dos.
      const schedules = {
        0: { open: 12 * 60 + 30, close: 23 * 60 }, // Domingo
        1: { open: 12 * 60 + 30, close: 23 * 60 }, // Lunes
        2: { open: 12 * 60 + 30, close: 23 * 60 }, // Martes
        3: { open: 12 * 60 + 30, close: 24 * 60 }, // Miercoles
        4: { open: 12 * 60 + 30, close: 24 * 60 }, // Jueves
        5: { open: 12 * 60 + 30, close: 24 * 60 }, // Viernes
        6: { open: 12 * 60 + 30, close: 24 * 60 }, // Sabado
      };

      const today = schedules[day];
      // Compara si la hora actual esta dentro del horario
      setIsOpen(currentMinutes >= today.open && currentMinutes < today.close);
    };

    checkIfOpen();
    // Actualiza el estado cada minuto para que el badge no quede desfasado
    // si el user deja la pagina abierta mucho rato.
    const interval = setInterval(checkIfOpen, 60000);
    return () => clearInterval(interval);
  }, []);

  // Iconos de redes como SVG inline. Mismo patron que en Header.jsx.
  const socialLinks = [
    {
      name: "Instagram",
      url: restaurantConfig.social.instagram,
      icon: <IconInstagram />,
    },
    {
      name: "Facebook",
      url: restaurantConfig.social.facebook,
      icon: <IconFacebook />,
    },
  ];

  return (
    <footer className={styles.siteFooter} id="footer">
      <div className={styles.footerBrandCol}>
        <img
          className={styles.footerLogo}
          src={restaurantConfig.links.logo}
          alt={`Logo ${restaurantConfig.name}`}
        />
        <p className={styles.footerTagline}>{restaurantConfig.tagline}</p>
        {/* Las redes sociales aparecen aqui solo en mobile.
            En desktop se muestran abajo en la columna de Links. CSS oculta
            cada bloque segun el viewport. */}
        <div className={styles.socialListMobile}>
          <ul className={styles.socialList} aria-label="Redes sociales">
            {socialLinks.map((social) => (
              <li key={social.name}>
                <a href={social.url} target="_blank" rel="noreferrer" className={styles.socialItem}>
                  <span className={styles.socialIcon} aria-hidden="true">
                    {social.icon}
                  </span>
                  <span>{social.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={styles.footerInfoCol}>
        <section className={styles.footerBlock}>
          <h5>Contacto</h5>
          <ul className={styles.footerContactList}>
            <li>{restaurantConfig.contact.address}</li>
            <li>{restaurantConfig.contact.phone}</li>
            <li>{restaurantConfig.contact.email}</li>
          </ul>
        </section>

        <section className={styles.footerBlock}>
          <div className={styles.hoursHeader}>
            <h5 className={styles.footerSubtitle}>Horarios</h5>
            {/* Badge que muestra si el local esta abierto o cerrado en
                tiempo real, calculado por checkIfOpen() arriba. */}
            <span
              className={`${styles.statusBadge} ${isOpen ? styles.statusOpen : styles.statusClosed}`}
            >
              <span className={styles.statusDot} />
              {isOpen ? "Abierto" : "Cerrado"}
            </span>
          </div>
          <ul className={styles.footerHoursList}>
            {restaurantConfig.hours.map((h) => (
              <li key={h.days}>
                {h.days}: {h.time}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className={styles.footerLinksCol}>
        <section className={styles.footerBlock}>
          <h5>Enlaces</h5>
          <ul className={styles.footerLinksList}>
            <li>
              <a href="#menu">Nuestra carta</a>
            </li>
            <li>
              <a href="#reservas">Reservas</a>
            </li>
            <li>
              <a href="#footer">Sobre nosotros</a>
            </li>
            <li>
              <a href={restaurantConfig.links.delivery} target="_blank" rel="noreferrer">
                Delivery
              </a>
            </li>
          </ul>
        </section>

        <section className={styles.footerBlock}>
          <h5 className={styles.footerSubtitle}>Redes</h5>
          {/* Las redes sociales aparecen aqui en desktop (en mobile se
              muestran arriba en la columna de brand). */}
          <ul className={styles.socialList} aria-label="Redes sociales">
            {socialLinks.map((social) => (
              <li key={social.name}>
                <a href={social.url} target="_blank" rel="noreferrer" className={styles.socialItem}>
                  <span className={styles.socialIcon} aria-hidden="true">
                    {social.icon}
                  </span>
                  <span>{social.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className={styles.footerMapCol}>
        <h5>Ubicacion</h5>
        <div className={styles.footerMapFrame}>
          {/* Iframe de Google Maps embebido. La URL del embed esta en el
              config para poder cambiarla sin tocar codigo. */}
          <iframe
            title={`Mapa ${restaurantConfig.name}`}
            src={restaurantConfig.links.mapEmbed}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>

      <div className={styles.footerBottom}>2026 Route 66 ©</div>
    </footer>
  );
}

export default Footer;
