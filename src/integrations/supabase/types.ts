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
      appointment_services: {
        Row: {
          appointment_id: string
          duration_min: number
          id: string
          price_cents: number
          service_id: string
        }
        Insert: {
          appointment_id: string
          duration_min?: number
          id?: string
          price_cents?: number
          service_id: string
        }
        Update: {
          appointment_id?: string
          duration_min?: number
          id?: string
          price_cents?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_services_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string | null
          ends_at: string
          id: string
          notes: string | null
          staff_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          total_cents: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id?: string | null
          ends_at: string
          id?: string
          notes?: string | null
          staff_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          total_cents?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string | null
          ends_at?: string
          id?: string
          notes?: string | null
          staff_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          banner_url: string | null
          created_at: string
          document: string | null
          due_day: number
          email: string | null
          id: string
          last_payment_at: string | null
          legal_name: string | null
          logo_url: string | null
          monthly_fee: number
          name: string
          next_due_at: string | null
          niche_id: string | null
          phone: string | null
          primary_color: string
          responsible_name: string | null
          secondary_color: string
          slug: string
          status: Database["public"]["Enums"]["company_status"]
          suspended_at: string | null
          theme: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          banner_url?: string | null
          created_at?: string
          document?: string | null
          due_day?: number
          email?: string | null
          id?: string
          last_payment_at?: string | null
          legal_name?: string | null
          logo_url?: string | null
          monthly_fee?: number
          name: string
          next_due_at?: string | null
          niche_id?: string | null
          phone?: string | null
          primary_color?: string
          responsible_name?: string | null
          secondary_color?: string
          slug: string
          status?: Database["public"]["Enums"]["company_status"]
          suspended_at?: string | null
          theme?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          banner_url?: string | null
          created_at?: string
          document?: string | null
          due_day?: number
          email?: string | null
          id?: string
          last_payment_at?: string | null
          legal_name?: string | null
          logo_url?: string | null
          monthly_fee?: number
          name?: string
          next_due_at?: string | null
          niche_id?: string | null
          phone?: string | null
          primary_color?: string
          responsible_name?: string | null
          secondary_color?: string
          slug?: string
          status?: Database["public"]["Enums"]["company_status"]
          suspended_at?: string | null
          theme?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
        ]
      }
      company_hours: {
        Row: {
          closed: boolean
          company_id: string
          end_time: string
          id: string
          start_time: string
          weekday: number
        }
        Insert: {
          closed?: boolean
          company_id: string
          end_time?: string
          id?: string
          start_time?: string
          weekday: number
        }
        Update: {
          closed?: boolean
          company_id?: string
          end_time?: string
          id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_hours_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_users: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          birthdate: string | null
          company_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          birthdate?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          birthdate?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      niches: {
        Row: {
          banner_url: string | null
          created_at: string
          icon: string | null
          id: string
          logo_url: string | null
          name: string
          primary_color: string
          suggested_services: Json
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string
          suggested_services?: Json
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string
          suggested_services?: Json
          updated_at?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          company_id: string
          enabled: boolean
          id: string
          method: Database["public"]["Enums"]["payment_method_kind"]
        }
        Insert: {
          company_id: string
          enabled?: boolean
          id?: string
          method: Database["public"]["Enums"]["payment_method_kind"]
        }
        Update: {
          company_id?: string
          enabled?: boolean
          id?: string
          method?: Database["public"]["Enums"]["payment_method_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          paid_at: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          paid_at?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          paid_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          id: boolean
          pix_bank: string | null
          pix_holder: string | null
          pix_key: string | null
          platform_name: string
          updated_at: string
        }
        Insert: {
          id?: boolean
          pix_bank?: string | null
          pix_holder?: string | null
          pix_key?: string | null
          platform_name?: string
          updated_at?: string
        }
        Update: {
          id?: boolean
          pix_bank?: string | null
          pix_holder?: string | null
          pix_key?: string | null
          platform_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          category: string | null
          color: string | null
          company_id: string
          created_at: string
          description: string | null
          duration_min: number
          id: string
          name: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          color?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          name: string
          price_cents?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          color?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          name?: string
          price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          active: boolean
          color: string | null
          commission_pct: number | null
          company_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          photo_url: string | null
          role_title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          color?: string | null
          commission_pct?: number | null
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          photo_url?: string | null
          role_title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          color?: string | null
          commission_pct?: number | null
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          photo_url?: string | null
          role_title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_schedules: {
        Row: {
          end_time: string
          id: string
          staff_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          end_time: string
          id?: string
          staff_id: string
          start_time: string
          weekday: number
        }
        Update: {
          end_time?: string
          id?: string
          staff_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_schedules_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_services: {
        Row: {
          service_id: string
          staff_id: string
        }
        Insert: {
          service_id: string
          staff_id: string
        }
        Update: {
          service_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_services_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
      is_company_member: { Args: { _company: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      user_company_ids: { Args: { _user_id: string }; Returns: string[] }
    }
    Enums: {
      app_role: "super_admin" | "company_admin" | "staff" | "customer"
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
      company_status: "active" | "due_soon" | "overdue" | "suspended"
      payment_method_kind:
        | "cash"
        | "pix"
        | "credit_card"
        | "debit_card"
        | "bank_transfer"
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
      app_role: ["super_admin", "company_admin", "staff", "customer"],
      appointment_status: [
        "scheduled",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      company_status: ["active", "due_soon", "overdue", "suspended"],
      payment_method_kind: [
        "cash",
        "pix",
        "credit_card",
        "debit_card",
        "bank_transfer",
        "other",
      ],
    },
  },
} as const
