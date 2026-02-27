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
      abuse_mailbox: {
        Row: {
          auto_actions_taken: Json | null
          classification: string | null
          confidence_score: number | null
          created_at: string
          cross_ref_threat_ids: string[] | null
          extracted_iocs: Json | null
          extracted_urls: string[] | null
          id: string
          identity_provider: string | null
          reporter_email: string
          sender_domain: string | null
          sender_email: string | null
          status: string
          subject: string | null
          triaged_at: string | null
          triaged_by: string | null
          updated_at: string
        }
        Insert: {
          auto_actions_taken?: Json | null
          classification?: string | null
          confidence_score?: number | null
          created_at?: string
          cross_ref_threat_ids?: string[] | null
          extracted_iocs?: Json | null
          extracted_urls?: string[] | null
          id?: string
          identity_provider?: string | null
          reporter_email: string
          sender_domain?: string | null
          sender_email?: string | null
          status?: string
          subject?: string | null
          triaged_at?: string | null
          triaged_by?: string | null
          updated_at?: string
        }
        Update: {
          auto_actions_taken?: Json | null
          classification?: string | null
          confidence_score?: number | null
          created_at?: string
          cross_ref_threat_ids?: string[] | null
          extracted_iocs?: Json | null
          extracted_urls?: string[] | null
          id?: string
          identity_provider?: string | null
          reporter_email?: string
          sender_domain?: string | null
          sender_email?: string | null
          status?: string
          subject?: string | null
          triaged_at?: string | null
          triaged_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
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
      agent_approvals: {
        Row: {
          action_type: string
          agent_run_id: string | null
          agent_type: string
          created_at: string
          description: string | null
          expires_at: string
          id: string
          identity_context: Json | null
          identity_provider: string | null
          mfa_verified: boolean | null
          payload: Json
          policy_decision: Json | null
          priority: string
          requested_by: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          action_type: string
          agent_run_id?: string | null
          agent_type: string
          created_at?: string
          description?: string | null
          expires_at?: string
          id?: string
          identity_context?: Json | null
          identity_provider?: string | null
          mfa_verified?: boolean | null
          payload?: Json
          policy_decision?: Json | null
          priority?: string
          requested_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          agent_run_id?: string | null
          agent_type?: string
          created_at?: string
          description?: string | null
          expires_at?: string
          id?: string
          identity_context?: Json | null
          identity_provider?: string | null
          mfa_verified?: boolean | null
          payload?: Json
          policy_decision?: Json | null
          priority?: string
          requested_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_approvals_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          agent_type: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          expires_at: string
          id: string
          input_params: Json | null
          items_flagged: number | null
          items_processed: number | null
          results: Json | null
          started_at: string | null
          status: string
          summary: string | null
          trigger_type: string
        }
        Insert: {
          agent_type: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          expires_at?: string
          id?: string
          input_params?: Json | null
          items_flagged?: number | null
          items_processed?: number | null
          results?: Json | null
          started_at?: string | null
          status?: string
          summary?: string | null
          trigger_type?: string
        }
        Update: {
          agent_type?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          expires_at?: string
          id?: string
          input_params?: Json | null
          items_flagged?: number | null
          items_processed?: number | null
          results?: Json | null
          started_at?: string | null
          status?: string
          summary?: string | null
          trigger_type?: string
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
      campaign_clusters: {
        Row: {
          brands_targeted: string[] | null
          campaign_name: string | null
          confidence_score: number | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          description: string | null
          id: string
          identity_provider: string | null
          infrastructure_pattern: Json | null
          ioc_count: number | null
          priority: string
          status: string
          threat_ids: string[] | null
          updated_at: string
        }
        Insert: {
          brands_targeted?: string[] | null
          campaign_name?: string | null
          confidence_score?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          identity_provider?: string | null
          infrastructure_pattern?: Json | null
          ioc_count?: number | null
          priority?: string
          status?: string
          threat_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          brands_targeted?: string[] | null
          campaign_name?: string | null
          confidence_score?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          identity_provider?: string | null
          infrastructure_pattern?: Json | null
          ioc_count?: number | null
          priority?: string
          status?: string
          threat_ids?: string[] | null
          updated_at?: string
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
      evidence_captures: {
        Row: {
          capture_type: string
          chain_of_custody: Json
          created_at: string
          domain: string
          evidence_data: Json
          id: string
          identity_provider: string | null
          status: string
          tagged_at: string | null
          tagged_by: string | null
          tags: string[] | null
          threat_id: string | null
          updated_at: string
        }
        Insert: {
          capture_type?: string
          chain_of_custody?: Json
          created_at?: string
          domain: string
          evidence_data?: Json
          id?: string
          identity_provider?: string | null
          status?: string
          tagged_at?: string | null
          tagged_by?: string | null
          tags?: string[] | null
          threat_id?: string | null
          updated_at?: string
        }
        Update: {
          capture_type?: string
          chain_of_custody?: Json
          created_at?: string
          domain?: string
          evidence_data?: Json
          id?: string
          identity_provider?: string | null
          status?: string
          tagged_at?: string | null
          tagged_by?: string | null
          tags?: string[] | null
          threat_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_captures_threat_id_fkey"
            columns: ["threat_id"]
            isOneToOne: false
            referencedRelation: "threats"
            referencedColumns: ["id"]
          },
        ]
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
      impersonation_reports: {
        Row: {
          ai_analysis: Json | null
          created_at: string
          evidence_urls: string[] | null
          id: string
          impersonator_display_name: string | null
          impersonator_url: string | null
          impersonator_username: string
          influencer_id: string
          platform: string
          reporter_description: string | null
          reporter_email: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          screenshot_url: string | null
          severity: string
          similarity_score: number | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          ai_analysis?: Json | null
          created_at?: string
          evidence_urls?: string[] | null
          id?: string
          impersonator_display_name?: string | null
          impersonator_url?: string | null
          impersonator_username: string
          influencer_id: string
          platform: string
          reporter_description?: string | null
          reporter_email?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_url?: string | null
          severity?: string
          similarity_score?: number | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          ai_analysis?: Json | null
          created_at?: string
          evidence_urls?: string[] | null
          id?: string
          impersonator_display_name?: string | null
          impersonator_url?: string | null
          impersonator_username?: string
          influencer_id?: string
          platform?: string
          reporter_description?: string | null
          reporter_email?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_url?: string | null
          severity?: string
          similarity_score?: number | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_reports_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          brand_name: string | null
          created_at: string
          display_name: string
          id: string
          max_monitored_accounts: number | null
          onboarding_completed: boolean | null
          report_email: string | null
          subscription_tier: string
          updated_at: string
          user_id: string
          website_url: string | null
          widget_token: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          brand_name?: string | null
          created_at?: string
          display_name: string
          id?: string
          max_monitored_accounts?: number | null
          onboarding_completed?: boolean | null
          report_email?: string | null
          subscription_tier?: string
          updated_at?: string
          user_id: string
          website_url?: string | null
          widget_token?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          brand_name?: string | null
          created_at?: string
          display_name?: string
          id?: string
          max_monitored_accounts?: number | null
          onboarding_completed?: boolean | null
          report_email?: string | null
          subscription_tier?: string
          updated_at?: string
          user_id?: string
          website_url?: string | null
          widget_token?: string | null
        }
        Relationships: []
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
      monitored_accounts: {
        Row: {
          created_at: string
          id: string
          influencer_id: string
          last_scanned_at: string | null
          metadata: Json | null
          platform: string
          platform_url: string
          platform_user_id: string | null
          platform_username: string
          scan_status: string | null
          updated_at: string
          verified: boolean | null
        }
        Insert: {
          created_at?: string
          id?: string
          influencer_id: string
          last_scanned_at?: string | null
          metadata?: Json | null
          platform: string
          platform_url: string
          platform_user_id?: string | null
          platform_username: string
          scan_status?: string | null
          updated_at?: string
          verified?: boolean | null
        }
        Update: {
          created_at?: string
          id?: string
          influencer_id?: string
          last_scanned_at?: string | null
          metadata?: Json | null
          platform?: string
          platform_url?: string
          platform_user_id?: string | null
          platform_username?: string
          scan_status?: string | null
          updated_at?: string
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "monitored_accounts_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencer_profiles"
            referencedColumns: ["id"]
          },
        ]
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
      takedown_requests: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          influencer_id: string
          notes: string | null
          platform: string
          platform_case_id: string | null
          report_id: string
          request_type: string
          resolved_at: string | null
          response_data: Json | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          influencer_id: string
          notes?: string | null
          platform: string
          platform_case_id?: string | null
          report_id: string
          request_type?: string
          resolved_at?: string | null
          response_data?: Json | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          influencer_id?: string
          notes?: string | null
          platform?: string
          platform_case_id?: string | null
          report_id?: string
          request_type?: string
          resolved_at?: string | null
          response_data?: Json | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "takedown_requests_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "takedown_requests_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "impersonation_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      threat_briefings: {
        Row: {
          briefing: Json
          created_at: string
          data_summary: Json
          expires_at: string
          generated_at: string
          generated_by: string | null
          id: string
        }
        Insert: {
          briefing: Json
          created_at?: string
          data_summary?: Json
          expires_at?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
        }
        Update: {
          briefing?: Json
          created_at?: string
          data_summary?: Json
          expires_at?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
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
      trust_score_history: {
        Row: {
          alert_triggered: boolean | null
          brand: string
          created_at: string
          delta: number | null
          factors: Json | null
          grade: string
          id: string
          score: number
        }
        Insert: {
          alert_triggered?: boolean | null
          brand: string
          created_at?: string
          delta?: number | null
          factors?: Json | null
          grade: string
          id?: string
          score: number
        }
        Update: {
          alert_triggered?: boolean | null
          brand?: string
          created_at?: string
          delta?: number | null
          factors?: Json | null
          grade?: string
          id?: string
          score?: number
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
      cleanup_expired_agent_runs: { Args: never; Returns: undefined }
      get_hosting_provider_stats: { Args: never; Returns: Json }
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
      app_role: "admin" | "analyst" | "customer" | "influencer"
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
        | "ipsum"
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
      app_role: ["admin", "analyst", "customer", "influencer"],
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
        "ipsum",
      ],
      threat_severity: ["critical", "high", "medium", "low", "info"],
      threat_status: ["active", "investigating", "mitigated", "resolved"],
    },
  },
} as const
