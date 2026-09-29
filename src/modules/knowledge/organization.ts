export const knowledgeOrganizationFolders = [
  { id: "brand", name: "01-企业与品牌", purpose: "企业介绍、品牌资料、定位与经营目标" },
  { id: "offers", name: "02-产品与服务", purpose: "产品、服务、价格、流程与交付说明" },
  { id: "customers", name: "03-客户与场景", purpose: "目标客户、需求、痛点与消费场景" },
  { id: "evidence", name: "04-案例与证据", purpose: "客户案例、数据、证言与可核实事实" },
  { id: "faq", name: "05-常见问题", purpose: "FAQ、咨询记录、反对意见与回答" },
  { id: "content", name: "06-内容与表达", purpose: "代表文章、口播、品牌语气与内容素材" },
  { id: "pending", name: "99-待整理", purpose: "暂时无法判断或需要人工确认的资料" },
] as const;

export type KnowledgeOrganizationFolderId = (typeof knowledgeOrganizationFolders)[number]["id"];

export type KnowledgeOrganizationAssignment = {
  sourceId: string;
  folderId: KnowledgeOrganizationFolderId;
  reason: string;
};

export type KnowledgeOrganizationPlan = {
  summary: string;
  folders: Array<(typeof knowledgeOrganizationFolders)[number]>;
  assignments: KnowledgeOrganizationAssignment[];
};
