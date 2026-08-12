export function captureVisibleSearchResults() {
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const metric = (value) => {
    const raw = clean(value);
    const match = raw.replace(/,/g, "").match(/([\d.]+)\s*(万|w|W|k|K)?/);
    if (!match) return { raw: "", value: null };
    const multiplier = match[2] === "万" || /^w$/i.test(match[2] || "")
      ? 10_000
      : /^k$/i.test(match[2] || "") ? 1_000 : 1;
    return { raw, value: Math.round(Number(match[1]) * multiplier) };
  };
  const parsePublishedAt = (text) => {
    const value = clean(text);
    const now = new Date();
    const relative = value.match(/(\d+)\s*(分钟|小时|天)前/);
    if (relative) {
      const unitMs = relative[2] === "分钟" ? 60_000 : relative[2] === "小时" ? 3_600_000 : 86_400_000;
      return new Date(now.getTime() - Number(relative[1]) * unitMs).toISOString();
    }
    if (value.includes("昨天")) return new Date(now.getTime() - 86_400_000).toISOString();
    const fullDate = value.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
    if (fullDate) return new Date(Number(fullDate[1]), Number(fullDate[2]) - 1, Number(fullDate[3]), 12).toISOString();
    const shortDate = value.match(/(?:^|\s)(\d{1,2})[-/.](\d{1,2})(?:\s|$)/);
    if (shortDate) {
      let year = now.getFullYear();
      const date = new Date(year, Number(shortDate[1]) - 1, Number(shortDate[2]), 12);
      if (date.getTime() > now.getTime() + 86_400_000) year -= 1;
      return new Date(year, Number(shortDate[1]) - 1, Number(shortDate[2]), 12).toISOString();
    }
    return "";
  };
  const queryUrl = new URL(location.href);
  const query = clean(
    queryUrl.searchParams.get("keyword")
      || queryUrl.searchParams.get("q")
      || document.querySelector("input[type='search'], input[placeholder*='搜索']")?.value,
  );
  const links = [...document.querySelectorAll([
    "section.note-item a[href*='/explore/']",
    "[class~='note-item'] a[href*='/explore/']",
    "[class*='feeds-container'] a[href*='/explore/']",
    "a[href*='/search_result/'][href*='xsec_token']",
  ].join(","))];
  const seen = new Set();
  const results = [];

  for (const link of links) {
    const url = new URL(link.href, location.href);
    const noteId = clean(url.pathname.match(/\/(?:explore|search_result)\/([^/?]+)/)?.[1]);
    const identity = noteId || `${url.origin}${url.pathname}`;
    if (!identity || seen.has(identity)) continue;
    const root = link.closest("section.note-item,[class~='note-item'],article,li,[class*='note-card']") || link.parentElement;
    if (!root) continue;
    const title = clean(
      root.querySelector(".footer .title,[class*='footer'] [class~='title'],[class~='title']")?.textContent
      || link.getAttribute("title")
      || link.querySelector("img")?.getAttribute("alt"),
    );
    if (!title) continue;
    const rootText = clean(root.textContent);
    const likeText = clean(root.querySelector(".like-wrapper .count,[class*='like-wrapper'] [class*='count'],[class*='like'] [class*='count']")?.textContent)
      || rootText.match(/(?:点赞|赞)\s*([\d,.]+\s*(?:万|w|W|k|K)?)/)?.[1]
      || "";
    const author = clean(root.querySelector("[class*='author'] [class*='name'],[class*='author-name'],.name")?.textContent);
    const publishedText = clean(root.querySelector("time,[class*='time'],[class*='date']")?.textContent)
      || rootText.match(/(?:\d+\s*(?:分钟|小时|天)前|昨天|20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}|\d{1,2}[-/.]\d{1,2})/)?.[0]
      || "";
    const image = root.querySelector("img");
    const likes = metric(likeText);
    results.push({
      noteId,
      title,
      author,
      url: noteId ? `https://www.xiaohongshu.com/explore/${noteId}` : `${url.origin}${url.pathname}`,
      coverUrl: image?.currentSrc || image?.src || "",
      likes,
      publishedAt: parsePublishedAt(publishedText),
      publishedText,
    });
    seen.add(identity);
    if (results.length >= 100) break;
  }

  return {
    platform: "小红书",
    pageType: "search-results",
    sourceUrl: location.href,
    query,
    capturedAt: new Date().toISOString(),
    results,
  };
}
