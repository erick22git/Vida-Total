/**
 * Redimensiona una foto elegida de la galería (o tomada con <input capture>) antes de guardarla —
 * tal cual ya hacía el escáner con los frames de la cámara (vía canvas), pero esos frames ya salían
 * acotados por la resolución del `<video>`; una foto de la galería puede llegar a varios MB (12+ MP)
 * sin pasar por ningún límite, y eso es lo que termina llenando el localStorage del store (persist)
 * de a poco hasta que una escritura falla en silencio y la foto "no se guarda" al volver a entrar.
 */
export function resizeImageFile(file: File, maxSide = 1024, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.onload = () => {
      if (typeof reader.result !== "string") return reject(new Error("Lectura inválida"));
      const img = new Image();
      img.onerror = () => reject(new Error("No se pudo decodificar la imagen"));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Sin contexto 2D"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
