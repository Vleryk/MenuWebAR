import { useRef, useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../config/firebase";

export default function ImageUploader({ onUploadComplete }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [downloadURL, setDownloadURL] = useState(null);
  const [error, setError] = useState(null);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setDownloadURL(null);

    try {
      const timestamp = Date.now();
      const storageRef = ref(storage, `uploads/${timestamp}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      setDownloadURL(url);
      onUploadComplete?.(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        disabled={uploading}
      />
      <button onClick={handleUpload} disabled={uploading}>
        {uploading ? "Subiendo…" : "Subir imagen"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {downloadURL && (
        <div>
          <p style={{ wordBreak: "break-all" }}>{downloadURL}</p>
          <img
            src={downloadURL}
            alt="Preview"
            style={{ maxWidth: 200, borderRadius: 8 }}
          />
        </div>
      )}
    </div>
  );
}
