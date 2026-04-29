import restaurantConfig from "../config/restaurant";
import styles from "./Header.module.css";
import { IconFacebook } from "./icons/IconFacebook";
import { IconInstagram } from "./icons/IconInstagram";

function Header() {
  const navLinks = [
    { label: "Carta", href: "#menu" },
    { label: "Reservas", href: "#reservas" },
    { label: "Delivery", href: restaurantConfig.links.delivery },
    { label: "Sobre Nosotros", href: "#footer" },
  ];

  const socialLinks = [
    {
      name: "Instagram",
      url: restaurantConfig.social.instagram,
      icon: "📷",
    },
    {
      name: "Facebook",
      url: restaurantConfig.social.facebook,
      icon: "f",
    },
  ];

  return (
    <header className={styles.headerNavbar}>
      <div className={styles.navbarContent}>
        <img className={styles.navbarLogo} src={restaurantConfig.links.logo} alt="Logo Route 66" />

        <nav className={styles.navbarLinks}>
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.href.startsWith("http") ? "_blank" : "_self"}
              rel="noreferrer"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className={styles.navbarSocials}>
          {socialLinks.map((social) => (
            <a
              key={social.name}
              href={social.url}
              target="_blank"
              rel="noreferrer"
              title={social.name}
              className={styles.socialIconLink}
            >
              {social.name === "Instagram" ? <IconInstagram /> : <IconFacebook />}
            </a>
          ))}
        </div>
      </div>
    </header>
  );
}

export default Header;
