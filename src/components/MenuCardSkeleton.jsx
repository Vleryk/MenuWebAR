import styles from "./MenuCardSkeleton.module.css";

function MenuCardSkeleton() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <div className={styles.skeletonImage} />
      <div className={styles.skeletonContent}>
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonText} />
        <div className={styles.skeletonText} style={{ width: "60%" }} />
        <div className={styles.skeletonFooter}>
          <div className={styles.skeletonPrice} />
          <div className={styles.skeletonActions} />
        </div>
      </div>
    </div>
  );
}

export function MenuSkeleton({ count = 6 }) {
  return (
    <div className={styles.skeletonGrid}>
      {Array.from({ length: count }, (_, i) => (
        <MenuCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default MenuCardSkeleton;
