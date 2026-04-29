import styles from "../menuCard.module.css";

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.cameraIcon}>
      <path d="M9 4.5a1 1 0 0 0-.8.4l-1 1.3H5A3 3 0 0 0 2 9.2v7.3a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V9.2a3 3 0 0 0-3-3h-2.2l-1-1.3a1 1 0 0 0-.8-.4H9Zm3 4a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6Zm0 1.9a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8Z" />
    </svg>
  );
}

export { CameraIcon };
