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

function ReservationSection() {
  const [reservationDate, setReservationDate] = useState(() => formatDateForInput(new Date()));
  const [reservationPeople, setReservationPeople] = useState("2");
  const [reservationTime, setReservationTime] = useState("20:00");
  const [reservationZone, setReservationZone] = useState("salon");
  const [confirmationMessage, setConfirmationMessage] = useState("");

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

  const availableTimeSlots = useMemo(() => {
    const selectedDate = new Date(`${reservationDate}T00:00:00`);
    const now = new Date();

    if (!isSameCalendarDay(selectedDate, now)) {
      return timeSlots;
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const minAllowedMinutes = roundUpToQuarter(
      currentMinutes + restaurantConfig.reservations.minAdvanceMinutes,
    );

    return timeSlots.filter((slot) => toMinutes(slot) >= minAllowedMinutes);
  }, [reservationDate, timeSlots]);

  // Derivar un horario de reserva válido de los slots disponibles
  const validReservationTime = useMemo(() => {
    if (!availableTimeSlots.length) return "";
    if (availableTimeSlots.includes(reservationTime)) return reservationTime;
    return availableTimeSlots[0];
  }, [availableTimeSlots, reservationTime]);

  // Actualizar estado cuando el valor derivado difiere (vía handler del usuario en vez de efecto)
  const handleDateChange = (event) => {
    setReservationDate(event.target.value);
    setConfirmationMessage("");
    // El horario se autocorregirá vía validReservationTime en el próximo render
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!availableTimeSlots.length || !validReservationTime) {
      setConfirmationMessage("Ya no hay horarios disponibles para hoy. Selecciona otra fecha.");
      return;
    }

    const selectedZoneLabel = zones.find((zone) => zone.value === reservationZone)?.label ?? "Salon";
    const formattedDate = new Intl.DateTimeFormat("es-CL", {
      dateStyle: "full",
    }).format(new Date(`${reservationDate}T00:00:00`));

    const whatsappMessage = `Hola, me gustaria hacer una reserva para el ${reservationDate} a las ${validReservationTime} en la zona ${selectedZoneLabel} para ${reservationPeople} personas.`;
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;

    setConfirmationMessage(
      `Reserva enviada para ${reservationPeople} personas el ${formattedDate} a las ${validReservationTime} en ${selectedZoneLabel}.`
    );

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
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

        <button type="submit" className={styles.reservationSubmit} disabled={!availableTimeSlots.length}>
          Reservar
        </button>
      </form>

      {confirmationMessage ? <p className={styles.reservationNotice}>{confirmationMessage}</p> : null}
    </section>
  );
}

export default ReservationSection;
