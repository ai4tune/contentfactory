import type { LocalKnowledgeExtension } from "./types";

export const MAX_OFFICE_DOCUMENT_BYTES = 20 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 128_000;

export async function extractLocalDocumentText(file: File, extension: LocalKnowledgeExtension) {
  if (extension === "md" || extension === "txt") {
    return file.text();
  }
  if (file.size > MAX_OFFICE_DOCUMENT_BYTES) {
    throw new Error(`“${file.name}”超过 20 MB，请先压缩或拆分后再读取。`);
  }
  const arrayBuffer = await file.arrayBuffer();
  return extension === "pdf"
    ? extractPdfText(arrayBuffer)
    : extractDocxText(arrayBuffer);
}

export async function extractPdfText(arrayBuffer: ArrayBuffer) {
  const pdfjs = typeof window === "undefined"
    ? await import("pdfjs-dist/legacy/build/pdf.mjs")
    : await import("pdfjs-dist");
  if (typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer), useSystemFonts: true });
  const document = await loadingTask.promise;
  const pages: string[] = [];
  let length = 0;
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages && length < MAX_EXTRACTED_CHARACTERS; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .flatMap((item) => "str" in item ? [item.str] : [])
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) {
        pages.push(text);
        length += text.length;
      }
    }
  } finally {
    await loadingTask.destroy();
  }
  return pages.join("\n\n").slice(0, MAX_EXTRACTED_CHARACTERS);
}

export async function extractDocxText(arrayBuffer: ArrayBuffer) {
  const mammoth = (await import("mammoth")).default;
  const input = typeof window === "undefined"
    ? { buffer: Buffer.from(arrayBuffer) }
    : { arrayBuffer };
  const result = await mammoth.extractRawText(input);
  return result.value.slice(0, MAX_EXTRACTED_CHARACTERS);
}
