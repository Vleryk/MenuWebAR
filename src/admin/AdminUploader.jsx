// Componente que sube archivos DIRECTAMENTE a Cloudinary desde el navegador
// (sin pasar por nuestro backend). Esto lo hacemos asi porque Cloudinary tiene
// un sistema de "unsigned upload presets" que permite que clientes publicos
// suban archivos sin necesidad de firmar con la API secret. El secret nunca
// sale del server.
//
// Flujo:
//   1. User elige archivo
//   2. Frontend manda a cloudinary.com/v1_1/xxx/image(o raw)/upload
//   3. Cloudinary devuelve la URL publica
//   4. Frontend llama a nuestro backend para registrar esa URL en Supabase
//
// Cuando se borra, el backend borra de Cloudinary ademas de Supabase (ahi si
// necesita el API secret).

import { useRef, useState, useEffect } from "react";
import { createImagenAsset, createModeloAsset } from "./api";

// Las credenciales de Cloudinary vienen del .env. Los defaults son los del
// proyecto Route 66, dejamos fallback por si el .env no esta cargado bien.
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dxpam0kqa";
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "HublabMenuWebAr";
const CLOUDINARY_UPLOAD_FOLDER = import.meta.env.VITE_CLOUDINARY_UPLOAD_FOLDER || "uploads";
// Los .glb van a una subcarpeta /models para tenerlos separados de las fotos.
const CLOUDINARY_MODELS_FOLDER = `${CLOUDINARY_UPLOAD_FOLDER}/models`;

// Construye un id unico para el asset. Toma el nombre del archivo, lo limpia
// (solo letras/numeros/guiones, minusculas) y le agrega un timestamp en base
// 36 al final para garantizar unicidad aunque se suba el mismo archivo dos
// veces.
function buildAssetId(fileName, prefix) {
  const baseName = fileName.replace(/\.[^/.]+$/, "").toLowerCase();
  const sanitized = baseName
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Date.now().toString(36);
  return `${prefix}_${sanitized || "asset"}_${suffix}`;
}

// Toma "hamburguesa.jpg" y devuelve "hamburguesa" como label legible.
function buildAssetLabel(fileName) {
  return fileName.replace(/\.[^/.]+$/, "").trim() || "Archivo";
}

// Mensaje de error mas claro para el caso mas tipico: el preset no existe.
// Suele pasar cuando se olvidaron de crearlo en el dashboard de Cloudinary.
function handleUploadError(message) {
  if (message.toLowerCase().includes("upload preset not found")) {
    return `Cloudinary no encuentra el preset "${CLOUDINARY_UPLOAD_PRESET}". Crealo como Unsigned en Settings > Upload > Upload presets.`;
  }
  return message;
}

// Funcion core del upload. resourceType es "image" para imagenes o "raw"
// para .glb (Cloudinary trata los 3D como recursos raw porque no son
// manipulables como imagen).
async function uploadToCloudinary(file, resourceType, folder) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
    { method: "POST", body: formData },
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Error al subir archivo a Cloudinary");
  }
  return payload.secure_url;
}

// Hook chico para manejar el preview de imagen con URL.createObjectURL.
// Lo dejo aca arriba porque solo se usa para imagenes (los .glb no se
// pueden previsualizar barato). Es importante revocar la URL en el cleanup
// para no filtrar memoria (son URLs en blob).
function useImagePreview(file) {
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return preview;
}

// Estilos compartidos entre los dos bloques. Antes estaban inline copy-paste
// en cada bloque, los moví aca para que cualquier cambio de paleta se haga
// en un solo lugar.
const styles = {
  pickFileBtn: {
    background: "rgba(255, 255, 255, 0.08)",
    color: "#f7f1e8",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    borderRadius: 8,
    padding: "0.65rem 1rem",
    cursor: "pointer",
    width: "fit-content",
  },
  card: {
    display: "grid",
    gap: "0.75rem",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(212, 170, 99, 0.2)",
    borderRadius: 12,
    padding: "1rem",
  },
  previewWrap: {
    position: "relative",
    display: "inline-block",
    alignSelf: "center",
  },
  imagePreview: {
    maxWidth: 320,
    width: "100%",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.2)",
    display: "block",
  },
  modelPlaceholder: {
    width: 320,
    maxWidth: "100%",
    height: 160,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "linear-gradient(135deg, rgba(212, 170, 99, 0.12), rgba(212, 170, 99, 0.04))",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    color: "#d4aa63",
  },
  removeBtn: (disabled) => ({
    position: "absolute",
    top: -10,
    right: -10,
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "2px solid #0f1724",
    background: "#ff4444",
    color: "#fff",
    fontSize: "1rem",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
    opacity: disabled ? 0.5 : 1,
  }),
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "0.3rem",
    fontSize: "0.8rem",
    color: "rgba(255, 255, 255, 0.6)",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  input: {
    background: "rgba(255, 255, 255, 0.07)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    padding: "0.65rem 0.85rem",
    color: "#d4aa63",
    fontSize: "0.95rem",
    fontFamily: "inherit",
  },
  meta: {
    margin: 0,
    color: "rgba(255,255,255,0.6)",
    fontSize: "0.85rem",
  },
  uploadBtn: (disabled) => ({
    background: "linear-gradient(135deg, #d4aa63, #c49a52)",
    color: "#0f1724",
    border: "none",
    borderRadius: 8,
    padding: "0.65rem 1rem",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  }),
};

// Subcomponente: una "tarjeta" de upload generica. Se reutiliza para imagen
// y para modelo, lo que cambia entre ambos es la config (que se le pasa por
// props) y la zona de preview (slot via children render-prop).
//
// Props:
//   - title, fileLabel, placeholder, pickButtonText, uploadButtonText
//   - acceptAttr: lo que va en accept="" del input file
//   - resourceType: "image" o "raw" para Cloudinary
//   - folder: carpeta destino en Cloudinary
//   - assetIdPrefix: "img" o "mdl", para construir el id del asset
//   - createAsset: createImagenAsset o createModeloAsset
//   - extraValidation: hook opcional para validaciones especificas (ej .glb)
//   - successMessage: mensaje verde cuando termina ok
//   - uploadKind: "image" | "model", se pasa al callback onUploadComplete
//   - onUploadComplete: callback al dashboard
//   - onError: setter del error global del componente padre
//   - renderPreview: funcion que recibe el File y devuelve el preview JSX.
//     Para imagen es un <img>, para modelo es un placeholder con icono.
function AssetUploadCard({
  title,
  fileLabel,
  placeholder,
  pickButtonText,
  uploadButtonText,
  acceptAttr,
  resourceType,
  folder,
  assetIdPrefix,
  createAsset,
  extraValidation,
  successMessage,
  uploadKind,
  onUploadComplete,
  onError,
  renderPreview,
}) {
  // Ref al input file para poder limpiarlo programaticamente despues del
  // upload (sin esto, el input recordaria el ultimo archivo elegido).
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [customName, setCustomName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [resultURL, setResultURL] = useState("");

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    // Pre-llenamos el input del nombre con el nombre del archivo, el user
    // puede editarlo despues si quiere uno mas descriptivo.
    setCustomName(selected ? buildAssetLabel(selected.name) : "");
    setResultURL("");
    onError("");
  };

  const handleRemove = () => {
    setFile(null);
    setCustomName("");
    setResultURL("");
    onError("");
    // Reseteamos el input file para que el user pueda elegir el MISMO archivo
    // de nuevo si quiere (sin esto, onChange no se dispara).
    if (inputRef.current) inputRef.current.value = "";
  };

  // Flujo completo de subir el archivo:
  //   1. Sube a Cloudinary -> recibe URL
  //   2. Registra en BD via nuestro backend
  //   3. Notifica al dashboard para que recargue
  //   4. Limpia el form
  const handleUpload = async () => {
    if (!file) {
      onError(`Selecciona ${fileLabel.toLowerCase()} primero.`);
      return;
    }
    if (!customName.trim()) {
      onError("El nombre no puede estar vacío.");
      return;
    }
    // Validacion especifica del tipo de asset (ej: que sea .glb).
    if (extraValidation) {
      const errMsg = extraValidation(file);
      if (errMsg) {
        onError(errMsg);
        return;
      }
    }
    // Chequea que las env vars esten definidas antes de intentar subir. Si
    // faltan, el mensaje le dice al user que reinicie Vite (porque Vite lee
    // las env vars solo al arrancar).
    const missingVariables = [];
    if (!CLOUDINARY_CLOUD_NAME) missingVariables.push("VITE_CLOUDINARY_CLOUD_NAME");
    if (!CLOUDINARY_UPLOAD_PRESET) missingVariables.push("VITE_CLOUDINARY_UPLOAD_PRESET");
    if (missingVariables.length > 0) {
      onError(
        `Falta configurar: ${missingVariables.join(", ")}. Si acabas de editar .env, reinicia npm run dev.`,
      );
      return;
    }

    setUploading(true);
    onError("");
    setResultURL("");

    try {
      const url = await uploadToCloudinary(file, resourceType, folder);
      const saved = await createAsset({
        id: buildAssetId(customName, assetIdPrefix),
        label: customName.trim(),
        url,
      });

      setResultURL(saved.src || url);
      onUploadComplete?.(saved, uploadKind);

      setFile(null);
      setCustomName("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (uploadError) {
      const message = uploadError?.message || `No se pudo subir ${fileLabel.toLowerCase()}`;
      onError(handleUploadError(message));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <h3 style={{ margin: 0, color: "#f7f1e8", fontSize: "1rem" }}>{title}</h3>

      {/* Input file oculto, se activa via el boton de abajo */}
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {!file && (
        <button type="button" onClick={() => inputRef.current?.click()} style={styles.pickFileBtn}>
          {pickButtonText}
        </button>
      )}

      {file && (
        <div style={styles.card}>
          {/* Zona de preview (imagen real o placeholder para modelos) con
              boton X para descartar. La forma del preview la decide el padre
              via renderPreview. */}
          <div style={styles.previewWrap}>
            {renderPreview(file)}
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              title="Quitar y elegir otro"
              style={styles.removeBtn(uploading)}
            >
              ✕
            </button>
          </div>

          <label style={styles.label}>
            {fileLabel}
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              disabled={uploading}
              placeholder={placeholder}
              style={styles.input}
            />
          </label>

          <p style={styles.meta}>
            Archivo: {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </p>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || !customName.trim()}
              style={styles.uploadBtn(uploading || !customName.trim())}
            >
              {uploading ? "Subiendo..." : uploadButtonText}
            </button>
          </div>
        </div>
      )}

      {resultURL && (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <p style={{ margin: 0, color: "#6ee7a7" }}>{successMessage}</p>
          <a
            href={resultURL}
            target="_blank"
            rel="noreferrer"
            style={{ color: "#7cc7ff", wordBreak: "break-all" }}
          >
            {resultURL}
          </a>
        </div>
      )}
    </div>
  );
}

// Componente preview de imagen aislado: cualquier cambio de file dispara
// useImagePreview y revoca la URL del blob anterior. Se monta y desmonta
// junto con el File, asi React maneja el ciclo de vida solo.
function ImagePreview({ file }) {
  const preview = useImagePreview(file);
  if (!preview) return null;
  return <img src={preview} alt="Vista previa" style={styles.imagePreview} />;
}

// NOTA: todos los estilos estan inline. Fue una decision deliberada porque
// este componente es bastante auto-contenido y no compartia estilos con
// nada mas. Si crece mas vale la pena moverlo a un CSS module.
export default function AdminUploader({ onUploadComplete }) {
  // El error es global (compartido entre los dos bloques) porque hay un solo
  // mensaje de error abajo del componente, no uno por cada bloque.
  const [error, setError] = useState("");

  return (
    <div style={{ display: "grid", gap: "1rem", maxWidth: 720, width: "100%" }}>
      <h2 style={{ margin: 0, color: "#d4aa63" }}>Subir Archivos a Cloudinary</h2>

      {/* ==================== Bloque de IMAGEN ==================== */}
      <AssetUploadCard
        title="Imagen del menú"
        fileLabel="Nombre de la imagen"
        placeholder="Ej: Hamburguesa Clásica"
        pickButtonText="Elegir imagen"
        uploadButtonText="Subir imagen"
        acceptAttr="image/*"
        resourceType="image"
        folder={CLOUDINARY_UPLOAD_FOLDER}
        assetIdPrefix="img"
        createAsset={createImagenAsset}
        successMessage="Imagen subida correctamente."
        uploadKind="image"
        onUploadComplete={onUploadComplete}
        onError={setError}
        renderPreview={(file) => <ImagePreview file={file} />}
      />

      {/* Separador visual entre los dos bloques */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.15)" }} />

      {/* ==================== Bloque de MODELO 3D ==================== */}
      <AssetUploadCard
        title="Modelo AR (.glb)"
        fileLabel="Nombre del modelo"
        placeholder="Ej: Hamburguesa 3D"
        pickButtonText="Elegir modelo .glb"
        uploadButtonText="Subir modelo AR"
        acceptAttr=".glb,model/gltf-binary"
        resourceType="raw"
        folder={CLOUDINARY_MODELS_FOLDER}
        assetIdPrefix="mdl"
        createAsset={createModeloAsset}
        successMessage="Modelo .glb subido correctamente."
        uploadKind="model"
        onUploadComplete={onUploadComplete}
        onError={setError}
        // Cloudinary acepta cualquier archivo como "raw", pero nosotros solo
        // queremos .glb para que el model-viewer los pueda cargar.
        extraValidation={(file) => {
          if (!file.name.toLowerCase().endsWith(".glb")) {
            return "El modelo AR debe tener extensión .glb";
          }
          return null;
        }}
        renderPreview={() => (
          // No hay preview visual del .glb porque seria demasiado caro
          // renderizarlo aca. Mostramos un placeholder con icono.
          <div style={styles.modelPlaceholder}>
            <div style={{ fontSize: "2.5rem" }}>📦</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>Modelo 3D .glb</div>
          </div>
        )}
      />

      <p style={{ margin: 0, color: "rgba(212, 170, 99, 0.8)", fontSize: "0.85rem" }}>
        Acepta solo archivos .glb
      </p>

      {error && <p style={{ margin: 0, color: "#ff6b6b" }}>{error}</p>}
    </div>
  );
}
