export function filterAndSortSearchResults(results, filters, now = new Date()) {
  const days = Number(filters?.days || 0);
  const minimumLikes = Math.max(0, Number(filters?.minimumLikes || 0));
  const includeUnknownDates = Boolean(filters?.includeUnknownDates);
  const threshold = days ? now.getTime() - days * 86_400_000 : 0;
  const filtered = (Array.isArray(results) ? results : []).filter((item) => {
    const likes = Number(item?.likes?.value);
    if ((Number.isFinite(likes) ? likes : 0) < minimumLikes) return false;
    if (!days) return true;
    if (!item?.publishedAt) return includeUnknownDates;
    const publishedAt = new Date(item.publishedAt).getTime();
    return Number.isFinite(publishedAt) && publishedAt >= threshold && publishedAt <= now.getTime() + 3_600_000;
  });

  return filtered.toSorted((left, right) => {
    if (filters?.sort === "published_desc") {
      return dateValue(right.publishedAt) - dateValue(left.publishedAt)
        || metricValue(right.likes) - metricValue(left.likes);
    }
    return metricValue(right.likes) - metricValue(left.likes)
      || dateValue(right.publishedAt) - dateValue(left.publishedAt);
  });
}

export function xiaohongshuSearchUrl(keyword) {
  const url = new URL("https://www.xiaohongshu.com/search_result");
  url.searchParams.set("keyword", String(keyword || "").trim());
  url.searchParams.set("source", "web_search_result_notes");
  return url.toString();
}

function metricValue(metric) {
  const value = Number(metric?.value);
  return Number.isFinite(value) ? value : 0;
}

function dateValue(value) {
  const date = value ? new Date(value).getTime() : 0;
  return Number.isFinite(date) ? date : 0;
}
