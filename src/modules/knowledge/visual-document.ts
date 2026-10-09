export function canvasImage(canvas: HTMLCanvasElement) {
  const image = canvas.toDataURL("image/jpeg", 0.8);
  if (image.length > 1_400_000) throw new Error("图片压缩后仍过大，请裁剪或缩小后重试。");
  return image;
}

export async function recognizeImage(image: string, signal?: AbortSignal) {
  const response = await fetch("/api/knowledge/recognize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(100_000)]) : AbortSignal.timeout(100_000),
  });
  const payload = await response.json() as { text?: string; error?: string };
  if (!response.ok || !payload.text?.trim()) throw new Error(payload.error ?? "图片识别失败，请稍后重试。");
  return payload.text;
}

export async function readImageFile(file: File, signal?: AbortSignal) {
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error(`无法打开“${file.name}”，请转换为 JPG、PNG 或 WebP 后再读取。`); }
  try {
    signal?.throwIfAborted();
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d")!;
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await recognizeImage(canvasImage(canvas), signal);
  } finally { bitmap.close(); }
}
