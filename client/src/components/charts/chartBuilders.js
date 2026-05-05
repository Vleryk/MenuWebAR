export function buildTrendData(byDay) {
  const labels = Object.keys(byDay || {}).sort();
  const values = labels.map((d) => byDay[d]);

  return {
    labels: labels.map((d) => {
      const date = new Date(d + "T12:00:00");
      return date.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
    }),
    datasets: [
      {
        data: values,
        borderColor: "#d4aa63",
        backgroundColor: "rgba(212,170,99,0.15)",
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: "#d4aa63",
      },
    ],
  };
}

export function buildByActionData(byAction) {
  return {
    labels: Object.keys(byAction || {}),
    datasets: [
      {
        data: Object.values(byAction || {}),
        backgroundColor: ["#4ade80", "#60a5fa", "#f87171"],
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };
}

export function buildByEntityData(byEntity) {
  return {
    labels: Object.keys(byEntity || {}),
    datasets: [
      {
        data: Object.values(byEntity || {}),
        backgroundColor: ["#d4aa63", "#a78bfa", "#34d399", "#f472b6", "#f59e0b"],
        borderWidth: 0,
      },
    ],
  };
}

export function buildByHourData(byHour) {
  return {
    labels: Array.from({ length: 24 }, (_, h) => `${h}:00`),
    datasets: [
      {
        data: Array.from({ length: 24 }, (_, h) => byHour?.[h] || 0),
        backgroundColor: "rgba(96,165,250,0.6)",
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  };
}

export function buildDurationByDayData(durationByDay) {
  const labels = Object.keys(durationByDay || {}).sort();
  return {
    labels: labels.map((d) => {
      const date = new Date(d + "T12:00:00");
      return date.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
    }),
    datasets: [
      {
        data: labels.map((d) => durationByDay[d] || 0),
        borderColor: "#f472b6",
        backgroundColor: "rgba(244,114,182,0.15)",
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: "#f472b6",
      },
    ],
  };
}

export function buildByUserData(byUser) {
  return {
    labels: Object.keys(byUser || {}),
    datasets: [
      {
        data: Object.values(byUser || {}),
        backgroundColor: "rgba(167,139,250,0.7)",
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };
}

export function buildCategoriasData(categorias) {
  return {
    labels: categorias.map((c) => c.label),
    datasets: [
      {
        data: categorias.map((c) => c.count),
        backgroundColor: "rgba(212,170,99,0.6)",
        borderColor: "#d4aa63",
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };
}

export function buildIngredientsData(topIngredients) {
  return {
    labels: topIngredients.map((i) => i.name),
    datasets: [
      {
        data: topIngredients.map((i) => i.count),
        backgroundColor: "rgba(52,211,153,0.7)",
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };
}