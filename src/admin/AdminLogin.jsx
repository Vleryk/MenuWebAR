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
