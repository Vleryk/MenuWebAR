import { useEffect, useState } from "react";
import restaurantConfig from "../config/restaurant";
import styles from "./Footer.module.css";

function Footer() {
  // Estado para saber si el restaurante esta abierto en este momento
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Funcion que chequea la hora actual contra los horarios
    const checkIfOpen = () => {
      const now = new Date();
      const day = now.getDay(); // 0=domingo, 1=lunes, etc
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      // Horarios: abre a las 12:30 todos los dias
      // Cierra a las 23:00 dom-mar, 00:00 mie-sab
      const schedules = {
        0: { open: 12 * 60 + 30, close: 23 * 60 },       // Domingo
        1: { open: 12 * 60 + 30, close: 23 * 60 },       // Lunes
        2: { open: 12 * 60 + 30, close: 23 * 60 },       // Martes
        3: { open: 12 * 60 + 30, close: 24 * 60 },       // Miercoles
        4: { open: 12 * 60 + 30, close: 24 * 60 },       // Jueves
        5: { open: 12 * 60 + 30, close: 24 * 60 },       // Viernes
        6: { open: 12 * 60 + 30, close: 24 * 60 },       // Sabado
      };

      const today = schedules[day];
      // Compara si la hora actual esta dentro del horario
      setIsOpen(currentMinutes >= today.open && currentMinutes < today.close);
    };

    checkIfOpen();
    // Actualiza el estado cada minuto para que no desfase
    const interval = setInterval(checkIfOpen, 60000);
    return () => clearInterval(interval);
  }, []);

  const socialLinks = [
    {
      name: "Instagram",
      url: restaurantConfig.social.instagram,
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 1.8A3.7 3.7 0 0 0 3.8 7.5v9a3.7 3.7 0 0 0 3.7 3.7h9a3.7 3.7 0 0 0 3.7-3.7v-9a3.7 3.7 0 0 0-3.7-3.7h-9Zm9.35 1.35a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z" />
        </svg>
      ),
    },
    {
      name: "Facebook",
      url: restaurantConfig.social.facebook,
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M13.5 22v-8.3h2.8l.4-3.3h-3.2V8.3c0-1 .3-1.7 1.8-1.7h1.5V3.7c-.3 0-1.1-.1-2.2-.1-2.2 0-3.7 1.4-3.7 4v2.8H8.5v3.3h2.4V22h2.6Z" />
        </svg>
      ),
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
        <p className={styles.footerTagline}>
          {restaurantConfig.tagline}
        </p>
        {/* Las redes sociales aparecen aqui solo en mobile */}
        <div className={styles.socialListMobile}>
          <ul className={styles.socialList} aria-label="Redes sociales">
            {socialLinks.map((social) => (
              <li key={social.name}>
                <a href={social.url} target="_blank" rel="noreferrer" className={styles.socialItem}>
                  <span className={styles.socialIcon} aria-hidden="true">{social.icon}</span>
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
            {/* Badge que muestra si el local esta abierto o cerrado en tiempo real */}
            <span className={`${styles.statusBadge} ${isOpen ? styles.statusOpen : styles.statusClosed}`}>
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
          {/* Las redes sociales aparecen aqui en desktop */}
          <ul className={styles.socialList} aria-label="Redes sociales">
            {socialLinks.map((social) => (
              <li key={social.name}>
                <a href={social.url} target="_blank" rel="noreferrer" className={styles.socialItem}>
                  <span className={styles.socialIcon} aria-hidden="true">{social.icon}</span>
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