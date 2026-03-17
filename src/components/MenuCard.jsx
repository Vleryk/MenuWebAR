import { useState } from "react";

function MenuCard({ item }) {
  const [isArOpen, setIsArOpen] = useState(false);

  return (
    <>
      <article className="menu-card">
        <img className="menu-thumb" src={item.image} alt={item.name} />

        <div className="menu-content">
          <h3>{item.name}</h3>
          <p>{item.description}</p>

          <div className="menu-footer">
            <strong>{item.price}</strong>
            <button
              type="button"
              className="btn-ar"
              aria-label={`Ver ${item.name} en AR`}
              title="Ver Modelo AR"
              onClick={() => setIsArOpen(true)}
            >
              <img src="/assets/IMG/copia.png" alt="Icono AR" />
            </button>
          </div>
        </div>
      </article>

      {isArOpen ? (
        <div className="ar-modal-overlay" onClick={() => setIsArOpen(false)}>
          <div className="ar-modal" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="ar-close-btn"
              onClick={() => setIsArOpen(false)}
              aria-label="Cerrar visor AR"
            >
              x
            </button>

            <model-viewer
              src="/assets/modelosAR/plato%20nuevooo.glb"
              ar
              ar-modes="webxr scene-viewer quick-look"
              camera-controls
              auto-rotate
              shadow-intensity="1"
              class="ar-viewer"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

export default MenuCard;
