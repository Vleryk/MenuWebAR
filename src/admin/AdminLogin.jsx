import { useState } from "react";
import { login } from "./api";
import styles from "./admin.module.css";

export default function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      onLogin();
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginPage}>
      <form className={styles.loginForm} onSubmit={handleSubmit}>
        <div className={styles.loginLogo}>🔐</div>
        <h1 className={styles.loginTitle}>Admin Route 66</h1>
        <p className={styles.loginSubtitle}>Gestión del Menú y Archivos</p>

        {error && <div className={styles.errorMsg}>{error}</div>}

        <label className={styles.label}>
          Usuario
          <input
            type="text"
            className={styles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="admin"
            required
            disabled={loading}
            autoFocus
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
            placeholder="Tu contraseña"
            required
            disabled={loading}
          />
        </label>

        <button className={styles.btnPrimary} type="submit" disabled={loading}>
          {loading ? "Ingresando..." : "🔓 Ingresar"}
        </button>

        <p
          style={{
            margin: 0,
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.3)",
            textAlign: "center",
          }}
        >
          ℹ️ Máximo 15 intentos por 15 minutos
        </p>
      </form>
    </div>
  );
}
