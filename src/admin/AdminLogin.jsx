// Pantalla de login del admin. Se muestra cuando AdminDashboard detecta que
// no hay token valido. Si el login es exitoso, llama onLogin() y el padre
// monta el dashboard.
//
// El backend tiene rate limiting agresivo aca: solo permite 15 intentos cada
// 15 min por IP, asi que cuidado al testear.

import { useState } from "react";
import { login } from "./api";
import styles from "./admin.module.css";

export default function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  // loading deshabilita el boton mientras la peticion esta en vuelo, asi
  // evitamos doble click que dispararia dos requests.
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // login() guarda el token en localStorage si todo sale bien (esa
      // logica vive en api.js).
      await login(username, password);
      onLogin();
    } catch (err) {
      // Los errores tipicos son: credenciales malas o rate limit alcanzado.
      // El mensaje viene del backend, lo mostramos tal cual.
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginPage}>
      <form className={styles.loginForm} onSubmit={handleSubmit}>
        <div className={styles.loginLogo}>🔐</div>
        <h1 className={styles.loginTitle}>Admin Panel</h1>
        <p className={styles.loginSubtitle}>Route 66 — Gestión del Menú</p>

        {error && <div className={styles.errorMsg}>{error}</div>}

        <label className={styles.label}>
          Usuario
          {/* autoComplete="username" ayuda a los password managers a guardar
              correctamente las credenciales. */}
          <input
            type="text"
            className={styles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className={styles.label}>
          Contraseña
          <input
            type="password"
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <button className={styles.btnPrimary} type="submit" disabled={loading}>
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
