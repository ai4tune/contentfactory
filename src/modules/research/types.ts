export type ResearchPlace = {
  poiId: string;
  location: string; // Amap GCJ-02, longitude first, up to six decimal places.
  address: string;
  city: string;
  district: string;
  category: string;
  distanceMeters?: number;
  rating?: number;
  cost?: number;
  businessArea?: string;
  openingHours?: string;
};
export type ResearchLocation = { sourceId: string; title: string; place: ResearchPlace; confirmedAt: string };
export type ResearchSource = {
  id: string;
  title: string;
  url?: string;
  text: string;
  provider: "brave" | "redfox" | "amap";
  platform?: string;
  authorName?: string;
  authorId?: string;
  publishedAt?: string;
  retrievedAt: string;
  evidence: "snippet" | "body" | "summary" | "profile" | "place";
  place?: ResearchPlace;
  metrics?: Record<string, number | null | undefined>;
};
export type ResearchRecord = {
  id: string;
  kind: "web" | "peer_content" | "peer_account" | "peer_posts" | "place_search" | "nearby_places" | "place_detail";
  query: Record<string, unknown>;
  retrievedAt: string;
  sources: ResearchSource[];
  limitations: string[];
};
