// Componente que sube archivos DIRECTAMENTE a Cloudinary desde el navegador
// (sin pasar por nuestro backend). Cloudinary tiene un sistema de "unsigned
// upload presets" que permite que clientes publicos suban archivos sin
// necesidad de firmar con la API secret. El secret nunca sale del server.
//
// Flujo:
//   1. User elige archivo
//   2. Frontend manda a cloudinary.com/v1_1/xxx/image(o raw)/upload
//   3. Cloudinary devuelve la URL publica
//   4. Frontend llama a nuestro backend para registrar esa URL en Supabase

import { useRef, useState, useEffect } from "react";
import { createImagenAsset, createModeloAsset } from "./api";

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dxpam0kqa";
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "HublabMenuWebAr";
const CLOUDINARY_UPLOAD_FOLDER = import.meta.env.VITE_CLOUDINARY_UPLOAD_FOLDER || "uploads";
const CLOUDINARY_MODELS_FOLDER = `${CLOUDINARY_UPLOAD_FOLDER}/models`;

// =====================================================
// HELPERS
// =====================================================

function buildAssetId(fileName, prefix) {
  const baseName = fileName.replace(/\.[^/.]+$/, "").toLowerCase();
  const sanitized = baseName
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Date.now().toString(36);
  return `${prefix}_${sanitized || "asset"}_${suffix}`;
}

function buildAssetLabel(fileName) {
  return fileName.replace(/\.[^/.]+$/, "").trim() || "Archivo";
}

function formatUploadError(message) {
  if (message.toLowerCase().includes("upload preset not found")) {
    return `Cloudinary no encuentra el preset "${CLOUDINARY_UPLOAD_PRESET}". Crealo como Unsigned en Settings > Upload > Upload presets.`;
  }
  return message;
}

function ensureCloudinaryConfig() {
  const missing = [];
  if (!CLOUDINARY_CLOUD_NAME) missing.push("VITE_CLOUDINARY_CLOUD_NAME");
  if (!CLOUDINARY_UPLOAD_PRESET) missing.push("VITE_CLOUDINARY_UPLOAD_PRESET");
  if (missing.length === 0) return null;
  return `Falta configurar: ${missing.join(", ")}. Si acabas de editar .env, reinicia npm run dev.`;
}

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

// =====================================================
// ESTILOS COMPARTIDOS
// =====================================================
// Centralizados para evitar el copy-paste inline que tenia el componente original.

const styles = {
  card: {
    display: "grid",
    gap: "0.75rem",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(212, 170, 99, 0.2)",
    borderRadius: 12,
    padding: "1rem",
  },
  chooseBtn: {
    background: "rgba(255, 255, 255, 0.08)",
    color: "#f7f1e8",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    borderRadius: 8,
    padding: "0.65rem 1rem",
    cursor: "pointer",
    width: "fit-content",
  },
  removeBtn: {
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
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
  },
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
  uploadBtn: {
    background: "linear-gradient(135deg, #d4aa63, #c49a52)",
    color: "#0f1724",
    border: "none",
    borderRadius: 8,
    padding: "0.65rem 1rem",
    fontWeight: 700,
  },
  meta: { margin: 0, color: "rgba(255,255,255,0.6)", fontSize: "0.85rem" },
};

// =====================================================
// HOOK: maneja el preview de imagen con createObjectURL/revokeObjectURL
// =====================================================
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

// =====================================================
// SUBCOMPONENTE: card de upload generica
// =====================================================
// Recibe por props todo lo que diferencia imagen de modelo:
//   - title, acceptAttr, chooseLabel, uploadLabel
//   - resourceType ("image" | "raw"), folder
//   - createAsset (createImagenAsset | createModeloAsset)
//   - renderPreview (la imagen renderea <img>, el modelo un placeholder)
//   - extraValidation (modelo valida extension .glb)
//   - assetType ("image" | "model") para el callback onUploadComplete
//   - successLabel ("Imagen" | "Modelo .glb")
function AssetUploadCard({
  title,
  acceptAttr,
  chooseLabel,
  uploadLabel,
  successLabel,
  inputLabel,
  inputPlaceholder,
  resourceType,
  folder,
  createAsset,
  idPrefix,
  renderPreview,
  extraValidation,
  assetType,
  onUploadComplete,
  onError,
  helperText,
}) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [customName, setCustomName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [resultURL, setResultURL] = useState("");

  const handleFileChange = (event) => {
    const f = event.target.files?.[0] || null;
    setFile(f);
    setCustomName(f ? buildAssetLabel(f.name) : "");
    setResultURL("");
    onError("");
  };

  const handleRemove = () => {
    setFile(null);
    setCustomName("");
    setResultURL("");
    onError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!file) {
      onError(`Selecciona ${chooseLabel.toLowerCase()} primero.`);
      return;
    }
    if (extraValidation) {
      const validationError = extraValidation(file);
      if (validationError) {
        onError(validationError);
        return;
      }
    }
    if (!customName.trim()) {
      onError("El nombre no puede estar vacío.");
      return;
    }
    const cfgError = ensureCloudinaryConfig();
    if (cfgError) {
      onError(cfgError);
      return;
    }

    setUploading(true);
    onError("");
    setResultURL("");

    try {
      const url = await uploadToCloudinary(file, resourceType, folder);
      const saved = await createAsset({
        id: buildAssetId(customName, idPrefix),
        label: customName.trim(),
        url,
      });

      setResultURL(saved.src || url);
      onUploadComplete?.(saved, assetType);

      setFile(null);
      setCustomName("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (uploadError) {
      onError(formatUploadError(uploadError?.message || "No se pudo subir el archivo"));
    } finally {
      setUploading(false);
    }
  };

  const canUpload = !uploading && customName.trim();

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <h3 style={{ margin: 0, color: "#f7f1e8", fontSize: "1rem" }}>{title}</h3>

      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {!file && (
        <button type="button" onClick={() => inputRef.current?.click()} style={styles.chooseBtn}>
          {chooseLabel}
        </button>
      )}

      {file && (
        <div style={styles.card}>
          <div style={{ position: "relative", display: "inline-block", alignSelf: "center" }}>
            {renderPreview(file)}
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              title="Quitar archivo y elegir otro"
              style={{
                ...styles.removeBtn,
                cursor: uploading ? "not-allowed" : "pointer",
                opacity: uploading ? 0.5 : 1,
              }}
            >
              ✕
            </button>
          </div>

          <label style={styles.label}>
            {inputLabel}
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              disabled={uploading}
              placeholder={inputPlaceholder}
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
              disabled={!canUpload}
              style={{
                ...styles.uploadBtn,
                cursor: canUpload ? "pointer" : "not-allowed",
                opacity: canUpload ? 1 : 0.6,
              }}
            >
              {uploading ? "Subiendo..." : uploadLabel}
            </button>
          </div>
        </div>
      )}

      {helperText && (
        <p style={{ margin: 0, color: "rgba(212, 170, 99, 0.8)", fontSize: "0.85rem" }}>
          {helperText}
        </p>
      )}

      {resultURL && (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <p style={{ margin: 0, color: "#6ee7a7" }}>{successLabel} subido correctamente.</p>
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

// =====================================================
// PREVIEWS
// =====================================================

function ImagePreview({ file }) {
  const preview = useImagePreview(file);
  if (!preview) return null;
  return (
    <img
      src={preview}
      alt="Vista previa"
      style={{
        maxWidth: 320,
        width: "100%",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.2)",
        display: "block",
      }}
    />
  );
}

function ModelPreview() {
  return (
    <div
      style={{
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
      }}
    >
      <div style={{ fontSize: "2.5rem" }}>📦</div>
      <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>Modelo 3D .glb</div>
    </div>
  );
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export default function AdminUploader({ onUploadComplete }) {
  const [error, setError] = useState("");

  // Genera el preview de la imagen con URL.createObjectURL. Es importante
  // revocarla en el cleanup para no filtrar memoria (son URLs en blob).
  useEffect(() => {
    if (!imageFile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImagePreview("");
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // Mensaje de error mas claro para el caso mas tipico: el preset no existe.
  // Suele pasar cuando se olvidaron de crearlo en el dashboard de Cloudinary.
  const handleUploadError = (message) => {
    if (message.toLowerCase().includes("upload preset not found")) {
      return `Cloudinary no encuentra el preset "${CLOUDINARY_UPLOAD_PRESET}". Crealo como Unsigned en Settings > Upload > Upload presets.`;
    }
    return message;
  };

  // Chequea que las env vars esten definidas antes de intentar subir. Si
  // faltan, el mensaje le dice al user que reinicie Vite (porque Vite lee las
  // env vars solo al arrancar).
  const ensureCloudinaryConfig = () => {
    const missingVariables = [];
    if (!CLOUDINARY_CLOUD_NAME) missingVariables.push("VITE_CLOUDINARY_CLOUD_NAME");
    if (!CLOUDINARY_UPLOAD_PRESET) missingVariables.push("VITE_CLOUDINARY_UPLOAD_PRESET");

    if (missingVariables.length > 0) {
      setError(
        `Falta configurar: ${missingVariables.join(", ")}. Si acabas de editar .env, reinicia npm run dev.`,
      );
      return false;
    }
    return true;
  };

  // Funcion core del upload. resourceType es "image" para imagenes o "raw"
  // para .glb (Cloudinary trata los 3D como recursos raw porque no son
  // manipulables como imagen).
  const uploadToCloudinary = async (file, resourceType, folder) => {
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
  };

  const handleImageFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setImageFile(file);
    // Pre-llenamos el input del nombre con el nombre del archivo, el user
    // puede editarlo despues si quiere uno mas descriptivo.
    setCustomImageName(file ? buildAssetLabel(file.name) : "");
    setImageURL("");
    setError("");
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setCustomImageName("");
    setImageURL("");
    setError("");
    // Reseteamos el input file para que el user pueda elegir el MISMO archivo
    // de nuevo si quiere (sin esto, onChange no se dispara).
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleModelFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setModelFile(file);
    setCustomModelName(file ? buildAssetLabel(file.name) : "");
    setModelURL("");
    setError("");
  };

  const handleRemoveModel = () => {
    setModelFile(null);
    setCustomModelName("");
    setModelURL("");
    setError("");
    if (modelInputRef.current) modelInputRef.current.value = "";
  };

  // Flujo completo de subir imagen:
  //   1. Sube a Cloudinary -> recibe URL
  //   2. Registra en BD via nuestro backend
  //   3. Notifica al dashboard para que recargue
  //   4. Limpia el form
  const handleImageUpload = async () => {
    if (!imageFile) {
      setError("Selecciona una imagen primero.");
      return;
    }
    if (!customImageName.trim()) {
      setError("El nombre de la imagen no puede estar vacío.");
      return;
    }
    if (!ensureCloudinaryConfig()) return;

    setImageUploading(true);
    setError("");
    setImageURL("");

    try {
      const url = await uploadToCloudinary(imageFile, "image", CLOUDINARY_UPLOAD_FOLDER);
      const savedImage = await createImagenAsset({
        id: buildAssetId(customImageName, "img"),
        label: customImageName.trim(),
        url,
      });

      setImageURL(savedImage.src || url);
      onUploadComplete?.(savedImage, "image");

      setImageFile(null);
      setCustomImageName("");
      if (imageInputRef.current) imageInputRef.current.value = "";
    } catch (uploadError) {
      const message = uploadError?.message || "No se pudo subir la imagen";
      setError(handleUploadError(message));
    } finally {
      setImageUploading(false);
    }
  };

  // Mismo flujo que la imagen pero con validacion extra de extension .glb.
  const handleModelUpload = async () => {
    if (!modelFile) {
      setError("Selecciona un modelo .glb primero.");
      return;
    }
    // Cloudinary acepta cualquier archivo como "raw", pero nosotros solo
    // queremos .glb para que el model-viewer los pueda cargar.
    if (!modelFile.name.toLowerCase().endsWith(".glb")) {
      setError("El modelo AR debe tener extensión .glb");
      return;
    }
    if (!customModelName.trim()) {
      setError("El nombre del modelo no puede estar vacío.");
      return;
    }
    if (!ensureCloudinaryConfig()) return;

    setModelUploading(true);
    setError("");
    setModelURL("");

    try {
      const url = await uploadToCloudinary(modelFile, "raw", CLOUDINARY_MODELS_FOLDER);
      const savedModel = await createModeloAsset({
        id: buildAssetId(customModelName, "mdl"),
        label: customModelName.trim(),
        url,
      });

      setModelURL(savedModel.src || url);
      onUploadComplete?.(savedModel, "model");

      setModelFile(null);
      setCustomModelName("");
      if (modelInputRef.current) modelInputRef.current.value = "";
    } catch (uploadError) {
      const message = uploadError?.message || "No se pudo subir el modelo .glb";
      setError(handleUploadError(message));
    } finally {
      setModelUploading(false);
    }
  };

  // NOTA: todos los estilos estan inline. Fue una decision deliberada porque
  // este componente es bastante auto-contenido y no compartia estilos con
  // nada mas. Si crece mas vale la pena moverlo a un CSS module.
  return (
    <div style={{ display: "grid", gap: "1rem", maxWidth: 720, width: "100%" }}>
      <h2 style={{ margin: 0, color: "#d4aa63" }}>Subir Archivos a Cloudinary</h2>

      <AssetUploadCard
        title="Imagen del menú"
        acceptAttr="image/*"
        chooseLabel="Elegir imagen"
        uploadLabel="Subir imagen"
        successLabel="Imagen"
        inputLabel="Nombre de la imagen"
        inputPlaceholder="Ej: Hamburguesa Clásica"
        resourceType="image"
        folder={CLOUDINARY_UPLOAD_FOLDER}
        createAsset={createImagenAsset}
        idPrefix="img"
        assetType="image"
        renderPreview={(file) => <ImagePreview file={file} />}
        onUploadComplete={onUploadComplete}
        onError={setError}
      />

      <div style={{ height: 1, background: "rgba(255,255,255,0.15)" }} />

      <AssetUploadCard
        title="Modelo AR (.glb)"
        acceptAttr=".glb,model/gltf-binary"
        chooseLabel="Elegir modelo .glb"
        uploadLabel="Subir modelo AR"
        successLabel="Modelo .glb"
        inputLabel="Nombre del modelo"
        inputPlaceholder="Ej: Hamburguesa 3D"
        resourceType="raw"
        folder={CLOUDINARY_MODELS_FOLDER}
        createAsset={createModeloAsset}
        idPrefix="mdl"
        assetType="model"
        renderPreview={() => <ModelPreview />}
        extraValidation={(file) =>
          !file.name.toLowerCase().endsWith(".glb")
            ? "El modelo AR debe tener extensión .glb"
            : null
        }
        helperText="Acepta solo archivos .glb"
        onUploadComplete={onUploadComplete}
        onError={setError}
      />

      {error && <p style={{ margin: 0, color: "#ff6b6b" }}>{error}</p>}
    </div>
  );
}
