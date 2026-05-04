import styles from "./IngredientsModal.module.css";
import { Modal } from "./Modal";

export const IngredientsModal = ({ isOpen, close, item }) => {
  return (
    <Modal isOpen={isOpen} close={close} title="Ingredientes">
      {item.ingredients && item.ingredients.length > 0 ? (
        <ul className={styles.ingredientsList}>
          {item.ingredients.map((ingredient, index) => (
            <li key={index} className={styles.ingredientItem}>
              <span className={styles.ingredientBullet}>•</span>
              {ingredient}
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.noIngredientsMessage}>
          <p>No hemos actualizado los ingredientes</p>
        </div>
      )}
    </Modal>
  );
};
