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
      admin_access_logs: {
        Row: {
          created_at: string
          email: string | null
          event: string
          id: string
          ip: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      appointment_reminders: {
        Row: {
          appointment_id: string
          channel: string
          company_id: string
          created_at: string
          id: string
          kind: string
          scheduled_for: string
          sent_at: string | null
        }
        Insert: {
          appointment_id: string
          channel?: string
          company_id: string
          created_at?: string
          id?: string
          kind: string
          scheduled_for: string
          sent_at?: string | null
        }
        Update: {
          appointment_id?: string
          channel?: string
          company_id?: string
          created_at?: string
          id?: string
          kind?: string
          scheduled_for?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_reminders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
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
          cashback_earned_cents: number
          company_id: string
          coupon_code: string | null
          coupon_id: string | null
          created_at: string
          customer_id: string | null
          discount_cents: number
          ends_at: string
          id: string
          loyalty_credited_at: string | null
          loyalty_points_earned: number
          notes: string | null
          staff_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          total_cents: number
          updated_at: string
        }
        Insert: {
          cashback_earned_cents?: number
          company_id: string
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_id?: string | null
          discount_cents?: number
          ends_at: string
          id?: string
          loyalty_credited_at?: string | null
          loyalty_points_earned?: number
          notes?: string | null
          staff_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          total_cents?: number
          updated_at?: string
        }
        Update: {
          cashback_earned_cents?: number
          company_id?: string
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_id?: string | null
          discount_cents?: number
          ends_at?: string
          id?: string
          loyalty_credited_at?: string | null
          loyalty_points_earned?: number
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
            foreignKeyName: "appointments_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_birthdays_this_month"
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
      campaigns: {
        Row: {
          audience: string
          channel: string
          company_id: string
          created_at: string
          id: string
          message: string
          recipients_count: number
          scheduled_for: string | null
          sent_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          channel?: string
          company_id: string
          created_at?: string
          id?: string
          message: string
          recipients_count?: number
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          channel?: string
          company_id?: string
          created_at?: string
          id?: string
          message?: string
          recipients_count?: number
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          app_icon_url: string | null
          banner_url: string | null
          buffer_min: number
          city: string | null
          created_at: string
          custom_domain: string | null
          description: string | null
          document: string | null
          due_day: number
          email: string | null
          facebook_url: string | null
          id: string
          instagram_url: string | null
          last_payment_at: string | null
          latitude: number | null
          legal_name: string | null
          listed_in_marketplace: boolean
          logo_url: string | null
          longitude: number | null
          max_advance_days: number
          min_advance_min: number
          monthly_fee: number
          name: string
          next_due_at: string | null
          niche_id: string | null
          online_booking_enabled: boolean
          parent_company_id: string | null
          phone: string | null
          primary_color: string
          responsible_name: string | null
          secondary_color: string
          short_description: string | null
          show_reviews_on_portal: boolean
          show_staff_on_portal: boolean
          slug: string
          state: string | null
          status: Database["public"]["Enums"]["company_status"]
          suspended_at: string | null
          theme: string
          tiktok_url: string | null
          updated_at: string
          website_url: string | null
          welcome_message: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          app_icon_url?: string | null
          banner_url?: string | null
          buffer_min?: number
          city?: string | null
          created_at?: string
          custom_domain?: string | null
          description?: string | null
          document?: string | null
          due_day?: number
          email?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          last_payment_at?: string | null
          latitude?: number | null
          legal_name?: string | null
          listed_in_marketplace?: boolean
          logo_url?: string | null
          longitude?: number | null
          max_advance_days?: number
          min_advance_min?: number
          monthly_fee?: number
          name: string
          next_due_at?: string | null
          niche_id?: string | null
          online_booking_enabled?: boolean
          parent_company_id?: string | null
          phone?: string | null
          primary_color?: string
          responsible_name?: string | null
          secondary_color?: string
          short_description?: string | null
          show_reviews_on_portal?: boolean
          show_staff_on_portal?: boolean
          slug: string
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          suspended_at?: string | null
          theme?: string
          tiktok_url?: string | null
          updated_at?: string
          website_url?: string | null
          welcome_message?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          app_icon_url?: string | null
          banner_url?: string | null
          buffer_min?: number
          city?: string | null
          created_at?: string
          custom_domain?: string | null
          description?: string | null
          document?: string | null
          due_day?: number
          email?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          last_payment_at?: string | null
          latitude?: number | null
          legal_name?: string | null
          listed_in_marketplace?: boolean
          logo_url?: string | null
          longitude?: number | null
          max_advance_days?: number
          min_advance_min?: number
          monthly_fee?: number
          name?: string
          next_due_at?: string | null
          niche_id?: string | null
          online_booking_enabled?: boolean
          parent_company_id?: string | null
          phone?: string | null
          primary_color?: string
          responsible_name?: string | null
          secondary_color?: string
          short_description?: string | null
          show_reviews_on_portal?: boolean
          show_staff_on_portal?: boolean
          slug?: string
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          suspended_at?: string | null
          theme?: string
          tiktok_url?: string | null
          updated_at?: string
          website_url?: string | null
          welcome_message?: string | null
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
          {
            foreignKeyName: "companies_parent_company_id_fkey"
            columns: ["parent_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      coupons: {
        Row: {
          active: boolean
          code: string
          company_id: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          max_uses: number | null
          updated_at: string
          used_count: number
          uses_count: number
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          code: string
          company_id: string
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value: number
          id?: string
          max_uses?: number | null
          updated_at?: string
          used_count?: number
          uses_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          max_uses?: number | null
          updated_at?: string
          used_count?: number
          uses_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_company_id_fkey"
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
          photo_url: string | null
          tags: string[] | null
          updated_at: string
          user_id: string | null
          whatsapp: string | null
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
          photo_url?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
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
          photo_url?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
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
      financial_transactions: {
        Row: {
          amount: number
          appointment_id: string | null
          category: string
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          occurred_on: string
          payment_method_id: string | null
          staff_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          category: string
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          occurred_on?: string
          payment_method_id?: string | null
          staff_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          category?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          occurred_on?: string
          payment_method_id?: string | null
          staff_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          appointment_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          quantity: number
          reason: string | null
          type: Database["public"]["Enums"]["movement_type"]
          unit_cost: number | null
        }
        Insert: {
          appointment_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          quantity: number
          reason?: string | null
          type: Database["public"]["Enums"]["movement_type"]
          unit_cost?: number | null
        }
        Update: {
          appointment_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          quantity?: number
          reason?: string | null
          type?: Database["public"]["Enums"]["movement_type"]
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_programs: {
        Row: {
          active: boolean
          cashback_percent: number
          company_id: string
          created_at: string
          id: string
          min_points_redeem: number
          point_value_brl: number
          points_per_brl: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          cashback_percent?: number
          company_id: string
          created_at?: string
          id?: string
          min_points_redeem?: number
          point_value_brl?: number
          points_per_brl?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          cashback_percent?: number
          company_id?: string
          created_at?: string
          id?: string
          min_points_redeem?: number
          point_value_brl?: number
          points_per_brl?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_programs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_rewards: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          points_cost: number
          stock: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          points_cost: number
          stock?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          points_cost?: number
          stock?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_rewards_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          cashback_amount: number
          company_id: string
          created_at: string
          customer_id: string
          id: string
          kind: string
          notes: string | null
          points: number
          reference: string | null
        }
        Insert: {
          cashback_amount?: number
          company_id: string
          created_at?: string
          customer_id: string
          id?: string
          kind: string
          notes?: string | null
          points?: number
          reference?: string | null
        }
        Update: {
          cashback_amount?: number
          company_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          kind?: string
          notes?: string | null
          points?: number
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_birthdays_this_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
      notifications: {
        Row: {
          body: string | null
          company_id: string
          created_at: string
          id: string
          kind: string
          link: string | null
          metadata: Json | null
          read_at: string | null
          title: string
        }
        Insert: {
          body?: string | null
          company_id: string
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          metadata?: Json | null
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string | null
          company_id?: string
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          metadata?: Json | null
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      products: {
        Row: {
          active: boolean
          brand: string | null
          company_id: string
          cost_price: number
          created_at: string
          id: string
          min_stock: number
          name: string
          notes: string | null
          sale_price: number
          sku: string | null
          stock_qty: number
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand?: string | null
          company_id: string
          cost_price?: number
          created_at?: string
          id?: string
          min_stock?: number
          name: string
          notes?: string | null
          sale_price?: number
          sku?: string | null
          stock_qty?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand?: string | null
          company_id?: string
          cost_price?: number
          created_at?: string
          id?: string
          min_stock?: number
          name?: string
          notes?: string | null
          sale_price?: number
          sku?: string | null
          stock_qty?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          must_change_password: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          must_change_password?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          must_change_password?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          appointment_id: string | null
          comment: string | null
          company_id: string
          created_at: string
          customer_id: string | null
          id: string
          published: boolean
          rating: number
          staff_id: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          comment?: string | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          id?: string
          published?: boolean
          rating: number
          staff_id?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          comment?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          published?: boolean
          rating?: number
          staff_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_birthdays_this_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
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
          photo_url: string | null
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
          photo_url?: string | null
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
          photo_url?: string | null
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
      time_blocks: {
        Row: {
          company_id: string
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          staff_id: string | null
          starts_at: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          staff_id?: string | null
          starts_at: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          staff_id?: string | null
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_blocks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_blocks_staff_id_fkey"
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
      customer_birthdays_this_month: {
        Row: {
          birthdate: string | null
          company_id: string | null
          day: number | null
          email: string | null
          id: string | null
          name: string | null
          phone: string | null
        }
        Insert: {
          birthdate?: string | null
          company_id?: string | null
          day?: never
          email?: string | null
          id?: string | null
          name?: string | null
          phone?: string | null
        }
        Update: {
          birthdate?: string | null
          company_id?: string | null
          day?: never
          email?: string | null
          id?: string | null
          name?: string | null
          phone?: string | null
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
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_admin: { Args: { _company: string }; Returns: boolean }
      is_company_member: { Args: { _company: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      user_company_ids: { Args: { _user_id: string }; Returns: string[] }
      validate_coupon: {
        Args: { _code: string; _company: string; _subtotal_cents: number }
        Returns: {
          code: string
          discount_cents: number
          discount_type: string
          discount_value: number
          id: string
          message: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "company_admin"
        | "staff"
        | "customer"
        | "receptionist"
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
      company_status: "active" | "due_soon" | "overdue" | "suspended"
      movement_type: "in" | "out" | "adjustment"
      payment_method_kind:
        | "cash"
        | "pix"
        | "credit_card"
        | "debit_card"
        | "bank_transfer"
        | "other"
      transaction_type: "income" | "expense"
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
      app_role: [
        "super_admin",
        "company_admin",
        "staff",
        "customer",
        "receptionist",
      ],
      appointment_status: [
        "scheduled",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      company_status: ["active", "due_soon", "overdue", "suspended"],
      movement_type: ["in", "out", "adjustment"],
      payment_method_kind: [
        "cash",
        "pix",
        "credit_card",
        "debit_card",
        "bank_transfer",
        "other",
      ],
      transaction_type: ["income", "expense"],
    },
  },
} as const
