export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      content_factory_state: {
        Row: { workspace_id: string; store_key: string; payload: Json; version: number; updated_at: string };
        Insert: { workspace_id: string; store_key: string; payload: Json; version?: number; updated_at?: string };
        Update: { payload?: Json; version?: number; updated_at?: string };
        Relationships: [];
      };
      content_factory_workspace_members: {
        Row: { workspace_id: string; user_id: string; role: "owner" | "member"; created_at: string };
        Insert: { workspace_id: string; user_id: string; role?: "owner" | "member"; created_at?: string };
        Update: { role?: "owner" | "member" };
        Relationships: [];
      };
      content_factory_workspaces: {
        Row: { id: string; name: string; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; created_at?: string; updated_at?: string };
        Update: { name?: string; updated_at?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
