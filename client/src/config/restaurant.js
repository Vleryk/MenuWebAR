// Configuracion central del restaurante. Es la unica fuente de verdad para
// los datos del local: nombre, contacto, horarios, redes, etc.
//
// IMPORTANTE: si hay que cambiar algo del local (numero de telefono, email,
// horario, direccion, link de delivery, etc) se cambia ACA y se reflejan en
// todos los componentes que lo importan. No hay otro lugar donde esten
// hardcodeados.
//
// Componentes que consumen este archivo: Header, Footer, ReservationSection.

const restaurantConfig = {
  name: "Route 66",
  tagline: "La mejor onda y una experiencia de menu digital pensada para sorprender.",

  // Contacto: lo usan Footer (mostrar) y ReservationSection (whatsapp + mail).
  // El whatsappNumber tiene que estar en formato internacional sin + ni
  // espacios para que funcione la URL wa.me/56946405741.
  contact: {
    address: "Isidora Goyenechea 2960, Las Condes",
    phone: "+56 2 3266 9954",
    email: "contacto@route66.cl",
    whatsappNumber: "56946405741",
  },

  // Horarios: solo se muestran como texto en el Footer. La logica de
  // "abierto/cerrado" en el Footer NO usa este array (los horarios reales
  // estan hardcodeados ahi). Si cambian los horarios hay que tocar los dos
  // lugares.
  hours: [
    { days: "Dom - Mie", time: "12:30 a 00:00" },
    { days: "Jue - Sab", time: "12:30 a 01:00" },
  ],

  social: {
    instagram: "https://www.instagram.com/route66_chile/",
    facebook: "https://www.facebook.com/route66chile",
  },

  links: {
    // URL del servicio de delivery propio del restaurante
    delivery: "https://delivery.route66.cl/pedir",
    // Logo en SVG, sirve para Header y Footer
    logo: "/assets/references/logo-contraste.7ddc12ebe66a8491be1140703728458f.svg",
    // URL del iframe de Google Maps para embeber en el Footer
    mapEmbed: "https://www.google.com/maps?q=Isidora+Goyenechea+2960,+Las+Condes&output=embed",
  },

  // Configuracion de la seccion de reservas. ReservationSection genera
  // todos los slots de horario a partir de estos valores.
  reservations: {
    // Zonas posibles para reservar. value es lo que se manda en el mensaje,
    // label es lo que se muestra en el select.
    zones: [
      { label: "Salon", value: "salon" },
      { label: "Barra", value: "barra" },
      { label: "Terraza", value: "terraza" },
    ],
    maxPeople: 26, // Tope del select de personas
    startTime: "12:30", // Primer slot del dia
    endTime: "22:30", // Ultimo slot del dia
    intervalMinutes: 15, // Cada cuanto hay un slot (12:30, 12:45, 13:00...)
    // Tiempo minimo de anticipacion para reservar hoy. Si son las 18:00 y
    // este valor es 60, el primer slot disponible sera 19:00.
    minAdvanceMinutes: 60,
  },
};

export default restaurantConfig;
