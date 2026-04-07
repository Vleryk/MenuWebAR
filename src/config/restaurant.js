/**
 * Restaurant configuration — single source of truth for all restaurant details.
 * Import this in any component instead of hardcoding values.
 */
const restaurantConfig = {
  name: "Route 66",
  tagline: "La mejor onda y una experiencia de menu digital pensada para sorprender.",

  contact: {
    address: "Isidora Goyenechea 2960, Las Condes",
    phone: "+56 2 3266 9954",
    email: "contacto@route66.cl",
    whatsappNumber: "56946405741",
  },

  hours: [
    { days: "Dom - Mie", time: "12:30 a 00:00" },
    { days: "Jue - Sab", time: "12:30 a 01:00" },
  ],

  social: {
    instagram: "https://www.instagram.com/route66_chile/",
    facebook: "https://www.facebook.com/route66chile",
  },

  links: {
    delivery: "https://delivery.route66.cl/pedir",
    logo: "/assets/references/logo-contraste.7ddc12ebe66a8491be1140703728458f.svg",
    mapEmbed:
      "https://www.google.com/maps?q=Isidora+Goyenechea+2960,+Las+Condes&output=embed",
  },

  reservations: {
    zones: [
      { label: "Salon", value: "salon" },
      { label: "Barra", value: "barra" },
      { label: "Terraza", value: "terraza" },
    ],
    maxPeople: 26,
    startTime: "12:30",
    endTime: "22:30",
    intervalMinutes: 15,
    minAdvanceMinutes: 60,
  },
};

export default restaurantConfig;
