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
      is_active_volunteer: { Args: never; Returns: boolean }
      is_public_window: { Args: never; Returns: boolean }
      register_volunteer: {
        Args: { p_code: string; p_display_name: string }
        Returns: {
          created_at: string
          display_name: string
          invite_code_id: string | null
          revoked_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "volunteers"
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

