// 只排版正文，不执行原始 HTML；未支持的 Markdown 保留为可读文本。
export function renderWechatBodyHtml(markdown: string) {
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let items: string[] = [];
  let listType = "ul";
  let inCode = false;
  const flushParagraph = () => {
    if (paragraph.length) blocks.push(`<p style="margin:0 0 20px;line-height:1.85;font-size:16px;color:#333;">${paragraph.map(inline).join("<br>")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (items.length) blocks.push(`<${listType} style="padding-left:24px;margin:0 0 20px;line-height:1.85;font-size:16px;color:#333;">${items.map((item) => `<li style="margin-bottom:8px;">${inline(item)}</li>`).join("")}</${listType}>`);
    items = [];
  };
  for (const line of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    if (/^\s*```/.test(line)) { inCode = !inCode; flushList(); flushParagraph(); continue; }
    if (inCode) { flushList(); blocks.push(`<p style="font-family:monospace;white-space:pre-wrap;">${escapeHtml(line)}</p>`); continue; }
    if (!line.trim()) { flushList(); flushParagraph(); continue; }
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    const item = line.match(/^\s*(?:[-*+]\s+|\d+[.)、]\s+)(.+)$/);
    if (heading) {
      flushList(); flushParagraph();
      blocks.push(`<h2 style="margin:28px 0 16px;font-size:20px;line-height:1.5;color:#173e32;font-weight:700;">${inline(heading[1])}</h2>`);
    } else if (item) {
      flushParagraph(); const nextType = /^\s*\d/.test(line) ? "ol" : "ul";
      if (items.length && listType !== nextType) flushList();
      listType = nextType; items.push(item[1]);
    } else if (/^>\s?/.test(line)) {
      flushList(); flushParagraph();
      blocks.push(`<blockquote style="margin:20px 0;padding:12px 16px;border-left:3px solid #173e32;background:#f5f7f6;color:#555;line-height:1.85;">${inline(line.replace(/^>\s?/, ""))}</blockquote>`);
    } else { flushList(); paragraph.push(line); }
  }
  flushList(); flushParagraph();
  return `<section style="max-width:677px;padding:8px 0;font-family:system-ui,sans-serif;word-break:break-word;">${blocks.join("")}</section>`;
}

export function renderWechatDocument(title: string, markdown: string) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body>${renderWechatBodyHtml(markdown)}</body></html>`;
}

function inline(text: string) {
  return escapeHtml(text).replace(/\*\*([^*\n]+)\*\*/g, '<strong style="font-weight:700;">$1</strong>').replace(/`([^`\n]+)`/g, '<code style="background:#f5f7f6;padding:2px 4px;">$1</code>');
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
