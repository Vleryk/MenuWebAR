import { useEffect, useState } from "react";

export const useRestaurantOpenStatus = () => {
  // Estado para saber si el restaurante esta abierto en este momento
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Funcion que chequea la hora actual contra los horarios.
    // Calculamos en minutos desde medianoche para comparar facil.
    const checkIfOpen = () => {
      const now = new Date();
      const day = now.getDay(); // 0=domingo, 1=lunes, etc
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      // Horarios: abre a las 12:30 todos los dias.
      // Cierra a las 23:00 dom-mar, 00:00 mie-sab.
      // OJO: hardcodeamos aca en lugar de usar restaurantConfig.hours porque
      // ese formato es texto libre ("Dom - Mie", "12:30 a 00:00") y seria
      // un parseo complicado. Si cambian los horarios hay que tocar los dos.
      const schedules = {
        0: { open: 12 * 60 + 30, close: 23 * 60 }, // Domingo
        1: { open: 12 * 60 + 30, close: 23 * 60 }, // Lunes
        2: { open: 12 * 60 + 30, close: 23 * 60 }, // Martes
        3: { open: 12 * 60 + 30, close: 24 * 60 }, // Miercoles
        4: { open: 12 * 60 + 30, close: 24 * 60 }, // Jueves
        5: { open: 12 * 60 + 30, close: 24 * 60 }, // Viernes
        6: { open: 12 * 60 + 30, close: 24 * 60 }, // Sabado
      };

      const today = schedules[day];
      // Compara si la hora actual esta dentro del horario
      setIsOpen(currentMinutes >= today.open && currentMinutes < today.close);
    };

    checkIfOpen();
    // Actualiza el estado cada minuto para que el badge no quede desfasado
    // si el user deja la pagina abierta mucho rato.
    const interval = setInterval(checkIfOpen, 60000);
    return () => clearInterval(interval);
  }, []);

  return {
    isOpen,
    setIsOpen,
  };
};
