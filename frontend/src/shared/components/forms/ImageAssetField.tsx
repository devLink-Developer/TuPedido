import { useId, useRef, useState, type CSSProperties } from "react";
import { uploadImageAsset } from "../../services/api";
import { Button } from "../../ui/Button";

export function ImageAssetField({
  label,
  value,
  onChange,
  folder,
  placeholder = "https://...",
  description,
  previewClassName = "h-40 w-full object-cover",
  previewWrapperStyle,
  emptyLabel = "Sin imagen cargada"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  folder: string;
  placeholder?: string;
  description?: string;
  previewClassName?: string;
  previewWrapperStyle?: CSSProperties;
  emptyLabel?: string;
}) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadImageAsset(file, folder);
      onChange(uploaded.url);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo subir la imagen");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-semibold text-ink">
          {label}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
          />
          <Button type="button" className="px-3 py-2 text-xs" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? "Subiendo..." : "Cargar desde dispositivo"}
          </Button>
        </div>
      </div>

      <input
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3"
      />

      {description ? <p className="text-sm text-zinc-500">{description}</p> : null}

      <div className="w-full overflow-hidden rounded-[24px] border border-black/5 bg-zinc-50" style={previewWrapperStyle}>
        {value ? (
          <img src={value} alt={label} className={previewClassName} />
        ) : (
          <div className={`flex items-center justify-center px-4 text-sm text-zinc-400 ${previewWrapperStyle ? "h-full min-h-[10rem]" : "h-40"}`}>
            {emptyLabel}
          </div>
        )}
      </div>

      {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
