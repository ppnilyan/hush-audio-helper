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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      credit_packs: {
        Row: {
          created_at: string
          credits: number
          id: string
          price_cents: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          credits: number
          id: string
          price_cents: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          credits?: number
          id?: string
          price_cents?: number
          sort_order?: number
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount_cents: number
          created_at: string
          credits: number
          id: string
          kind: string
          mode: string
          note: string | null
          user_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          credits?: number
          id?: string
          kind: string
          mode?: string
          note?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          credits?: number
          id?: string
          kind?: string
          mode?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      credit_wallets: {
        Row: {
          created_at: string
          fake_balance_cents: number | null
          purchased_credits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fake_balance_cents?: number | null
          purchased_credits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fake_balance_cents?: number | null
          purchased_credits?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      faq_questions: {
        Row: {
          answer: string | null
          created_at: string
          expires_at: string | null
          id: string
          initials: string
          published_at: string | null
          question: string
          status: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          initials?: string
          published_at?: string | null
          question: string
          status?: string
          user_id: string
        }
        Update: {
          answer?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          initials?: string
          published_at?: string | null
          question?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      generation_jobs: {
        Row: {
          created_at: string
          credits: number
          from_monthly: number
          from_purchased: number
          history_count_before: number
          id: string
          settled_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          from_monthly?: number
          from_purchased?: number
          history_count_before?: number
          id?: string
          settled_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          from_monthly?: number
          from_purchased?: number
          history_count_before?: number
          id?: string
          settled_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      montage_history: {
        Row: {
          created_at: string
          duration: number
          expires_at: string
          ext: string
          id: string
          mime: string
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration?: number
          expires_at?: string
          ext?: string
          id?: string
          mime?: string
          size_bytes?: number
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration?: number
          expires_at?: string
          ext?: string
          id?: string
          mime?: string
          size_bytes?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      montage_presets: {
        Row: {
          created_at: string
          id: string
          name: string
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          allow_advanced: boolean
          allow_all_themes: boolean
          allow_import_music: boolean
          created_at: string
          id: string
          monthly_credits: number
          name: string
          price_cents: number
          sort_order: number
        }
        Insert: {
          allow_advanced?: boolean
          allow_all_themes?: boolean
          allow_import_music?: boolean
          created_at?: string
          id: string
          monthly_credits: number
          name: string
          price_cents: number
          sort_order?: number
        }
        Update: {
          allow_advanced?: boolean
          allow_all_themes?: boolean
          allow_import_music?: boolean
          created_at?: string
          id?: string
          monthly_credits?: number
          name?: string
          price_cents?: number
          sort_order?: number
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          percent_off: number
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          percent_off: number
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          percent_off?: number
          uses?: number
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          created_at: string
          id: string
          type: string
        }
        Insert: {
          created_at?: string
          id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: string
        }
        Relationships: []
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
      user_settings: {
        Row: {
          created_at: string
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_start: string
          mode: string
          monthly_credits_remaining: number
          plan_id: string
          renews_at: string
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_start?: string
          mode?: string
          monthly_credits_remaining?: number
          plan_id: string
          renews_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_start?: string
          mode?: string
          monthly_credits_remaining?: number
          plan_id?: string
          renews_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      billing_ensure: { Args: { _uid: string }; Returns: undefined }
      billing_state: { Args: never; Returns: Json }
      consume_credits: { Args: { _amount: number }; Returns: Json }
      fake_buy_pack: {
        Args: { _pack_id: string; _promo_code?: string }
        Returns: undefined
      }
      fake_cancel: { Args: never; Returns: undefined }
      fake_subscribe: {
        Args: { _plan_id: string; _promo_code?: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      promo_create: { Args: { _code: string; _percent: number }; Returns: Json }
      promo_delete: { Args: { _code: string }; Returns: undefined }
      promo_lookup: { Args: { _code: string }; Returns: Json }
      refund_credits: {
        Args: { _from_monthly: number; _from_purchased: number }
        Returns: undefined
      }
      stripe_apply_pack: {
        Args: {
          _amount_cents: number
          _mode: string
          _pack_id: string
          _user_id: string
        }
        Returns: undefined
      }
      stripe_apply_subscription: {
        Args: {
          _amount_cents: number
          _cancel_at_period_end: boolean
          _mode: string
          _period_start: string
          _plan_id: string
          _renews_at: string
          _stripe_customer_id: string
          _stripe_price_id: string
          _stripe_subscription_id: string
          _user_id: string
        }
        Returns: undefined
      }
      stripe_end_subscription: {
        Args: { _stripe_subscription_id: string }
        Returns: undefined
      }
      stripe_mark_cancel_at_period_end: {
        Args: { _cancel: boolean; _stripe_subscription_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
