import type { LocalKnowledgeExtension } from "./types";

export const MAX_OFFICE_DOCUMENT_BYTES = 20 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 128_000;
export const MAX_PDF_INDEX_PAGES = 20;

type DocumentReadOptions = { indexOnly?: boolean; signal?: AbortSignal };

export async function extractLocalDocumentText(file: File, extension: LocalKnowledgeExtension, options: DocumentReadOptions = {}) {
  options.signal?.throwIfAborted();
  if (extension === "md" || extension === "txt") {
    return file.text();
  }
  if (file.size > MAX_OFFICE_DOCUMENT_BYTES) {
    throw new Error(`“${file.name}”超过 20 MB，请先压缩或拆分后再读取。`);
  }
  const arrayBuffer = await file.arrayBuffer();
  options.signal?.throwIfAborted();
  return extension === "pdf"
    ? extractPdfText(arrayBuffer, options)
    : extractDocxText(arrayBuffer);
}

export async function extractPdfText(arrayBuffer: ArrayBuffer, options: DocumentReadOptions = {}) {
  const pdfjs = typeof window === "undefined"
    ? await import("pdfjs-dist/legacy/build/pdf.mjs")
    : await import("pdfjs-dist");
  if (typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  options.signal?.throwIfAborted();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer), useSystemFonts: true });
  const abort = () => { void loadingTask.destroy().catch(() => {}); };
  options.signal?.addEventListener("abort", abort, { once: true });
  const pages: string[] = [];
  let length = 0;
  try {
    const document = await loadingTask.promise;
    const pageLimit = options.indexOnly ? Math.min(document.numPages, MAX_PDF_INDEX_PAGES) : document.numPages;
    const characterLimit = options.indexOnly ? 12_000 : MAX_EXTRACTED_CHARACTERS;
    for (let pageNumber = 1; pageNumber <= pageLimit && length < characterLimit; pageNumber += 1) {
      options.signal?.throwIfAborted();
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
    options.signal?.removeEventListener("abort", abort);
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
