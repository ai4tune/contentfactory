"use client";

import { useEffect, useState } from "react";
import { loadLocalKnowledge } from "@/modules/knowledge/local-index";

export function KnowledgeMaterialStat({ serverCount }: { serverCount: number }) {
  const [localCount, setLocalCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void loadLocalKnowledge()
      .then((items) => {
        if (active) setLocalCount(items.length);
      })
      .catch(() => {
        if (active) setLocalCount(0);
      });
    return () => {
      active = false;
    };
  }, []);

  const total = serverCount + (localCount ?? 0);

  return (
    <div>
      <p className="font-mono text-3xl font-semibold tracking-tight text-slate-950">
        {formatNumber(total)}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-700">知识素材</p>
      <p className="mt-1 text-xs text-slate-400">
        {localCount === null ? "正在读取本地索引" : `本地 ${localCount}，在线 ${serverCount}`}
      </p>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}
