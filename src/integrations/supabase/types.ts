export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      access_groups: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ato_events: {
        Row: {
          created_at: string
          detected_at: string
          event_type: string
          id: string
          ip_from: string | null
          ip_to: string | null
          location_from: string | null
          location_to: string | null
          resolved: boolean | null
          risk_score: number | null
          user_email: string
        }
        Insert: {
          created_at?: string
          detected_at?: string
          event_type?: string
          id?: string
          ip_from?: string | null
          ip_to?: string | null
          location_from?: string | null
          location_to?: string | null
          resolved?: boolean | null
          risk_score?: number | null
          user_email: string
        }
        Update: {
          created_at?: string
          detected_at?: string
          event_type?: string
          id?: string
          ip_from?: string | null
          ip_to?: string | null
          location_from?: string | null
          location_to?: string | null
          resolved?: boolean | null
          risk_score?: number | null
          user_email?: string
        }
        Relationships: []
      }
      attack_metrics: {
        Row: {
          category: string | null
          country: string | null
          id: string
          metric_name: string
          metric_value: number
          recorded_at: string
        }
        Insert: {
          category?: string | null
          country?: string | null
          id?: string
          metric_name: string
          metric_value?: number
          recorded_at?: string
        }
        Update: {
          category?: string | null
          country?: string | null
          id?: string
          metric_name?: string
          metric_value?: number
          recorded_at?: string
        }
        Relationships: []
      }
      breach_checks: {
        Row: {
          breach_names: string[] | null
          breaches_found: number | null
          check_type: string
          check_value: string
          created_at: string
          id: string
          last_checked: string
          metadata: Json | null
          pastes_found: number | null
          risk_level: string | null
        }
        Insert: {
          breach_names?: string[] | null
          breaches_found?: number | null
          check_type: string
          check_value: string
          created_at?: string
          id?: string
          last_checked?: string
          metadata?: Json | null
          pastes_found?: number | null
          risk_level?: string | null
        }
        Update: {
          breach_names?: string[] | null
          breaches_found?: number | null
          check_type?: string
          check_value?: string
          created_at?: string
          id?: string
          last_checked?: string
          metadata?: Json | null
          pastes_found?: number | null
          risk_level?: string | null
        }
        Relationships: []
      }
      email_auth_reports: {
        Row: {
          created_at: string
          dkim_pass: boolean | null
          dmarc_aligned: boolean | null
          id: string
          metadata: Json | null
          policy: string | null
          report_date: string
          source_name: string
          spf_pass: boolean | null
          volume: number
        }
        Insert: {
          created_at?: string
          dkim_pass?: boolean | null
          dmarc_aligned?: boolean | null
          id?: string
          metadata?: Json | null
          policy?: string | null
          report_date?: string
          source_name: string
          spf_pass?: boolean | null
          volume?: number
        }
        Update: {
          created_at?: string
          dkim_pass?: boolean | null
          dmarc_aligned?: boolean | null
          id?: string
          metadata?: Json | null
          policy?: string | null
          report_date?: string
          source_name?: string
          spf_pass?: boolean | null
          volume?: number
        }
        Relationships: []
      }
      erasure_actions: {
        Row: {
          action: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          details: string | null
          id: string
          metadata: Json | null
          provider: string
          status: string
          target: string
          type: string
          updated_at: string
        }
        Insert: {
          action: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          details?: string | null
          id?: string
          metadata?: Json | null
          provider: string
          status?: string
          target: string
          type?: string
          updated_at?: string
        }
        Update: {
          action?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          details?: string | null
          id?: string
          metadata?: Json | null
          provider?: string
          status?: string
          target?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      feed_ingestions: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          records_fetched: number | null
          records_new: number | null
          source: Database["public"]["Enums"]["feed_source_type"]
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          records_fetched?: number | null
          records_new?: number | null
          source: Database["public"]["Enums"]["feed_source_type"]
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          records_fetched?: number | null
          records_new?: number | null
          source?: Database["public"]["Enums"]["feed_source_type"]
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      feed_schedules: {
        Row: {
          api_key_configured: boolean
          created_at: string
          cron_expression: string | null
          description: string | null
          enabled: boolean
          feed_name: string
          feed_source: string
          id: string
          interval_minutes: number | null
          last_records: number | null
          last_run_at: string | null
          last_status: string | null
          pull_type: string
          requires_api_key: boolean
          updated_at: string
        }
        Insert: {
          api_key_configured?: boolean
          created_at?: string
          cron_expression?: string | null
          description?: string | null
          enabled?: boolean
          feed_name: string
          feed_source: string
          id?: string
          interval_minutes?: number | null
          last_records?: number | null
          last_run_at?: string | null
          last_status?: string | null
          pull_type?: string
          requires_api_key?: boolean
          updated_at?: string
        }
        Update: {
          api_key_configured?: boolean
          created_at?: string
          cron_expression?: string | null
          description?: string | null
          enabled?: boolean
          feed_name?: string
          feed_source?: string
          id?: string
          interval_minutes?: number | null
          last_records?: number | null
          last_run_at?: string | null
          last_status?: string | null
          pull_type?: string
          requires_api_key?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      group_module_permissions: {
        Row: {
          group_id: string
          has_access: boolean | null
          id: string
          module_key: string
        }
        Insert: {
          group_id: string
          has_access?: boolean | null
          id?: string
          module_key: string
        }
        Update: {
          group_id?: string
          has_access?: boolean | null
          id?: string
          module_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_module_permissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "access_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_jobs: {
        Row: {
          batch_size: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          feed_source: string
          id: string
          max_retries: number
          metadata: Json | null
          priority: number
          records_processed: number | null
          retry_count: number
          started_at: string | null
          status: string
        }
        Insert: {
          batch_size?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          feed_source: string
          id?: string
          max_retries?: number
          metadata?: Json | null
          priority?: number
          records_processed?: number | null
          retry_count?: number
          started_at?: string | null
          status?: string
        }
        Update: {
          batch_size?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          feed_source?: string
          id?: string
          max_retries?: number
          metadata?: Json | null
          priority?: number
          records_processed?: number | null
          retry_count?: number
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      investigation_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          notes: Json | null
          priority: string
          resolution: string | null
          resolved_at: string | null
          severity: string
          source_id: string
          source_type: string
          status: string
          tags: string[] | null
          ticket_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          notes?: Json | null
          priority?: string
          resolution?: string | null
          resolved_at?: string | null
          severity?: string
          source_id: string
          source_type: string
          status?: string
          tags?: string[] | null
          ticket_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          notes?: Json | null
          priority?: string
          resolution?: string | null
          resolved_at?: string | null
          severity?: string
          source_id?: string
          source_type?: string
          status?: string
          tags?: string[] | null
          ticket_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          first_name: string | null
          id: string
          idle_timeout_minutes: number | null
          last_name: string | null
          revoked_at: string | null
          team: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          idle_timeout_minutes?: number | null
          last_name?: string | null
          revoked_at?: string | null
          team?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          idle_timeout_minutes?: number | null
          last_name?: string | null
          revoked_at?: string | null
          team?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scan_leads: {
        Row: {
          company: string | null
          created_at: string
          domain_scanned: string | null
          email: string
          id: string
          metadata: Json | null
          name: string
          phone: string | null
          scan_grade: string | null
          scan_score: number | null
          submission_type: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          domain_scanned?: string | null
          email: string
          id?: string
          metadata?: Json | null
          name: string
          phone?: string | null
          scan_grade?: string | null
          scan_score?: number | null
          submission_type?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          domain_scanned?: string | null
          email?: string
          id?: string
          metadata?: Json | null
          name?: string
          phone?: string | null
          scan_grade?: string | null
          scan_score?: number | null
          submission_type?: string
        }
        Relationships: []
      }
      session_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      social_iocs: {
        Row: {
          confidence: string | null
          created_at: string
          date_shared: string
          id: string
          ioc_type: string
          ioc_value: string
          source: string
          source_url: string | null
          source_user: string | null
          tags: string[] | null
        }
        Insert: {
          confidence?: string | null
          created_at?: string
          date_shared?: string
          id?: string
          ioc_type: string
          ioc_value: string
          source?: string
          source_url?: string | null
          source_user?: string | null
          tags?: string[] | null
        }
        Update: {
          confidence?: string | null
          created_at?: string
          date_shared?: string
          id?: string
          ioc_type?: string
          ioc_value?: string
          source?: string
          source_url?: string | null
          source_user?: string | null
          tags?: string[] | null
        }
        Relationships: []
      }
      spam_trap_hits: {
        Row: {
          brand_mentioned: string | null
          category: string
          confidence: number
          country: string | null
          created_at: string
          dkim_pass: boolean | null
          id: string
          raw_headers: Json | null
          received_at: string
          sender_domain: string
          sender_email: string
          sender_ip: string | null
          spf_pass: boolean | null
          subject: string | null
          trap_address: string
        }
        Insert: {
          brand_mentioned?: string | null
          category?: string
          confidence?: number
          country?: string | null
          created_at?: string
          dkim_pass?: boolean | null
          id?: string
          raw_headers?: Json | null
          received_at?: string
          sender_domain: string
          sender_email: string
          sender_ip?: string | null
          spf_pass?: boolean | null
          subject?: string | null
          trap_address: string
        }
        Update: {
          brand_mentioned?: string | null
          category?: string
          confidence?: number
          country?: string | null
          created_at?: string
          dkim_pass?: boolean | null
          id?: string
          raw_headers?: Json | null
          received_at?: string
          sender_domain?: string
          sender_email?: string
          sender_ip?: string | null
          spf_pass?: boolean | null
          subject?: string | null
          trap_address?: string
        }
        Relationships: []
      }
      threat_news: {
        Row: {
          created_at: string
          cve_id: string | null
          date_published: string
          description: string | null
          id: string
          metadata: Json | null
          product: string | null
          severity: string
          source: string
          title: string
          url: string | null
          vendor: string | null
        }
        Insert: {
          created_at?: string
          cve_id?: string | null
          date_published?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          product?: string | null
          severity?: string
          source?: string
          title: string
          url?: string | null
          vendor?: string | null
        }
        Update: {
          created_at?: string
          cve_id?: string | null
          date_published?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          product?: string | null
          severity?: string
          source?: string
          title?: string
          url?: string | null
          vendor?: string | null
        }
        Relationships: []
      }
      threats: {
        Row: {
          abuse_contact: string | null
          asn: string | null
          attack_type: string
          brand: string
          confidence: number
          country: string | null
          created_at: string
          domain: string
          first_seen: string
          id: string
          ip_address: string | null
          isp: string | null
          last_seen: string
          metadata: Json | null
          org_name: string | null
          severity: Database["public"]["Enums"]["threat_severity"]
          source: Database["public"]["Enums"]["feed_source_type"]
          status: Database["public"]["Enums"]["threat_status"]
          updated_at: string
        }
        Insert: {
          abuse_contact?: string | null
          asn?: string | null
          attack_type: string
          brand: string
          confidence?: number
          country?: string | null
          created_at?: string
          domain: string
          first_seen?: string
          id?: string
          ip_address?: string | null
          isp?: string | null
          last_seen?: string
          metadata?: Json | null
          org_name?: string | null
          severity?: Database["public"]["Enums"]["threat_severity"]
          source?: Database["public"]["Enums"]["feed_source_type"]
          status?: Database["public"]["Enums"]["threat_status"]
          updated_at?: string
        }
        Update: {
          abuse_contact?: string | null
          asn?: string | null
          attack_type?: string
          brand?: string
          confidence?: number
          country?: string | null
          created_at?: string
          domain?: string
          first_seen?: string
          id?: string
          ip_address?: string | null
          isp?: string | null
          last_seen?: string
          metadata?: Json | null
          org_name?: string | null
          severity?: Database["public"]["Enums"]["threat_severity"]
          source?: Database["public"]["Enums"]["feed_source_type"]
          status?: Database["public"]["Enums"]["threat_status"]
          updated_at?: string
        }
        Relationships: []
      }
      tor_exit_nodes: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          last_seen: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          last_seen?: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          last_seen?: string
        }
        Relationships: []
      }
      user_group_assignments: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_group_assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "access_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_has_module_access: {
        Args: { _module_key: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "analyst" | "customer"
      feed_source_type:
        | "phishtank"
        | "urlhaus"
        | "abuseipdb"
        | "openphish"
        | "manual"
        | "other"
        | "threatfox"
        | "sans_isc"
        | "ransomwatch"
        | "tor_nodes"
        | "mastodon"
        | "hibp"
        | "spam_trap"
        | "feodo"
        | "malbazaar"
        | "blocklist_de"
        | "ssl_blocklist"
        | "spamhaus_drop"
        | "certstream"
        | "phishtank_community"
        | "greynoise"
        | "google_safebrowsing"
        | "virustotal"
        | "ipqualityscore"
      threat_severity: "critical" | "high" | "medium" | "low" | "info"
      threat_status: "active" | "investigating" | "mitigated" | "resolved"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "analyst", "customer"],
      feed_source_type: [
        "phishtank",
        "urlhaus",
        "abuseipdb",
        "openphish",
        "manual",
        "other",
        "threatfox",
        "sans_isc",
        "ransomwatch",
        "tor_nodes",
        "mastodon",
        "hibp",
        "spam_trap",
        "feodo",
        "malbazaar",
        "blocklist_de",
        "ssl_blocklist",
        "spamhaus_drop",
        "certstream",
        "phishtank_community",
        "greynoise",
        "google_safebrowsing",
        "virustotal",
        "ipqualityscore",
      ],
      threat_severity: ["critical", "high", "medium", "low", "info"],
      threat_status: ["active", "investigating", "mitigated", "resolved"],
    },
  },
} as const
