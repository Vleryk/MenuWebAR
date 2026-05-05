// Seccion de reservas. NO guarda la reserva en BD: cuando el user confirma,
// se abren WhatsApp y email con los datos pre-llenados para que el local
// confirme manualmente. Esto se eligio asi para no tener que mantener un
// sistema de reservas con disponibilidad real.
//
// Logica clave:
//   - Genera slots de horario cada 15 min entre startTime y endTime
//   - Si la fecha es hoy, filtra los slots que ya pasaron (con un colchon
//     de minAdvanceMinutes que viene del config)
//   - Al confirmar, abre dos ventanas: WhatsApp con mensaje y mailto con email

import { useMemo, useState } from "react";
import { FiCalendar, FiClock, FiMapPin, FiUsers } from "react-icons/fi";
import restaurantConfig from "../config/restaurant";
import styles from "./ReservationSection.module.css";

// Helper: convierte un Date a formato "YYYY-MM-DD" para usar en input type="date".
const formatDateForInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Helper: "20:30" -> 1230 (minutos desde medianoche). Mas facil para comparar.
const toMinutes = (timeValue) => {
  const [hours, minutes] = timeValue.split(":").map(Number);
  return hours * 60 + minutes;
};

// Redondea hacia arriba al proximo cuarto de hora. Ej: 18:07 -> 18:15.
// Se usa para que si pides reservar "ahora", el primer slot disponible este
// alineado con los slots de 15 min.
const roundUpToQuarter = (minutes) => Math.ceil(minutes / 15) * 15;

// Compara si dos fechas son el mismo dia (ignora hora).
const isSameCalendarDay = (leftDate, rightDate) => {
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
};

const WHATSAPP_NUMBER = restaurantConfig.contact.whatsappNumber;
const RESTAURANT_EMAIL = restaurantConfig.contact.email;

function ReservationSection() {
  // Defaults razonables: hoy, 2 personas, 20:00, salon.
  const [reservationDate, setReservationDate] = useState(() => formatDateForInput(new Date()));
  const [reservationPeople, setReservationPeople] = useState("2");
  const [reservationTime, setReservationTime] = useState("20:00");
  const [reservationZone, setReservationZone] = useState("salon");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  // Estado para mostrar "Abriendo..." mientras se abren las ventanas
  const [isLoading, setIsLoading] = useState(false);

  // Genera array [1, 2, 3, ..., maxPeople] para el select de personas.
  // useMemo porque maxPeople no cambia, no tiene sentido recalcular.
  const peopleOptions = useMemo(
    () => Array.from({ length: restaurantConfig.reservations.maxPeople }, (_, i) => i + 1),
    [],
  );
  const todayInputDate = formatDateForInput(new Date());

  // Genera todos los slots de horario (12:30, 12:45, 13:00, ...) en
  // intervalos de intervalMinutes hasta endTime. No depende de la fecha
  // seleccionada, asi que useMemo con array vacio.
  const timeSlots = useMemo(() => {
    const slots = [];
    const [startH, startM] = restaurantConfig.reservations.startTime.split(":").map(Number);
    const [endH, endM] = restaurantConfig.reservations.endTime.split(":").map(Number);
    let minutes = startH * 60 + startM;
    const end = endH * 60 + endM;
    while (minutes <= end) {
      const hours = Math.floor(minutes / 60)
        .toString()
        .padStart(2, "0");
      const mins = (minutes % 60).toString().padStart(2, "0");
      slots.push(`${hours}:${mins}`);
      minutes += restaurantConfig.reservations.intervalMinutes;
    }
    return slots;
  }, []);

  const zones = restaurantConfig.reservations.zones;

  // Filtra los horarios disponibles segun la fecha seleccionada.
  // Si es una fecha futura, todos. Si es hoy, solo los que vienen despues
  // de la hora actual + minAdvanceMinutes.
  const availableTimeSlots = useMemo(() => {
    const selectedDate = new Date(`${reservationDate}T00:00:00`);
    const now = new Date();

    // Si es una fecha futura, muestra todos los horarios
    if (!isSameCalendarDay(selectedDate, now)) {
      return timeSlots;
    }

    // Si es hoy, filtra los horarios que ya pasaron + el colchon minimo
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const minAllowedMinutes = roundUpToQuarter(
      currentMinutes + restaurantConfig.reservations.minAdvanceMinutes,
    );

    return timeSlots.filter((slot) => toMinutes(slot) >= minAllowedMinutes);
  }, [reservationDate, timeSlots]);

  // Si el horario seleccionado ya no esta disponible (porque cambio la
  // fecha o paso el tiempo), defaulteamos al primer disponible. Asi nunca
  // se muestra un horario invalido.
  const validReservationTime = useMemo(() => {
    if (!availableTimeSlots.length) return "";
    if (availableTimeSlots.includes(reservationTime)) return reservationTime;
    return availableTimeSlots[0];
  }, [availableTimeSlots, reservationTime]);

  const handleDateChange = (event) => {
    setReservationDate(event.target.value);
    setConfirmationMessage("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setIsLoading(true);

    // Valida que haya horarios disponibles (puede no haberlos si es muy
    // tarde y ya paso el cierre).
    if (!availableTimeSlots.length || !validReservationTime) {
      setConfirmationMessage("Ya no hay horarios disponibles para hoy. Selecciona otra fecha.");
      setIsLoading(false);
      return;
    }

    const selectedZoneLabel =
      zones.find((zone) => zone.value === reservationZone)?.label ?? "Salon";
    // Formatea la fecha en español: "lunes, 15 de marzo de 2026".
    const formattedDate = new Intl.DateTimeFormat("es-CL", {
      dateStyle: "full",
    }).format(new Date(`${reservationDate}T00:00:00`));

    const reservationDetails = `Reserva para ${reservationPeople} personas\nFecha: ${reservationDate}\nHora: ${validReservationTime}\nZona: ${selectedZoneLabel}`;

    // Prepara el mensaje para WhatsApp con todos los datos pre-llenados
    // para que el user solo tenga que tocar enviar.
    const whatsappMessage = `Hola, me gustaria hacer una reserva para el ${reservationDate} a las ${validReservationTime} en la zona ${selectedZoneLabel} para ${reservationPeople} personas.`;
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;

    // Email tambien pre-llenado: subject + body. mailto: abre el cliente
    // de email del user (Gmail, Outlook, Apple Mail, etc).
    const emailSubject = `Nueva Reserva - ${reservationDate} ${validReservationTime}`;
    const emailBody = `Solicitud de Reserva%0A%0A${encodeURIComponent(reservationDetails)}%0A%0APor favor, confirmar disponibilidad.`;
    const emailUrl = `mailto:${RESTAURANT_EMAIL}?subject=${encodeURIComponent(emailSubject)}&body=${emailBody}`;

    // Abre WhatsApp y email al mismo tiempo. Algunos navegadores bloquean
    // la segunda window.open() si pasa muy rapido, por eso a veces solo
    // se abre uno. No es critico, el user igual confirma manualmente.
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    window.open(emailUrl);

    // Muestra mensaje de confirmacion con la info de la reserva
    setConfirmationMessage(
      `Reserva enviada para ${reservationPeople} personas el ${formattedDate} a las ${validReservationTime} en ${selectedZoneLabel}. Se abriran WhatsApp y email.`,
    );

    // Deshabilita el boton durante un momento para que el user no haga
    // doble click y se abran ventanas duplicadas.
    setTimeout(() => setIsLoading(false), 1500);
  };

  return (
    <section className={styles.reservationSection} id="reservas">
      <div className={styles.reservationHeader}>
        <h2>Reservas</h2>
        <p>Elige fecha, hora y zona para asegurar tu mesa.</p>
      </div>

      <form className={styles.reservationForm} onSubmit={handleSubmit}>
        <label className={styles.reservationField}>
          <span className={styles.fieldLabel}>
            <FiCalendar className={styles.fieldLabelIcon} aria-hidden="true" />
            Fecha
          </span>
          {/* min={todayInputDate} bloquea elegir fechas pasadas */}
          <input
            type="date"
            min={todayInputDate}
            value={reservationDate}
            onChange={handleDateChange}
            required
          />
        </label>

        <label className={styles.reservationField}>
          <span className={styles.fieldLabel}>
            <FiUsers className={styles.fieldLabelIcon} aria-hidden="true" />
            Personas
          </span>
          <select
            required
            value={reservationPeople}
            onChange={(event) => {
              setReservationPeople(event.target.value);
              // Limpiamos el mensaje de confirmacion para que se vea claro
              // que es una nueva reserva si vuelven a confirmar.
              setConfirmationMessage("");
            }}
          >
            {peopleOptions.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.reservationField}>
          <span className={styles.fieldLabel}>
            <FiClock className={styles.fieldLabelIcon} aria-hidden="true" />
            Hora
          </span>
          <select
            required
            value={validReservationTime}
            onChange={(event) => {
              setReservationTime(event.target.value);
              setConfirmationMessage("");
            }}
            // Se deshabilita si no hay horarios disponibles (ej: ya cerro)
            disabled={!availableTimeSlots.length}
          >
            {availableTimeSlots.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.reservationField}>
          <span className={styles.fieldLabel}>
            <FiMapPin className={styles.fieldLabelIcon} aria-hidden="true" />
            Zona
          </span>
          <select
            required
            value={reservationZone}
            onChange={(event) => {
              setReservationZone(event.target.value);
              setConfirmationMessage("");
            }}
          >
            {zones.map((zone) => (
              <option key={zone.value} value={zone.value}>
                {zone.label}
              </option>
            ))}
          </select>
        </label>

        {/* El boton se deshabilita si no hay horarios o mientras se abre
            para evitar doble submit. */}
        <button
          type="submit"
          className={styles.reservationSubmit}
          disabled={!availableTimeSlots.length || isLoading}
        >
          {isLoading ? "Abriendo..." : "Reservar"}
        </button>
      </form>

      {/* Muestra el mensaje de confirmacion cuando se envio la reserva */}
      {confirmationMessage ? (
        <p className={styles.reservationNotice}>{confirmationMessage}</p>
      ) : null}
    </section>
  );
}

export default ReservationSection;
