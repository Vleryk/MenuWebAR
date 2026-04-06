import restaurantConfig from "../config/restaurant";
import styles from "./Footer.module.css";

function Footer() {
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
          <h5 className={styles.footerSubtitle}>Horarios</h5>
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
