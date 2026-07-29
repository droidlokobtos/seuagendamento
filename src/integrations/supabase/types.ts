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
      appointment_confirmations: {
        Row: {
          appointment_id: string
          cancel_reason: string | null
          channel: string
          company_id: string
          created_at: string
          error: string | null
          expires_at: string
          id: string
          last_sent_at: string | null
          message: string | null
          responded_at: string | null
          response: string | null
          response_ip: string | null
          response_user_agent: string | null
          send_attempts: number
          send_url: string | null
          sent_at: string | null
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          cancel_reason?: string | null
          channel?: string
          company_id: string
          created_at?: string
          error?: string | null
          expires_at: string
          id?: string
          last_sent_at?: string | null
          message?: string | null
          responded_at?: string | null
          response?: string | null
          response_ip?: string | null
          response_user_agent?: string | null
          send_attempts?: number
          send_url?: string | null
          sent_at?: string | null
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          cancel_reason?: string | null
          channel?: string
          company_id?: string
          created_at?: string
          error?: string | null
          expires_at?: string
          id?: string
          last_sent_at?: string | null
          message?: string | null
          responded_at?: string | null
          response?: string | null
          response_ip?: string | null
          response_user_agent?: string | null
          send_attempts?: number
          send_url?: string | null
          sent_at?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_confirmations_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_confirmations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_payments: {
        Row: {
          amount_cents: number
          appointment_id: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          method: string | null
          notes: string | null
          proof_url: string | null
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          transaction_ref: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          appointment_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          method?: string | null
          notes?: string | null
          proof_url?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transaction_ref?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          appointment_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          method?: string | null
          notes?: string | null
          proof_url?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transaction_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          deposit_required_cents: number
          discount_cents: number
          ends_at: string
          id: string
          loyalty_credited_at: string | null
          loyalty_points_earned: number
          notes: string | null
          paid_cents: number
          payment_status: string
          staff_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          surcharge_cents: number
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
          deposit_required_cents?: number
          discount_cents?: number
          ends_at: string
          id?: string
          loyalty_credited_at?: string | null
          loyalty_points_earned?: number
          notes?: string | null
          paid_cents?: number
          payment_status?: string
          staff_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          surcharge_cents?: number
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
          deposit_required_cents?: number
          discount_cents?: number
          ends_at?: string
          id?: string
          loyalty_credited_at?: string | null
          loyalty_points_earned?: number
          notes?: string | null
          paid_cents?: number
          payment_status?: string
          staff_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          surcharge_cents?: number
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
      commissions: {
        Row: {
          appointment_id: string | null
          commission_cents: number
          commission_type: string
          commission_value: number
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          id: string
          notes: string | null
          occurred_at: string
          paid_at: string | null
          service_amount_cents: number
          service_id: string | null
          service_name: string | null
          staff_id: string | null
          staff_name: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          appointment_id?: string | null
          commission_cents?: number
          commission_type?: string
          commission_value?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          paid_at?: string | null
          service_amount_cents?: number
          service_id?: string | null
          service_name?: string | null
          staff_id?: string | null
          staff_name?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          appointment_id?: string | null
          commission_cents?: number
          commission_type?: string
          commission_value?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          paid_at?: string | null
          service_amount_cents?: number
          service_id?: string | null
          service_name?: string | null
          staff_id?: string | null
          staff_name?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_birthdays_this_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_staff_id_fkey"
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
          amenities: string[]
          app_icon_url: string | null
          banner_url: string | null
          buffer_min: number
          city: string | null
          created_at: string
          custom_domain: string | null
          deposit_enabled: boolean
          deposit_type: string
          deposit_value: number
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
          pix_bank: string | null
          pix_holder: string | null
          pix_key: string | null
          pix_qr_url: string | null
          primary_color: string
          responsible_name: string | null
          secondary_color: string
          short_description: string | null
          show_reviews_on_portal: boolean
          show_staff_on_portal: boolean
          slug: string
          state: string | null
          status: Database["public"]["Enums"]["company_status"]
          sub_niche_id: string | null
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
          amenities?: string[]
          app_icon_url?: string | null
          banner_url?: string | null
          buffer_min?: number
          city?: string | null
          created_at?: string
          custom_domain?: string | null
          deposit_enabled?: boolean
          deposit_type?: string
          deposit_value?: number
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
          pix_bank?: string | null
          pix_holder?: string | null
          pix_key?: string | null
          pix_qr_url?: string | null
          primary_color?: string
          responsible_name?: string | null
          secondary_color?: string
          short_description?: string | null
          show_reviews_on_portal?: boolean
          show_staff_on_portal?: boolean
          slug: string
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          sub_niche_id?: string | null
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
          amenities?: string[]
          app_icon_url?: string | null
          banner_url?: string | null
          buffer_min?: number
          city?: string | null
          created_at?: string
          custom_domain?: string | null
          deposit_enabled?: boolean
          deposit_type?: string
          deposit_value?: number
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
          pix_bank?: string | null
          pix_holder?: string | null
          pix_key?: string | null
          pix_qr_url?: string | null
          primary_color?: string
          responsible_name?: string | null
          secondary_color?: string
          short_description?: string | null
          show_reviews_on_portal?: boolean
          show_staff_on_portal?: boolean
          slug?: string
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          sub_niche_id?: string | null
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
          {
            foreignKeyName: "companies_sub_niche_id_fkey"
            columns: ["sub_niche_id"]
            isOneToOne: false
            referencedRelation: "sub_niches"
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
      customer_dates: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          date: string
          id: string
          kind: string
          notes: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          date: string
          id?: string
          kind?: string
          notes?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          date?: string
          id?: string
          kind?: string
          notes?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_dates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_dates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_birthdays_this_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_dates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          company_id: string
          content: string
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          kind: string
          pinned: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          kind?: string
          pinned?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          kind?: string
          pinned?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_birthdays_this_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_profile_history: {
        Row: {
          action: string
          actor_user_id: string | null
          company_id: string
          created_at: string
          customer_id: string
          entity: string
          field: string | null
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          company_id: string
          created_at?: string
          customer_id: string
          entity: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string
          entity?: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_profile_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_profiles: {
        Row: {
          communication_pref: string
          company_id: string
          created_at: string
          customer_id: string
          general_notes: string | null
          preferred_staff_id: string | null
          restrictions: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          communication_pref?: string
          company_id: string
          created_at?: string
          customer_id: string
          general_notes?: string | null
          preferred_staff_id?: string | null
          restrictions?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          communication_pref?: string
          company_id?: string
          created_at?: string
          customer_id?: string
          general_notes?: string | null
          preferred_staff_id?: string | null
          restrictions?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_profiles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customer_birthdays_this_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_profiles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_profiles_preferred_staff_id_fkey"
            columns: ["preferred_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
          source: string | null
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
          source?: string | null
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
          source?: string | null
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
      financial_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          amount_cents: number
          appointment_id: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          payment_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          amount_cents?: number
          appointment_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          payment_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          amount_cents?: number
          appointment_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_audit_log_company_id_fkey"
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
          appointment_payment_id: string | null
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
          appointment_payment_id?: string | null
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
          appointment_payment_id?: string | null
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
            foreignKeyName: "financial_transactions_appointment_payment_id_fkey"
            columns: ["appointment_payment_id"]
            isOneToOne: false
            referencedRelation: "appointment_payments"
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
      gallery_photos: {
        Row: {
          category: string | null
          company_id: string
          created_at: string
          description: string | null
          featured: boolean
          id: string
          image_url: string
          sort_order: number
          title: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          image_url: string
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          image_url?: string
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      messaging_logs: {
        Row: {
          actor_user_id: string | null
          appointment_id: string | null
          channel: string | null
          company_id: string
          confirmation_id: string | null
          created_at: string
          detail: string | null
          event: string
          id: string
          ip: string | null
          status: string | null
          user_agent: string | null
        }
        Insert: {
          actor_user_id?: string | null
          appointment_id?: string | null
          channel?: string | null
          company_id: string
          confirmation_id?: string | null
          created_at?: string
          detail?: string | null
          event: string
          id?: string
          ip?: string | null
          status?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_user_id?: string | null
          appointment_id?: string | null
          channel?: string | null
          company_id?: string
          confirmation_id?: string | null
          created_at?: string
          detail?: string | null
          event?: string
          id?: string
          ip?: string | null
          status?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messaging_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaging_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaging_logs_confirmation_id_fkey"
            columns: ["confirmation_id"]
            isOneToOne: false
            referencedRelation: "appointment_confirmations"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_settings: {
        Row: {
          active_channels: string[]
          auto_confirmation_enabled: boolean
          company_id: string
          created_at: string
          email_api_token: string | null
          email_api_url: string | null
          email_from: string | null
          email_provider: string | null
          message_template: string | null
          reminder_hours: number
          sms_api_token: string | null
          sms_api_url: string | null
          sms_provider: string | null
          sms_sender: string | null
          updated_at: string
          whatsapp_api_token: string | null
          whatsapp_api_url: string | null
          whatsapp_instance: string | null
          whatsapp_provider: string | null
          whatsapp_sender: string | null
        }
        Insert: {
          active_channels?: string[]
          auto_confirmation_enabled?: boolean
          company_id: string
          created_at?: string
          email_api_token?: string | null
          email_api_url?: string | null
          email_from?: string | null
          email_provider?: string | null
          message_template?: string | null
          reminder_hours?: number
          sms_api_token?: string | null
          sms_api_url?: string | null
          sms_provider?: string | null
          sms_sender?: string | null
          updated_at?: string
          whatsapp_api_token?: string | null
          whatsapp_api_url?: string | null
          whatsapp_instance?: string | null
          whatsapp_provider?: string | null
          whatsapp_sender?: string | null
        }
        Update: {
          active_channels?: string[]
          auto_confirmation_enabled?: boolean
          company_id?: string
          created_at?: string
          email_api_token?: string | null
          email_api_url?: string | null
          email_from?: string | null
          email_provider?: string | null
          message_template?: string | null
          reminder_hours?: number
          sms_api_token?: string | null
          sms_api_url?: string | null
          sms_provider?: string | null
          sms_sender?: string | null
          updated_at?: string
          whatsapp_api_token?: string | null
          whatsapp_api_url?: string | null
          whatsapp_instance?: string | null
          whatsapp_provider?: string | null
          whatsapp_sender?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messaging_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
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
          review_expiration_days: number
          updated_at: string
        }
        Insert: {
          id?: boolean
          pix_bank?: string | null
          pix_holder?: string | null
          pix_key?: string | null
          platform_name?: string
          review_expiration_days?: number
          updated_at?: string
        }
        Update: {
          id?: boolean
          pix_bank?: string | null
          pix_holder?: string | null
          pix_key?: string | null
          platform_name?: string
          review_expiration_days?: number
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
      review_invites: {
        Row: {
          appointment_id: string
          channel: string | null
          company_id: string
          created_at: string
          customer_id: string | null
          error: string | null
          expires_at: string
          id: string
          last_sent_at: string | null
          message: string | null
          rating: number | null
          responded_at: string | null
          response_ip: string | null
          response_user_agent: string | null
          review_id: string | null
          send_attempts: number
          send_url: string | null
          sent_at: string | null
          staff_id: string | null
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          channel?: string | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          error?: string | null
          expires_at: string
          id?: string
          last_sent_at?: string | null
          message?: string | null
          rating?: number | null
          responded_at?: string | null
          response_ip?: string | null
          response_user_agent?: string | null
          review_id?: string | null
          send_attempts?: number
          send_url?: string | null
          sent_at?: string | null
          staff_id?: string | null
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          channel?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          error?: string | null
          expires_at?: string
          id?: string
          last_sent_at?: string | null
          message?: string | null
          rating?: number | null
          responded_at?: string | null
          response_ip?: string | null
          response_user_agent?: string | null
          review_id?: string | null
          send_attempts?: number
          send_url?: string | null
          sent_at?: string | null
          staff_id?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_invites_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_invites_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_birthdays_this_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_invites_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_invites_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_invites_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      review_logs: {
        Row: {
          appointment_id: string | null
          channel: string | null
          comment: string | null
          company_id: string
          created_at: string
          customer_id: string | null
          detail: string | null
          event: string
          id: string
          invite_id: string | null
          ip: string | null
          rating: number | null
          review_id: string | null
          user_agent: string | null
        }
        Insert: {
          appointment_id?: string | null
          channel?: string | null
          comment?: string | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          detail?: string | null
          event: string
          id?: string
          invite_id?: string | null
          ip?: string | null
          rating?: number | null
          review_id?: string | null
          user_agent?: string | null
        }
        Update: {
          appointment_id?: string | null
          channel?: string | null
          comment?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          detail?: string | null
          event?: string
          id?: string
          invite_id?: string | null
          ip?: string | null
          rating?: number | null
          review_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_logs_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "review_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_logs_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_settings: {
        Row: {
          active_channels: string[]
          auto_send_enabled: boolean
          company_id: string
          created_at: string
          expiration_days: number
          google_review_url: string | null
          message_template: string | null
          updated_at: string
        }
        Insert: {
          active_channels?: string[]
          auto_send_enabled?: boolean
          company_id: string
          created_at?: string
          expiration_days?: number
          google_review_url?: string | null
          message_template?: string | null
          updated_at?: string
        }
        Update: {
          active_channels?: string[]
          auto_send_enabled?: boolean
          company_id?: string
          created_at?: string
          expiration_days?: number
          google_review_url?: string | null
          message_template?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          appointment_id: string | null
          comment: string | null
          company_id: string
          created_at: string
          customer_id: string | null
          id: string
          invite_id: string | null
          ip: string | null
          published: boolean
          rating: number
          service_names: string | null
          source: string | null
          staff_id: string | null
          staff_rating: number | null
          updated_at: string
          user_agent: string | null
          would_recommend: boolean | null
          would_return: boolean | null
        }
        Insert: {
          appointment_id?: string | null
          comment?: string | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          id?: string
          invite_id?: string | null
          ip?: string | null
          published?: boolean
          rating: number
          service_names?: string | null
          source?: string | null
          staff_id?: string | null
          staff_rating?: number | null
          updated_at?: string
          user_agent?: string | null
          would_recommend?: boolean | null
          would_return?: boolean | null
        }
        Update: {
          appointment_id?: string | null
          comment?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          invite_id?: string | null
          ip?: string | null
          published?: boolean
          rating?: number
          service_names?: string | null
          source?: string | null
          staff_id?: string | null
          staff_rating?: number | null
          updated_at?: string
          user_agent?: string | null
          would_recommend?: boolean | null
          would_return?: boolean | null
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
            foreignKeyName: "reviews_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "review_invites"
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
          commission_type: string
          commission_value: number
          company_id: string
          created_at: string
          description: string | null
          duration_min: number
          has_commission: boolean
          id: string
          name: string
          photo_position: string
          photo_url: string | null
          price_cents: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          color?: string | null
          commission_type?: string
          commission_value?: number
          company_id: string
          created_at?: string
          description?: string | null
          duration_min?: number
          has_commission?: boolean
          id?: string
          name: string
          photo_position?: string
          photo_url?: string | null
          price_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          color?: string | null
          commission_type?: string
          commission_value?: number
          company_id?: string
          created_at?: string
          description?: string | null
          duration_min?: number
          has_commission?: boolean
          id?: string
          name?: string
          photo_position?: string
          photo_url?: string | null
          price_cents?: number
          sort_order?: number
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
      sub_niches: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          niche_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          niche_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          niche_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_niches_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
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
      whatsapp_integrations: {
        Row: {
          api_token: string | null
          api_url: string | null
          auto_send_enabled: boolean
          company_id: string
          connected_at: string | null
          created_at: string
          device_name: string | null
          last_activity_at: string | null
          last_error: string | null
          last_sync_at: string | null
          max_attempts: number
          phone_number: string | null
          provider: string
          reminder_offsets_hours: number[]
          session_ref: string | null
          status: string
          updated_at: string
        }
        Insert: {
          api_token?: string | null
          api_url?: string | null
          auto_send_enabled?: boolean
          company_id: string
          connected_at?: string | null
          created_at?: string
          device_name?: string | null
          last_activity_at?: string | null
          last_error?: string | null
          last_sync_at?: string | null
          max_attempts?: number
          phone_number?: string | null
          provider?: string
          reminder_offsets_hours?: number[]
          session_ref?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          api_token?: string | null
          api_url?: string | null
          auto_send_enabled?: boolean
          company_id?: string
          connected_at?: string | null
          created_at?: string
          device_name?: string | null
          last_activity_at?: string | null
          last_error?: string | null
          last_sync_at?: string | null
          max_attempts?: number
          phone_number?: string | null
          provider?: string
          reminder_offsets_hours?: number[]
          session_ref?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          appointment_id: string | null
          attempts: number
          company_id: string
          content: string
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          error: string | null
          event: string
          id: string
          max_attempts: number
          provider: string
          scheduled_for: string
          sent_at: string | null
          status: string
          to_phone: string | null
          updated_at: string
          wa_url: string | null
        }
        Insert: {
          appointment_id?: string | null
          attempts?: number
          company_id: string
          content: string
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          error?: string | null
          event: string
          id?: string
          max_attempts?: number
          provider?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          to_phone?: string | null
          updated_at?: string
          wa_url?: string | null
        }
        Update: {
          appointment_id?: string | null
          attempts?: number
          company_id?: string
          content?: string
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          error?: string | null
          event?: string
          id?: string
          max_attempts?: number
          provider?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          to_phone?: string | null
          updated_at?: string
          wa_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          body: string
          company_id: string
          created_at: string
          enabled: boolean
          event: string
          id: string
          updated_at: string
        }
        Insert: {
          body: string
          company_id: string
          created_at?: string
          enabled?: boolean
          event: string
          id?: string
          updated_at?: string
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          enabled?: boolean
          event?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      recalc_appointment_finance: {
        Args: { _appt: string }
        Returns: undefined
      }
      reorder_services: {
        Args: { _company: string; _ids: string[] }
        Returns: undefined
      }
      sync_appointment_commissions: {
        Args: { _appt: string }
        Returns: undefined
      }
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
        | "reminder_sent"
        | "cancelled_by_customer"
        | "cancelled_by_company"
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
        "reminder_sent",
        "cancelled_by_customer",
        "cancelled_by_company",
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
