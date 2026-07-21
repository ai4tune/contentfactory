import path from "node:path";
import { updateJsonFile } from "@/lib/local-store/json-file";
import type { AccountContext } from "@/modules/positioning/types";
import type { ContentBrief, ContentProject } from "../types";

type ProjectStore = { projects: ContentProject[] };

const projectStorePath = path.join(process.cwd(), "data", "content-projects.local.json");
const emptyStore: ProjectStore = { projects: [] };

export async function saveContentProject(input: {
  topic: string;
  brief: ContentBrief;
  accountSnapshot: AccountContext | null;
}) {
  const now = new Date().toISOString();
  const project: ContentProject = {
    id: `contentProjects_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    topic: input.topic,
    accountSnapshot: input.accountSnapshot,
    selectedKnowledgeRefs: input.brief.citations,
    brief: input.brief,
    status: "brief_confirmed",
    createdAt: now,
    updatedAt: now,
  };

  await updateJsonFile<ProjectStore>(projectStorePath, emptyStore, (store) => ({
    projects: [...(store.projects ?? []), project],
  }));
  return project;
}
