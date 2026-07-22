export function captureVisibleAccountPage() {
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const visibleText = (node) => clean(node?.innerText || node?.textContent || "");
  const meta = (name) => clean(
    document.querySelector(`meta[property="${name}"]`)?.content
      || document.querySelector(`meta[name="${name}"]`)?.content,
  );
  const firstText = (selectors) => {
    for (const selector of selectors) {
      const value = visibleText(document.querySelector(selector));
      if (value) return value;
    }
    return "";
  };
  const metric = (value, visibility = "public") => {
    const raw = clean(value);
    const match = raw.replace(/,/g, "").match(/(-?[\d.]+)\s*(万|w|W|k|K)?/);
    if (!match) return null;
    const multiplier = match[2] === "万" || /^w$/i.test(match[2] || "")
      ? 10_000
      : /^k$/i.test(match[2] || "") ? 1_000 : 1;
    const parsed = Number(match[1]);
    if (!Number.isFinite(parsed)) return null;
    return { raw, value: Math.round(parsed * multiplier), visibility };
  };
  const metricFromText = (text, labels, visibility = "public") => {
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const patterns = [
        new RegExp(`${escaped}[\\s:：]*([\\d,.]+\\s*(?:万|w|W|k|K)?)`),
        new RegExp(`([\\d,.]+\\s*(?:万|w|W|k|K)?)\\s*${escaped}`),
      ];
      for (const pattern of patterns) {
        const match = clean(text).match(pattern);
        if (match) return metric(match[1], visibility);
      }
    }
    return null;
  };
  const metricNearLabel = (labels, visibility = "public") => {
    const labelNodes = [...document.querySelectorAll("span,div,p")]
      .filter((node) => labels.includes(visibleText(node)));

    for (const labelNode of labelNodes) {
      let container = labelNode.parentElement;
      for (let depth = 0; container && depth < 3; depth += 1) {
        const text = visibleText(container);
        const withoutLabel = labels.reduce(
          (value, label) => value.replaceAll(label, " "),
          text,
        );
        const numbers = withoutLabel.match(/-?[\d,.]+\s*(?:万|w|W|k|K)?/g) || [];
        if (numbers.length === 1 && text.length <= 80) return metric(numbers[0], visibility);
        container = container.parentElement;
      }
    }

    const containers = document.querySelectorAll([
      ".user-interactions > *",
      "[class*='user-interactions'] > *",
      "[class*='interaction']",
      "[class*='data-info'] > *",
    ].join(","));
    for (const container of containers) {
      const text = visibleText(container);
      if (!labels.some((label) => text.includes(label)) || text.length > 80) continue;
      const withoutLabel = labels.reduce(
        (value, label) => value.replaceAll(label, " "),
        text,
      );
      const numbers = withoutLabel.match(/-?[\d,.]+\s*(?:万|w|W|k|K)?/g) || [];
      if (numbers.length === 1) return metric(numbers[0], visibility);
    }
    return null;
  };
  const imageUrl = (image) => {
    if (!image || typeof image !== "object") return "";
    return image.currentSrc || image.src || image.urlDefault || image.url || image.urlPre
      || image.infoList?.find((item) => item?.url)?.url || "";
  };
  const parseInitialState = () => {
    const script = [...document.scripts]
      .map((item) => item.textContent || "")
      .find((text) => text.includes("window.__INITIAL_STATE__"));
    if (!script) return null;
    const match = script.match(/window\.__INITIAL_STATE__\s*=\s*([\s\S]*?)\s*;?\s*$/);
    if (!match) return null;
    try {
      return JSON.parse(match[1].replace(/\bundefined\b/g, "null"));
    } catch {
      return null;
    }
  };
  const emptyContentMetrics = () => ({
    likes: null,
    collects: null,
    comments: null,
    shares: null,
    views: null,
    impressions: null,
  });
  const contentMetricSummary = (metrics) => [
    metrics.likes ? `点赞 ${metrics.likes.raw}` : "",
    metrics.collects ? `收藏 ${metrics.collects.raw}` : "",
    metrics.comments ? `评论 ${metrics.comments.raw}` : "",
    metrics.shares ? `分享 ${metrics.shares.raw}` : "",
    metrics.views ? `阅读/播放 ${metrics.views.raw}` : "",
    metrics.impressions ? `曝光 ${metrics.impressions.raw}` : "",
  ].filter(Boolean).join(" · ");
  const xiaohongshuContentMetrics = (info = {}, visibility = "public") => ({
    likes: metric(info.likedCount ?? info.likeCount, visibility),
    collects: metric(info.collectedCount ?? info.collectCount, visibility),
    comments: metric(info.commentCount, visibility),
    shares: metric(info.shareCount, visibility),
    views: metric(info.viewCount ?? info.playCount ?? info.videoViewCount, visibility),
    impressions: metric(info.impressionCount ?? info.exposureCount, visibility),
  });
  const canonicalNoteUrl = (noteId) => noteId
    ? `https://www.xiaohongshu.com/explore/${noteId}`
    : location.href;
  const buildXiaohongshuCard = (card) => {
    if (!card || typeof card !== "object") return null;
    const noteId = clean(card.noteId || card.note_id || card.id);
    const title = clean(card.displayTitle || card.title);
    if (!noteId || !title) return null;
    const metrics = xiaohongshuContentMetrics(card.interactInfo || {});
    const coverUrl = imageUrl(card.cover);
    return {
      noteId,
      title,
      description: "",
      type: card.type === "video" ? "video" : "image",
      url: canonicalNoteUrl(noteId),
      publishedAt: "",
      tags: [],
      imageUrls: coverUrl ? [coverUrl] : [],
      coverUrl,
      durationMs: null,
      pinned: Boolean(card.interactInfo?.sticky),
      metrics,
      metricSummary: contentMetricSummary(metrics),
    };
  };
  const buildXiaohongshuNote = (note) => {
    if (!note || typeof note !== "object") return null;
    const noteId = clean(note.noteId || note.note_id || note.id);
    const title = clean(note.title || note.displayTitle || meta("og:title"));
    if (!title) return null;
    const metrics = xiaohongshuContentMetrics(note.interactInfo || {});
    const imageUrls = (note.imageList || []).map(imageUrl).filter(Boolean).slice(0, 20);
    const coverUrl = imageUrls[0] || meta("og:image");
    const timestamp = Number(note.time || note.createTime || 0);
    return {
      noteId,
      title,
      description: clean(note.desc || note.description),
      type: note.type === "video" ? "video" : "image",
      url: canonicalNoteUrl(noteId),
      publishedAt: timestamp ? new Date(timestamp > 10_000_000_000 ? timestamp : timestamp * 1_000).toISOString() : "",
      tags: (note.tagList || []).map((item) => clean(item?.name || item)).filter(Boolean).slice(0, 20),
      imageUrls,
      coverUrl,
      durationMs: Number(note.video?.consumer?.duration || note.video?.duration || 0) || null,
      pinned: Boolean(note.interactInfo?.sticky),
      metrics,
      metricSummary: contentMetricSummary(metrics),
    };
  };
  const buildXiaohongshuDomNote = () => {
    const root = document.querySelector(".note-container");
    const title = clean(root?.querySelector(".note-content .title")?.textContent || meta("og:title"));
    if (!root || !title) return null;
    const noteId = clean(location.pathname.match(/\/(?:explore|discovery\/item)\/([^/?]+)/)?.[1]);
    const description = clean(
      root.querySelector(".note-content .note-text > span:not(.tag)")?.textContent
        || root.querySelector(".note-content .desc")?.textContent,
    );
    const tags = [...root.querySelectorAll(".note-content .note-text .tag")]
      .map((item) => clean(item.textContent).replace(/^#/, ""))
      .filter(Boolean)
      .slice(0, 20);
    const imageUrls = [...new Set([...root.querySelectorAll(".media-container img")]
      .map((item) => item.currentSrc || item.src)
      .filter((url) => /^https?:\/\//.test(url)))]
      .slice(0, 20);
    const readCount = (selector) => metric(root.querySelector(selector)?.textContent);
    const metrics = {
      likes: readCount(".engage-bar-container .like-wrapper .count"),
      collects: readCount(".engage-bar-container .collect-wrapper .count"),
      comments: readCount(".engage-bar-container .chat-wrapper .count"),
      shares: readCount(".engage-bar-container .share-wrapper .count"),
      views: null,
      impressions: null,
    };
    return {
      noteId,
      title,
      description,
      type: root.querySelector(".media-container video") ? "video" : "image",
      url: canonicalNoteUrl(noteId),
      publishedAt: "",
      tags,
      imageUrls,
      coverUrl: imageUrls[0] || meta("og:image"),
      durationMs: null,
      pinned: false,
      metrics,
      metricSummary: contentMetricSummary(metrics),
    };
  };
  const buildXiaohongshuDomCards = () => {
    const links = [...document.querySelectorAll([
      "section.note-item a[href*='/explore/']",
      "[class~='note-item'] a[href*='/explore/']",
      "[class*='feeds-container'] a[href*='/explore/']",
      "section.note-item a[href*='/discovery/item/']",
      "[class~='note-item'] a[href*='/discovery/item/']",
    ].join(","))];
    const cards = [];
    const seen = new Set();

    for (const link of links) {
      const url = new URL(link.href, location.href);
      const noteId = clean(url.pathname.match(/\/(?:explore|discovery\/item)\/([^/?]+)/)?.[1]);
      if (!noteId || seen.has(noteId)) continue;
      const root = link.closest("section.note-item,[class~='note-item'],article,li,[class*='note-card']") || link.parentElement;
      if (!root) continue;
      const titleNode = root.querySelector([
        ".footer .title",
        "[class*='footer'] [class~='title']",
        "[class*='footer'] [class*='title']",
        "[class~='title']",
      ].join(","));
      const title = clean(
        visibleText(titleNode)
        || link.getAttribute("title")
        || link.querySelector("img")?.getAttribute("alt"),
      );
      if (!title) continue;
      const likeText = visibleText(root.querySelector([
        ".like-wrapper .count",
        "[class*='like-wrapper'] [class*='count']",
        "[class*='like'] > [class*='count']",
        "[class*='like'] [class*='count']",
      ].join(",")));
      const coverUrl = imageUrl(root.querySelector("img"));
      const metrics = emptyContentMetrics();
      metrics.likes = metric(likeText);
      cards.push({
        noteId,
        title,
        description: "",
        type: root.querySelector("video") ? "video" : "image",
        url: canonicalNoteUrl(noteId),
        publishedAt: "",
        tags: [],
        imageUrls: coverUrl ? [coverUrl] : [],
        coverUrl,
        durationMs: null,
        pinned: false,
        metrics,
        metricSummary: contentMetricSummary(metrics),
      });
      seen.add(noteId);
      if (cards.length >= 20) break;
    }
    return cards;
  };
  const findXiaohongshuNote = (state) => {
    const maps = [];
    const visit = (value, depth = 0) => {
      if (!value || typeof value !== "object" || depth > 5) return;
      if (value.noteDetailMap && typeof value.noteDetailMap === "object") maps.push(value.noteDetailMap);
      Object.values(value).forEach((item) => visit(item, depth + 1));
    };
    visit(state);
    for (const noteMap of maps) {
      for (const detail of Object.values(noteMap)) {
        if (detail?.note && typeof detail.note === "object") return detail.note;
      }
    }
    return null;
  };
  const xiaohongshuCapture = () => {
    const state = parseInitialState();
    const bodyText = visibleText(document.body).slice(0, 100_000);
    const path = location.pathname.toLowerCase();
    const isCreator = location.hostname.startsWith("creator.") || /creator|dashboard|platform/.test(path);
    const isAccount = path.includes("/user/profile/");
    const isContent = path.includes("/explore/") || path.includes("/discovery/item/");
    const pageType = isCreator ? "creator_backend" : isAccount ? "account" : isContent ? "content" : "unknown";
    const userPageData = state?.user?.userPageData || {};
    const basic = userPageData.basicInfo || {};
    const interactionMap = Object.fromEntries((userPageData.interactions || []).map((item) => [clean(item?.name), item]));
    const interactionMetric = (names) => {
      const visibleMetric = metricNearLabel(names);
      if (visibleMetric) return visibleMetric;
      for (const name of names) {
        const item = interactionMap[name];
        if (item) return metric(item.i18nCount ?? item.count);
      }
      return metricFromText(bodyText, names);
    };
    const accountMetrics = {
      following: interactionMetric(["关注"]),
      followers: interactionMetric(["粉丝", "关注者"]),
      likesAndCollects: interactionMetric(["获赞与收藏", "获赞和收藏", "获赞"]),
    };
    const operationalMetrics = {
      views: isCreator ? metricFromText(bodyText, ["阅读量", "播放量", "观看量"], "creator_backend") : null,
      impressions: isCreator ? metricFromText(bodyText, ["曝光量", "展现量"], "creator_backend") : null,
      profileVisits: isCreator ? metricFromText(bodyText, ["主页访问量", "主页访问"], "creator_backend") : null,
      followerGrowth: isCreator ? metricFromText(bodyText, ["新增粉丝", "涨粉"], "creator_backend") : null,
    };
    const noteGroups = Array.isArray(state?.user?.notes) ? state.user.notes : [];
    const stateCards = noteGroups.flatMap((group) => Array.isArray(group) ? group : [group])
      .map((item) => buildXiaohongshuCard(item?.noteCard || item))
      .filter(Boolean);
    const domCards = isAccount ? buildXiaohongshuDomCards() : [];
    const cardsById = new Map(stateCards.map((card) => [card.noteId, card]));
    for (const card of domCards) {
      const existing = cardsById.get(card.noteId);
      cardsById.set(card.noteId, existing ? {
        ...existing,
        ...card,
        metrics: {
          ...existing.metrics,
          likes: card.metrics.likes || existing.metrics.likes,
        },
        metricSummary: contentMetricSummary({
          ...existing.metrics,
          likes: card.metrics.likes || existing.metrics.likes,
        }),
      } : card);
    }
    const cards = [...cardsById.values()];
    const detailNote = findXiaohongshuNote(state);
    const detailContent = buildXiaohongshuNote(detailNote) || (isContent ? buildXiaohongshuDomNote() : null);
    const contents = detailContent ? [detailContent] : cards.slice(0, 20);
    const accountName = clean(
      basic.nickname
      || detailNote?.user?.nickname
      || firstText([".note-container .username"])
      || firstText([".user-nickname", ".user-name", "[class*='nickname']", "h1"])
      || meta("og:article:author")
      || meta("og:site_name"),
    );
    const bio = clean(basic.desc || firstText([".user-desc", ".user-bio", "[class*='user-desc']"]) || meta("description") || meta("og:description"));
    const interactionSummary = [
      accountMetrics.following ? `关注 ${accountMetrics.following.raw}` : "",
      accountMetrics.followers ? `粉丝 ${accountMetrics.followers.raw}` : "",
      accountMetrics.likesAndCollects ? `获赞与收藏 ${accountMetrics.likesAndCollects.raw}` : "",
      operationalMetrics.views ? `阅读/播放 ${operationalMetrics.views.raw}` : "",
      operationalMetrics.impressions ? `曝光 ${operationalMetrics.impressions.raw}` : "",
      operationalMetrics.profileVisits ? `主页访问 ${operationalMetrics.profileVisits.raw}` : "",
      operationalMetrics.followerGrowth ? `新增粉丝 ${operationalMetrics.followerGrowth.raw}` : "",
    ].filter(Boolean).join("，");

    return {
      platform: "小红书",
      platformAccountId: clean(state?.user?.userInfo?.userId || state?.user?.userInfo?.user_id || ""),
      platformDisplayId: clean(basic.redId || state?.user?.userInfo?.redId || state?.user?.userInfo?.red_id || ""),
      pageType,
      sourceUrl: detailContent?.url || `${location.origin}${location.pathname}`,
      accountName: accountName.slice(0, 160),
      bio: bio.slice(0, 2_000),
      verification: clean((userPageData.tags || []).map((item) => item?.name || item?.title || "").filter(Boolean).join("，")).slice(0, 300),
      followerCount: accountMetrics.followers?.raw || "",
      accountMetrics,
      operationalMetrics,
      contents,
      interactionSummary: interactionSummary.slice(0, 2_000),
      capturedAt: new Date().toISOString(),
    };
  };
  const genericCapture = () => {
    const hostname = location.hostname.toLowerCase();
    const platform = hostname.includes("weixin.qq.com") ? "公众号"
      : hostname.includes("douyin") ? "抖音"
        : hostname.includes("weibo") ? "微博"
          : hostname.includes("bilibili") ? "B站" : hostname;
    const accountName = clean(
      hostname.includes("weixin.qq.com") ? meta("og:article:author") : "",
    ) || firstText(["[class*='nickname']", "[class*='user-name']", "[class*='username']", "h1"])
      || meta("og:site_name") || clean(document.title).split(/[|–-]/)[0];
    const bio = firstText(["[class*='signature']", "[class*='description']", "[class*='profile-desc']"])
      || meta("description") || meta("og:description");
    const bodyText = visibleText(document.body).slice(0, 100_000);
    const followers = metricFromText(bodyText, ["粉丝", "关注者"]);
    const accountMetrics = { following: null, followers, likesAndCollects: null };
    const links = [...document.querySelectorAll("article a[href],main a[href],[class*='content'] a[href],[class*='note'] a[href]")];
    const seen = new Set();
    const contents = [];
    for (const link of links) {
      const container = link.closest("article,li,[class*='card'],[class*='item'],[class*='note']") || link;
      const title = clean(link.getAttribute("title")) || visibleText(link.querySelector("h1,h2,h3,[class*='title']")) || visibleText(link);
      if (title.length < 4 || title.length > 180 || seen.has(title)) continue;
      seen.add(title);
      const metrics = emptyContentMetrics();
      metrics.likes = metricFromText(visibleText(container), ["点赞", "赞"]);
      metrics.collects = metricFromText(visibleText(container), ["收藏"]);
      metrics.comments = metricFromText(visibleText(container), ["评论"]);
      metrics.views = metricFromText(visibleText(container), ["阅读", "播放"]);
      contents.push({
        title,
        url: new URL(link.href, location.href).href,
        description: "",
        type: "unknown",
        tags: [],
        imageUrls: [],
        metrics,
        metricSummary: contentMetricSummary(metrics),
      });
      if (contents.length >= 20) break;
    }
    return {
      platform,
      pageType: contents.length > 1 ? "account" : "unknown",
      sourceUrl: location.href,
      accountName: accountName.slice(0, 160),
      bio: bio.slice(0, 2_000),
      followerCount: followers?.raw || "",
      accountMetrics,
      operationalMetrics: { views: null, impressions: null, profileVisits: null, followerGrowth: null },
      contents,
      interactionSummary: followers ? `粉丝 ${followers.raw}` : "",
      capturedAt: new Date().toISOString(),
    };
  };

  return location.hostname.toLowerCase().includes("xiaohongshu.com")
    ? xiaohongshuCapture()
    : genericCapture();
}
