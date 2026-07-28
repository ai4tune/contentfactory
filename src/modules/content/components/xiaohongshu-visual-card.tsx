"use client";

import Image from "next/image";
import type { GeneratedVisualAsset } from "@/modules/content/types";

const cardAccents = [
  { strong: "#155e4b", soft: "#dff3ea", warm: "#d6a84b" },
  { strong: "#284f8f", soft: "#e4edfb", warm: "#e18b45" },
  { strong: "#7a4936", soft: "#f7e9df", warm: "#d0a13c" },
  { strong: "#5e4b8b", soft: "#eee9f8", warm: "#cb8b3a" },
];

export function XiaohongshuVisualCard({
  asset,
  brandName,
  index,
  total,
}: {
  asset: GeneratedVisualAsset;
  brandName?: string;
  index: number;
  total: number;
}) {
  const legacyImage = isLegacyImageAsset(asset);
  const accent = cardAccents[Math.max(0, index - 1) % cardAccents.length];

  if (asset.status !== "generated") {
    return (
      <div className="flex aspect-[3/4] items-center justify-center bg-red-50 p-5 text-center text-xs leading-5 text-red-700">
        {asset.error || "图片生成失败"}
      </div>
    );
  }

  if (legacyImage && asset.imageUrl) {
    return (
      <div className="relative aspect-[3/4] overflow-hidden bg-slate-100">
        <Image alt={asset.title} className="object-cover" fill sizes="(min-width: 640px) 320px, 90vw" src={asset.imageUrl} />
      </div>
    );
  }

  if (asset.kind === "cover") {
    return (
      <div className="relative aspect-[3/4] overflow-hidden bg-emerald-950">
        {asset.imageUrl ? (
          <Image alt="" className="object-cover" fill sizes="(min-width: 640px) 320px, 90vw" src={asset.imageUrl} />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/20 to-black/85" />
        <div className="absolute inset-x-0 bottom-0 p-[9%] text-white">
          <span className="inline-flex rounded-full border border-white/40 bg-black/20 px-3 py-1 text-[10px] font-semibold tracking-[0.16em] backdrop-blur-sm">
            {brandName || "内容工厂"}
          </span>
          <h5 className="mt-4 text-[clamp(1.5rem,5vw,2.5rem)] font-black leading-[1.08] tracking-tight">
            {asset.title}
          </h5>
          {asset.body ? <p className="mt-3 text-sm font-medium leading-6 text-white/85">{asset.body}</p> : null}
          <p className="mt-5 text-[10px] font-semibold tracking-[0.2em] text-white/65">向右滑动查看完整内容 →</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex aspect-[3/4] flex-col overflow-hidden p-[8%]"
      style={{ backgroundColor: "#fbfaf6", color: accent.strong }}
    >
      <div
        className="absolute -right-[18%] -top-[8%] aspect-square w-[62%] rounded-full opacity-80"
        style={{ backgroundColor: accent.soft }}
      />
      <div className="relative flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-[0.16em]">{layoutLabel(asset.layout)}</span>
        <span className="rounded-full px-3 py-1 text-[10px] font-bold" style={{ backgroundColor: accent.soft }}>
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </div>
      <div className="relative mt-[14%]">
        <span className="block h-1.5 w-12 rounded-full" style={{ backgroundColor: accent.warm }} />
        <h5 className="mt-4 text-[clamp(1.35rem,4.4vw,2rem)] font-black leading-[1.15] tracking-tight">{asset.title}</h5>
        {asset.body ? <p className="mt-4 text-sm font-medium leading-6 text-slate-700">{asset.body}</p> : null}
      </div>
      {asset.points?.length ? (
        <div className="relative mt-5 grid gap-2.5">
          {asset.points.map((point, pointIndex) => (
            <div className="flex gap-3 rounded-xl bg-white/85 px-3 py-3 shadow-sm" key={`${pointIndex}:${point}`}>
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
                style={{ backgroundColor: accent.strong }}
              >
                {pointIndex + 1}
              </span>
              <span className="text-xs font-semibold leading-5 text-slate-700">{point}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="relative mt-auto flex items-center justify-between border-t border-slate-300/60 pt-4 text-[10px] font-semibold">
        <span>{brandName || "内容工厂"}</span>
        <span className="text-slate-400">{index === total - 1 ? "收藏 · 复习 · 行动" : "继续右滑 →"}</span>
      </div>
    </div>
  );
}

export async function downloadXiaohongshuVisualAsset(input: {
  asset: GeneratedVisualAsset;
  brandName?: string;
  index: number;
  projectId: string;
  total: number;
}) {
  const { asset, brandName, index, projectId, total } = input;
  const sourceUrl = `/api/content/projects/${encodeURIComponent(projectId)}/channels/xiaohongshu_note/images/${encodeURIComponent(asset.id)}`;

  if (isLegacyImageAsset(asset)) {
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error("旧版图片下载失败。");
    downloadBlob(await response.blob(), `xiaohongshu-${index + 1}.png`);
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1440;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法创建图片画布。");

  if (asset.kind === "cover") {
    await drawCover(context, asset, sourceUrl, brandName);
  } else {
    drawContentCard(context, asset, index, total, brandName);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG 导出失败。")), "image/png");
  });
  downloadBlob(blob, `xiaohongshu-${String(index + 1).padStart(2, "0")}-${safeFilename(asset.title)}.png`);
}

function isLegacyImageAsset(asset: GeneratedVisualAsset) {
  return Boolean(
    asset.kind === "card"
    && asset.imageUrl
    && !asset.body
    && !asset.points?.length,
  );
}

async function drawCover(
  context: CanvasRenderingContext2D,
  asset: GeneratedVisualAsset,
  sourceUrl: string,
  brandName?: string,
) {
  context.fillStyle = "#123d32";
  context.fillRect(0, 0, 1080, 1440);
  if (asset.imageUrl) {
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error("封面背景读取失败。");
    const bitmap = await createImageBitmap(await response.blob());
    drawImageCover(context, bitmap, 1080, 1440);
    bitmap.close();
  }

  const gradient = context.createLinearGradient(0, 180, 0, 1440);
  gradient.addColorStop(0, "rgba(0,0,0,0.08)");
  gradient.addColorStop(0.5, "rgba(0,0,0,0.18)");
  gradient.addColorStop(1, "rgba(0,0,0,0.92)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1080, 1440);

  context.fillStyle = "rgba(0,0,0,0.28)";
  roundedRect(context, 88, 858, 904, 452, 38);
  context.fill();

  context.fillStyle = "#ffffff";
  context.font = '700 30px "PingFang SC","Microsoft YaHei",sans-serif';
  context.fillText(brandName || "内容工厂", 120, 924);
  context.font = '900 76px "PingFang SC","Microsoft YaHei",sans-serif';
  let y = drawWrappedText(context, asset.title, 120, 1022, 840, 92, 3);
  if (asset.body) {
    context.fillStyle = "rgba(255,255,255,0.84)";
    context.font = '600 34px "PingFang SC","Microsoft YaHei",sans-serif';
    y = drawWrappedText(context, asset.body, 120, y + 24, 840, 48, 2);
  }
  context.fillStyle = "rgba(255,255,255,0.66)";
  context.font = '600 24px "PingFang SC","Microsoft YaHei",sans-serif';
  context.fillText("向右滑动查看完整内容 →", 120, Math.min(y + 60, 1280));
}

function drawContentCard(
  context: CanvasRenderingContext2D,
  asset: GeneratedVisualAsset,
  index: number,
  total: number,
  brandName?: string,
) {
  const accent = cardAccents[Math.max(0, index - 1) % cardAccents.length];
  context.fillStyle = "#fbfaf6";
  context.fillRect(0, 0, 1080, 1440);
  context.fillStyle = accent.soft;
  context.beginPath();
  context.arc(1010, 50, 310, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = accent.strong;
  context.font = '700 25px "PingFang SC","Microsoft YaHei",sans-serif';
  context.fillText(layoutLabel(asset.layout), 88, 108);
  context.textAlign = "right";
  context.fillText(`${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, 992, 108);
  context.textAlign = "left";

  context.fillStyle = accent.warm;
  roundedRect(context, 88, 188, 112, 12, 6);
  context.fill();

  context.fillStyle = accent.strong;
  context.font = '900 62px "PingFang SC","Microsoft YaHei",sans-serif';
  let y = drawWrappedText(context, asset.title, 88, 288, 904, 78, 3);
  if (asset.body) {
    context.fillStyle = "#334155";
    context.font = '600 33px "PingFang SC","Microsoft YaHei",sans-serif';
    y = drawWrappedText(context, asset.body, 88, y + 38, 904, 50, 4);
  }

  for (const [pointIndex, point] of (asset.points ?? []).entries()) {
    if (y > 1170) break;
    context.fillStyle = "rgba(255,255,255,0.94)";
    roundedRect(context, 88, y + 28, 904, 116, 24);
    context.fill();
    context.fillStyle = accent.strong;
    context.beginPath();
    context.arc(138, y + 86, 27, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.font = '800 25px "PingFang SC","Microsoft YaHei",sans-serif';
    context.fillText(String(pointIndex + 1), 138, y + 95);
    context.textAlign = "left";
    context.fillStyle = "#334155";
    context.font = '650 29px "PingFang SC","Microsoft YaHei",sans-serif';
    drawWrappedText(context, point, 188, y + 74, 760, 38, 2);
    y += 136;
  }

  context.strokeStyle = "rgba(148,163,184,0.45)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(88, 1324);
  context.lineTo(992, 1324);
  context.stroke();
  context.fillStyle = accent.strong;
  context.font = '700 24px "PingFang SC","Microsoft YaHei",sans-serif';
  context.fillText(brandName || "内容工厂", 88, 1374);
  context.fillStyle = "#94a3b8";
  context.textAlign = "right";
  context.fillText(index === total - 1 ? "收藏 · 复习 · 行动" : "继续右滑 →", 992, 1374);
  context.textAlign = "left";
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: ImageBitmap,
  targetWidth: number,
  targetHeight: number,
) {
  const scale = Math.max(targetWidth / image.width, targetHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image, (targetWidth - width) / 2, (targetHeight - height) / 2, width, height);
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const lines: string[] = [];
  let line = "";
  for (const character of text) {
    const next = line + character;
    if (context.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = character;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);

  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    visible[maxLines - 1] = `${visible[maxLines - 1].slice(0, -1)}…`;
  }
  visible.forEach((item, index) => context.fillText(item, x, startY + index * lineHeight));
  return startY + visible.length * lineHeight;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function layoutLabel(layout: GeneratedVisualAsset["layout"]) {
  return {
    cover: "COVER",
    explain: "WHY IT MATTERS",
    steps: "HOW TO",
    checklist: "CHECKLIST",
    summary: "TAKEAWAY",
  }[layout || "explain"];
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeFilename(value: string) {
  return value.replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 36) || "card";
}
