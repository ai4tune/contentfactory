import { KnowledgeProfileWorkspace } from "@/modules/knowledge-profile/components/knowledge-profile-workspace";
import { getKnowledgeProfileState } from "@/modules/knowledge-profile/repository";

export const dynamic = "force-dynamic";

export default async function KnowledgeProfilePage() {
  return <KnowledgeProfileWorkspace initialState={await getKnowledgeProfileState()} />;
}
