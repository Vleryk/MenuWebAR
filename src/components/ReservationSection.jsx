import { useMemo, useState } from "react";
import { FiCalendar, FiClock, FiMapPin, FiUsers } from "react-icons/fi";
import restaurantConfig from "../config/restaurant";
import styles from "./ReservationSection.module.css";

const formatDateForInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toMinutes = (timeValue) => {
  const [hours, minutes] = timeValue.split(":").map(Number);
  return hours * 60 + minutes;
};

const roundUpToQuarter = (minutes) => Math.ceil(minutes / 15) * 15;

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
  const [reservationDate, setReservationDate] = useState(() => formatDateForInput(new Date()));
  const [reservationPeople, setReservationPeople] = useState("2");
  const [reservationTime, setReservationTime] = useState("20:00");
  const [reservationZone, setReservationZone] = useState("salon");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  // Estado para mostrar "Abriendo..." mientras se abren las ventanas
  const [isLoading, setIsLoading] = useState(false);

  const peopleOptions = useMemo(
    () => Array.from({ length: restaurantConfig.reservations.maxPeople }, (_, i) => i + 1),
    [],
  );
  const todayInputDate = formatDateForInput(new Date());

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

  // Filtra los horarios disponibles segun la fecha seleccionada
  const availableTimeSlots = useMemo(() => {
    const selectedDate = new Date(`${reservationDate}T00:00:00`);
    const now = new Date();

    // Si es una fecha futura, muestra todos los horarios
    if (!isSameCalendarDay(selectedDate, now)) {
      return timeSlots;
    }

    // Si es hoy, filtra los horarios que ya pasaron
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const minAllowedMinutes = roundUpToQuarter(
      currentMinutes + restaurantConfig.reservations.minAdvanceMinutes,
    );

    return timeSlots.filter((slot) => toMinutes(slot) >= minAllowedMinutes);
  }, [reservationDate, timeSlots]);

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

    // Valida que haya horarios disponibles
    if (!availableTimeSlots.length || !validReservationTime) {
      setConfirmationMessage("Ya no hay horarios disponibles para hoy. Selecciona otra fecha.");
      setIsLoading(false);
      return;
    }

    const selectedZoneLabel =
      zones.find((zone) => zone.value === reservationZone)?.label ?? "Salon";
    const formattedDate = new Intl.DateTimeFormat("es-CL", {
      dateStyle: "full",
    }).format(new Date(`${reservationDate}T00:00:00`));

    const reservationDetails = `Reserva para ${reservationPeople} personas\nFecha: ${reservationDate}\nHora: ${validReservationTime}\nZona: ${selectedZoneLabel}`;

    // Prepara el mensaje para WhatsApp con todos los datos pre-llenados
    const whatsappMessage = `Hola, me gustaria hacer una reserva para el ${reservationDate} a las ${validReservationTime} en la zona ${selectedZoneLabel} para ${reservationPeople} personas.`;
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;

    // Prepara el email con subject y body pre-llenados
    const emailSubject = `Nueva Reserva - ${reservationDate} ${validReservationTime}`;
    const emailBody = `Solicitud de Reserva%0A%0A${encodeURIComponent(reservationDetails)}%0A%0APor favor, confirmar disponibilidad.`;
    const emailUrl = `mailto:${RESTAURANT_EMAIL}?subject=${encodeURIComponent(emailSubject)}&body=${emailBody}`;

    // Abre WhatsApp y email al mismo tiempo
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    window.open(emailUrl);

    // Muestra mensaje de confirmacion con la info de la reserva
    setConfirmationMessage(
      `Reserva enviada para ${reservationPeople} personas el ${formattedDate} a las ${validReservationTime} en ${selectedZoneLabel}. Se abriran WhatsApp y email.`,
    );

    // Deshabilita el boton durante un momento para que no se abran multiples ventanas
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
            // Se deshabilita si no hay horarios disponibles
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

        {/* El boton se deshabilita si no hay horarios o mientras se abre */}
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
