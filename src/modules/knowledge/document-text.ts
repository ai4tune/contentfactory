import type { LocalKnowledgeExtension } from "./types";

export const MAX_OFFICE_DOCUMENT_BYTES = 20 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 128_000;
export const MAX_PDF_INDEX_PAGES = 20;

type DocumentReadOptions = { indexOnly?: boolean; signal?: AbortSignal; onProgress?: (message: string) => void };

export async function extractLocalDocumentText(file: File, extension: LocalKnowledgeExtension, options: DocumentReadOptions = {}) {
  options.signal?.throwIfAborted();
  if (extension === "md" || extension === "txt") {
    return file.text();
  }
  if (file.size > MAX_OFFICE_DOCUMENT_BYTES) {
    throw new Error(`“${file.name}”超过 20 MB，请先压缩或拆分后再读取。`);
  }
  if (extension !== "pdf" && extension !== "docx") {
    if (options.indexOnly) return "";
    options.onProgress?.(`正在识别图片：${file.name}…`);
    const { readImageFile } = await import("./visual-document");
    return readImageFile(file, options.signal);
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
      } else if (!options.indexOnly && typeof window !== "undefined") {
        const operators = await page.getOperatorList();
        if (!operators.fnArray.length) continue;
        if (document.numPages > MAX_PDF_INDEX_PAGES) throw new Error(`扫描或混合 PDF 最多读取 ${MAX_PDF_INDEX_PAGES} 页，请先拆分后再读取。`);
        options.onProgress?.(`正在识别 PDF 第 ${pageNumber}/${document.numPages} 页…`);
        const { canvasImage, recognizeImage } = await import("./visual-document");
        const viewport = page.getViewport({ scale: 1 });
        const scaled = page.getViewport({ scale: Math.min(2, 1600 / Math.max(viewport.width, viewport.height)) });
        const canvas = window.document.createElement("canvas");
        canvas.width = Math.ceil(scaled.width);
        canvas.height = Math.ceil(scaled.height);
        const context = canvas.getContext("2d")!;
        await page.render({ canvasContext: context, canvas, viewport: scaled }).promise;
        const recognized = await recognizeImage(canvasImage(canvas), options.signal);
        pages.push(`[第 ${pageNumber} 页图片识别，待人工核对]\n${recognized}`);
        length += recognized.length;
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
