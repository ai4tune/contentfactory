import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import {
  classifyKnowledgeFile,
  recommendKnowledgeItems,
  shouldIgnoreKnowledgeDirectory,
} from "../modules/knowledge/file-classification.ts";
import {
  extractDocxText,
  extractPdfText,
} from "../modules/knowledge/document-text.ts";

test("knowledge files are grouped by user-facing purpose", () => {
  assert.equal(classifyKnowledgeFile("md"), "text");
  assert.equal(classifyKnowledgeFile("pdf"), "office");
  assert.equal(classifyKnowledgeFile("docx"), "office");
  assert.equal(classifyKnowledgeFile("jpg"), "image");
  assert.equal(classifyKnowledgeFile("log"), "ignored");
  assert.equal(shouldIgnoreKnowledgeDirectory("node_modules"), true);
  assert.equal(shouldIgnoreKnowledgeDirectory(".git"), true);
  assert.equal(shouldIgnoreKnowledgeDirectory("客户案例"), false);
});

test("recommended sources prefer business material and stay within the AI batch", () => {
  const items = Array.from({ length: 35 }, (_, index) => knowledgeItem({
    id: `local:note-${index}.md`,
    title: `普通记录 ${index}`,
    path: `记录/note-${index}.md`,
    lastModified: 35 - index,
  }));
  items.push(knowledgeItem({
    id: "local:品牌介绍.docx",
    title: "品牌介绍",
    path: "企业资料/品牌介绍.docx",
    extension: "docx",
    lastModified: 1,
  }));

  const recommended = recommendKnowledgeItems(items);
  assert.equal(recommended.length, 30);
  assert.equal(recommended[0].id, "local:品牌介绍.docx");
});

test("PDF and Word documents expose text without uploading the original file", async () => {
  const pdfText = await extractPdfText(arrayBuffer(minimalPdf("Hello PDF")));
  assert.match(pdfText, /Hello PDF/);

  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<?xml version=\"1.0\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>");
  zip.file("_rels/.rels", "<?xml version=\"1.0\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>");
  zip.file("word/document.xml", "<?xml version=\"1.0\"?><w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p><w:r><w:t>Hello Word</w:t></w:r></w:p></w:body></w:document>");
  const docx = await zip.generateAsync({ type: "arraybuffer" });
  assert.match(await extractDocxText(docx), /Hello Word/);
});

function knowledgeItem(overrides) {
  return {
    id: "local:item.md",
    title: "资料",
    path: "资料/item.md",
    extension: "md",
    size: 1,
    lastModified: 1,
    tags: [],
    excerpt: "",
    searchText: "有效正文",
    indexedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

function minimalPdf(text) {
  const content = `BT /F1 24 Tf 100 700 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body);
}

function arrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}
