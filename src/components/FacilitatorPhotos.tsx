"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

// Facilitador: sube múltiples fotos de los post-its de su mesa (Supabase Storage,
// bucket 'postits') y registra cada una en table_images.
export default function FacilitatorPhotos({
  tableNumber,
  theme,
}: {
  tableNumber: number;
  theme: string | null;
}) {
  const [count, setCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadCount = useCallback(async () => {
    const { count: c } = await supabase
      .from("table_images")
      .select("*", { count: "exact", head: true })
      .eq("table_number", tableNumber);
    setCount(c ?? 0);
  }, [tableNumber]);

  useEffect(() => {
    loadCount();
  }, [loadCount]);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    let failed = 0;
    for (const file of Array.from(files)) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${tableNumber}/${Date.now()}-${Math.round(Math.random() * 1e6)}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("postits")
        .upload(path, file, { upsert: false });
      if (upErr) {
        failed++;
        continue;
      }
      const { error: dbErr } = await supabase
        .from("table_images")
        .insert({ table_number: tableNumber, theme, image_path: path });
      if (dbErr) failed++;
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (failed > 0) {
      setError(
        `No se pudieron subir ${failed} foto(s). Revisa la conexión e intenta de nuevo.`
      );
    }
    await loadCount();
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900">Fotos de los post-its</h2>
      <p className="mt-1 text-sm text-slate-500">
        Sube fotos de todos los post-its de tu mesa (puedes elegir varias a la vez).
      </p>

      <label className="mt-4 flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-6 text-center font-medium text-slate-600 hover:border-blue-400 hover:bg-blue-50">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={(e) => onFiles(e.target.files)}
          disabled={uploading}
          className="hidden"
        />
        {uploading ? "Subiendo…" : "📷 Tomar o elegir fotos"}
      </label>

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      <p className="mt-3 text-sm text-slate-600">
        Fotos subidas de la Mesa {tableNumber}: <b>{count}</b>
      </p>
    </div>
  );
}
