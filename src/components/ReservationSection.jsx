import { useMemo } from "react";

function ReservationSection() {
  const peopleOptions = useMemo(() => Array.from({ length: 26 }, (_, i) => i + 1), []);

  const timeSlots = useMemo(() => {
    const slots = [];
    let minutes = 14 * 60;
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

  return (
    <section className="reservation-section" id="reservas">
      <div className="reservation-header">
        <h2>Reservas</h2>
        <p>Elige fecha, hora y zona para asegurar tu mesa.</p>
      </div>

      <form className="reservation-form" onSubmit={(e) => e.preventDefault()}>
        <label className="reservation-field">
          <span>Fecha</span>
          <input type="date" required />
        </label>

        <label className="reservation-field">
          <span>Personas</span>
          <select required defaultValue="2">
            {peopleOptions.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>

        <label className="reservation-field">
          <span>Hora</span>
          <select required defaultValue="20:00">
            {timeSlots.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </label>

        <label className="reservation-field">
          <span>Zona</span>
          <select required defaultValue="salon">
            {zones.map((zone) => (
              <option key={zone.value} value={zone.value}>
                {zone.label}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="reservation-submit">
          Reservar
        </button>
      </form>
    </section>
  );
}

export default ReservationSection;
