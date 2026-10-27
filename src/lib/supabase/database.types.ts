export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      poster_board_status_history: {
        Row: {
          board_id: string
          created_at: string
          display_name: string
          id: string
          new_status: Database["public"]["Enums"]["poster_board_status"]
          note: string | null
          previous_status: Database["public"]["Enums"]["poster_board_status"]
          user_id: string | null
        }
        Insert: {
          board_id: string
          created_at?: string
          display_name: string
          id?: string
          new_status: Database["public"]["Enums"]["poster_board_status"]
          note?: string | null
          previous_status: Database["public"]["Enums"]["poster_board_status"]
          user_id?: string | null
        }
        Update: {
          board_id?: string
          created_at?: string
          display_name?: string
          id?: string
          new_status?: Database["public"]["Enums"]["poster_board_status"]
          note?: string | null
          previous_status?: Database["public"]["Enums"]["poster_board_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poster_board_status_history_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "poster_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      poster_boards: {
        Row: {
          address: string
          created_at: string
          id: string
          lat: number
          long: number
          name: string
          number: string
          status: Database["public"]["Enums"]["poster_board_status"]
          updated_at: string
          ward: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          lat: number
          long: number
          name: string
          number: string
          status?: Database["public"]["Enums"]["poster_board_status"]
          updated_at?: string
          ward: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          lat?: number
          long?: number
          name?: string
          number?: string
          status?: Database["public"]["Enums"]["poster_board_status"]
          updated_at?: string
          ward?: string
        }
        Relationships: []
      }
      volunteers: {
        Row: {
          created_at: string
          display_name: string
          invite_code_id: string | null
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          invite_code_id?: string | null
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          invite_code_id?: string | null
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_coverage_assignees: {
        Args: never
        Returns: {
          board_count: number
          id: string
          label: string
          note: string
          ranges: Json
          updated_at: string
        }[]
      }
      admin_coverage_boards: {
        Args: never
        Returns: {
          address: string
          assignee_labels: string[]
          board_id: string
          chome: string
          coverage: string
          lat: number
          long: number
          name: string
          number: string
          school: string
          school_source: string
          status: Database["public"]["Enums"]["poster_board_status"]
          town: string
          ward: string
        }[]
      }
      admin_coverage_summary: {
        Args: never
        Returns: {
          assigned: number
          assignee_labels: string[]
          chome: string
          none: number
          reserved: number
          school: string
          total: number
          town: string
          unit: string
          ward: string
        }[]
      }
      admin_create_coverage_assignee: {
        Args: { p_label: string; p_note: string; p_ranges: Json }
        Returns: string
      }
      admin_dangerous_boards: {
        Args: never
        Returns: {
          board_id: string
          name: string
          note: string
          number: string
          reported_at: string
          reported_by: string
          ward: string
        }[]
      }
      admin_delete_coverage_assignee: {
        Args: { p_expected_updated_at: string; p_id: string }
        Returns: undefined
      }
      admin_list_invite_codes: {
        Args: never
        Returns: {
          active_volunteers: number
          created_at: string
          has_code: boolean
          id: string
          label: string
          revoked_at: string
          volunteers: number
        }[]
      }
      admin_publish: { Args: { p_confirm: string }; Returns: undefined }
      admin_recent_audit_log: {
        Args: never
        Returns: {
          action: string
          actor_email: string
          created_at: string
          id: number
          target: string
        }[]
      }
      admin_recent_reports: {
        Args: never
        Returns: {
          board_id: string
          created_at: string
          display_name: string
          history_id: string
          new_status: Database["public"]["Enums"]["poster_board_status"]
          note: string
          number: string
          previous_status: Database["public"]["Enums"]["poster_board_status"]
          user_id: string
          ward: string
        }[]
      }
      admin_register_invite_code: {
        Args: { p_code: string; p_label: string }
        Returns: string
      }
      admin_reset_rehearsal: { Args: { p_confirm: string }; Returns: undefined }
      admin_reveal_invite_code: { Args: { p_id: string }; Returns: string }
      admin_revert_acceptance: {
        Args: { p_confirm: string }
        Returns: undefined
      }
      admin_revoke_invite_code: {
        Args: { p_id: string; p_revoke_volunteers: boolean }
        Returns: number
      }
      admin_set_force_hidden: {
        Args: { p_hidden: boolean }
        Returns: undefined
      }
      admin_site_state: {
        Args: never
        Returns: {
          accepted_at: string
          force_hidden: boolean
          is_public: boolean
          public_from: string
          public_until: string
          rehearsal_reset_until: string
          site_name: string
        }[]
      }
      admin_stale_reservations: {
        Args: never
        Returns: {
          board_id: string
          name: string
          number: string
          reserved_at: string
          reserved_by: string
          ward: string
        }[]
      }
      admin_update_coverage_assignee: {
        Args: {
          p_expected_updated_at: string
          p_id: string
          p_label: string
          p_note: string
          p_ranges: Json
        }
        Returns: undefined
      }
      admin_ward_progress: {
        Args: never
        Returns: {
          done: number
          planned: number
          total: number
          ward: string
        }[]
      }
      admin_whoami: { Args: never; Returns: string }
      current_site_name: { Args: never; Returns: string }
      is_active_volunteer: { Args: never; Returns: boolean }
      is_public_window: { Args: never; Returns: boolean }
      register_volunteer: {
        Args: { p_code: string; p_display_name: string }
        Returns: Database["public"]["CompositeTypes"]["register_volunteer_result"]
        SetofOptions: {
          from: "*"
          to: "register_volunteer_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_board_status: {
        Args: {
          p_board_id: string
          p_note?: string
          p_status: Database["public"]["Enums"]["poster_board_status"]
        }
        Returns: {
          address: string
          created_at: string
          id: string
          lat: number
          long: number
          name: string
          number: string
          status: Database["public"]["Enums"]["poster_board_status"]
          updated_at: string
          ward: string
        }
        SetofOptions: {
          from: "*"
          to: "poster_boards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      poster_board_status:
        | "not_yet"
        | "not_yet_dangerous"
        | "reserved"
        | "done"
        | "error_wrong_poster"
        | "other"
    }
    CompositeTypes: {
      register_volunteer_result: {
        display_name: string | null
        error: string | null
      }
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
      poster_board_status: [
        "not_yet",
        "not_yet_dangerous",
        "reserved",
        "done",
        "error_wrong_poster",
        "other",
      ],
    },
  },
} as const

