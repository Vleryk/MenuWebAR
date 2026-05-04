import { Modal } from "../components/Modal";
import { ACTION_STYLES, ENTITY_ICONS } from "../utils/constants";
import { formatDate } from "../utils/dateUtils";
import styles from "./LogsPanel.module.css";

export function LogDetailsContent({ log }) {
  if (!log) return null;

  const details = log.details
    ? typeof log.details === "string"
      ? JSON.parse(log.details)
      : log.details
    : {};

  return (
    <div className={styles.logDetailsContent}>
      <div className={styles.logDetailsSection}>
        <h4>Información General</h4>
        <div className={styles.logDetailsGrid}>
          <div className={styles.logDetailsRow}>
            <span className={styles.logDetailsLabel}>ID</span>
            <span className={styles.logDetailsValue}>{log.id}</span>
          </div>
          <div className={styles.logDetailsRow}>
            <span className={styles.logDetailsLabel}>Fecha</span>
            <span className={styles.logDetailsValue}>{formatDate(log.created_at)}</span>
          </div>
          <div className={styles.logDetailsRow}>
            <span className={styles.logDetailsLabel}>Usuario</span>
            <span className={styles.logDetailsValue}>{log.username}</span>
          </div>
          <div className={styles.logDetailsRow}>
            <span className={styles.logDetailsLabel}>Acción</span>
            <span
              className={styles.logDetailsBadge}
              style={{
                background: ACTION_STYLES[log.action]?.bg,
                color: ACTION_STYLES[log.action]?.color,
              }}
            >
              {log.action}
            </span>
          </div>
          <div className={styles.logDetailsRow}>
            <span className={styles.logDetailsLabel}>Entidad</span>
            <span className={styles.logDetailsValue}>
              {ENTITY_ICONS[log.entity_type]} {log.entity_label || log.entity_type}
            </span>
          </div>
          <div className={styles.logDetailsRow}>
            <span className={styles.logDetailsLabel}>ID Entidad</span>
            <span className={styles.logDetailsValue}>{log.entity_id || "-"}</span>
          </div>
        </div>
      </div>

      <div className={styles.logDetailsSection}>
        <h4>Request</h4>
        <div className={styles.logDetailsGrid}>
          <div className={styles.logDetailsRow}>
            <span className={styles.logDetailsLabel}>Método</span>
            <span className={styles.logDetailsValue}>{log.method}</span>
          </div>
          <div className={styles.logDetailsRow}>
            <span className={styles.logDetailsLabel}>Path</span>
            <span className={styles.logDetailsValue}>{log.path}</span>
          </div>
          <div className={styles.logDetailsRow}>
            <span className={styles.logDetailsLabel}>IP</span>
            <span className={styles.logDetailsValue}>{log.ip}</span>
          </div>
          <div className={styles.logDetailsRow}>
            <span className={styles.logDetailsLabel}>Duración</span>
            <span className={styles.logDetailsValue}>{log.duration ? `${log.duration}ms` : "-"}</span>
          </div>
        </div>
      </div>

      {details.statusCode && (
        <div className={styles.logDetailsSection}>
          <h4>Estado</h4>
          <div className={styles.logDetailsGrid}>
            <div className={styles.logDetailsRow}>
              <span className={styles.logDetailsLabel}>Status Code</span>
              <span className={styles.logDetailsValue}>{details.statusCode}</span>
            </div>
          </div>
        </div>
      )}

      {details.response && (
        <div className={styles.logDetailsSection}>
          <h4>Response</h4>
          <pre className={styles.logDetailsPre}>{JSON.stringify(details.response, null, 2)}</pre>
        </div>
      )}

      {log.user_agent && (
        <div className={styles.logDetailsSection}>
          <h4>User Agent</h4>
          <div className={styles.logDetailsUserAgent}>{log.user_agent}</div>
        </div>
      )}
    </div>
  );
}