function Footer() {
  const socialLinks = [
    {
      name: "Instagram",
      url: "https://www.instagram.com/route66_chile/",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 1.8A3.7 3.7 0 0 0 3.8 7.5v9a3.7 3.7 0 0 0 3.7 3.7h9a3.7 3.7 0 0 0 3.7-3.7v-9a3.7 3.7 0 0 0-3.7-3.7h-9Zm9.35 1.35a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z" />
        </svg>
      ),
    },
    {
      name: "Facebook",
      url: "https://www.facebook.com/route66chile",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M13.5 22v-8.3h2.8l.4-3.3h-3.2V8.3c0-1 .3-1.7 1.8-1.7h1.5V3.7c-.3 0-1.1-.1-2.2-.1-2.2 0-3.7 1.4-3.7 4v2.8H8.5v3.3h2.4V22h2.6Z" />
        </svg>
      ),
    },
  ];

  return (
    <footer className="site-footer">
      <div className="footer-brand-col">
        <img
          className="footer-logo"
          src="/assets/references/logo-contraste.7ddc12ebe66a8491be1140703728458f.svg"
          alt="Logo Route 66"
        />
        <p className="footer-tagline">
          La mejor onda y una experiencia de menu digital pensada para sorprender.
        </p>
      </div>

      <div className="footer-info-col">
        <section className="footer-block">
          <h5>Contacto</h5>
          <ul className="footer-contact-list">
            <li>Isidora Goyenechea 2960, Las Condes</li>
            <li>+56 2 3266 9954</li>
            <li>contacto@route66.cl</li>
          </ul>
        </section>

        <section className="footer-block">
          <h5 className="footer-subtitle">Horarios</h5>
          <ul className="footer-hours-list">
            <li>Dom - Mie: 12:30 a 00:00</li>
            <li>Jue - Sab: 12:30 a 01:00</li>
          </ul>
        </section>
      </div>

      <div className="footer-links-col">
        <section className="footer-block">
          <h5>Enlaces</h5>
          <ul className="footer-links-list">
            <li>
              <a href="#">Nuestra carta</a>
            </li>
            <li>
              <a href="#">Reservas</a>
            </li>
            <li>
              <a href="https://delivery.route66.cl/pedir" target="_blank" rel="noreferrer">
                Delivery
              </a>
            </li>
          </ul>
        </section>

        <section className="footer-block">
          <h5 className="footer-subtitle">Redes</h5>
          <ul className="social-list" aria-label="Redes sociales">
            {socialLinks.map((social) => (
              <li key={social.name}>
                <a href={social.url} target="_blank" rel="noreferrer" className="social-item">
                  <span className="social-icon" aria-hidden="true">{social.icon}</span>
                  <span>{social.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="footer-map-col">
        <h5>Ubicacion</h5>
        <div className="footer-map-frame">
          <iframe
            title="Mapa Route 66"
            src="https://www.google.com/maps?q=Isidora+Goyenechea+2960,+Las+Condes&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>

      <div className="footer-bottom">2026 Route 66 ©</div>
    </footer>
  );
}

export default Footer;
