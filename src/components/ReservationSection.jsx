import { useEffect, useMemo, useState } from "react";
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

const WHATSAPP_NUMBER = "56946405741";

function ReservationSection() {
  const [reservationDate, setReservationDate] = useState(() => formatDateForInput(new Date()));
  const [reservationPeople, setReservationPeople] = useState("2");
  const [reservationTime, setReservationTime] = useState("20:00");
  const [reservationZone, setReservationZone] = useState("salon");
  const [confirmationMessage, setConfirmationMessage] = useState("");

  const peopleOptions = useMemo(() => Array.from({ length: 26 }, (_, i) => i + 1), []);
  const todayInputDate = formatDateForInput(new Date());

  const timeSlots = useMemo(() => {
    const slots = [];
    let minutes = 12 * 60 + 30;
    const end = 22 * 60 + 30;
    while (minutes <= end) {
      const hours = Math.floor(minutes / 60)
        .toString()
        .padStart(2, "0");
      const mins = (minutes % 60).toString().padStart(2, "0");
      slots.push(`${hours}:${mins}`);
      minutes += 15;
    }
    return slots;
  }, []);

  const zones = [
    { label: "Salon", value: "salon" },
    { label: "Barra", value: "barra" },
    { label: "Terraza", value: "terraza" },
  ];

  const availableTimeSlots = useMemo(() => {
    const selectedDate = new Date(`${reservationDate}T00:00:00`);
    const now = new Date();

    if (!isSameCalendarDay(selectedDate, now)) {
      return timeSlots;
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const minAllowedMinutes = roundUpToQuarter(currentMinutes + 60);

    return timeSlots.filter((slot) => toMinutes(slot) >= minAllowedMinutes);
  }, [reservationDate, timeSlots]);

  useEffect(() => {
    if (!availableTimeSlots.length) {
      setReservationTime("");
      return;
    }

    if (!availableTimeSlots.includes(reservationTime)) {
      setReservationTime(availableTimeSlots[0]);
    }
  }, [availableTimeSlots, reservationTime]);

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!availableTimeSlots.length || !reservationTime) {
      setConfirmationMessage("Ya no hay horarios disponibles para hoy. Selecciona otra fecha.");
      return;
    }

    const selectedZoneLabel = zones.find((zone) => zone.value === reservationZone)?.label ?? "Salon";
    const formattedDate = new Intl.DateTimeFormat("es-CL", {
      dateStyle: "full",
    }).format(new Date(`${reservationDate}T00:00:00`));

    const whatsappMessage = `Hola, me gustaria hacer una reserva para el ${reservationDate} a las ${reservationTime} en la zona ${selectedZoneLabel} para ${reservationPeople} personas.`;
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;

    setConfirmationMessage(
      `Reserva enviada para ${reservationPeople} personas el ${formattedDate} a las ${reservationTime} en ${selectedZoneLabel}.`
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
          <span>Fecha</span>
          <input
            type="date"
            min={todayInputDate}
            value={reservationDate}
            onChange={(event) => {
              setReservationDate(event.target.value);
              setConfirmationMessage("");
            }}
            required
          />
        </label>

        <label className={styles.reservationField}>
          <span>Personas</span>
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
          <span>Hora</span>
          <select
            required
            value={reservationTime}
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
          <span>Zona</span>
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
