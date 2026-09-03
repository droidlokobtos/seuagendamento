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
      ai_alert_events: {
        Row: {
          action: string
          alert_id: string
          alert_key: string
          company_id: string
          created_at: string
          description: string
          event_type: string
          id: string
          metric: string | null
          severity: string
          snapshot: Json
          title: string
        }
        Insert: {
          action: string
          alert_id: string
          alert_key: string
          company_id: string
          created_at?: string
          description: string
          event_type: string
          id?: string
          metric?: string | null
          severity: string
          snapshot?: Json
          title: string
        }
        Update: {
          action?: string
          alert_id?: string
          alert_key?: string
          company_id?: string
          created_at?: string
          description?: string
          event_type?: string
          id?: string
          metric?: string | null
          severity?: string
          snapshot?: Json
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_alert_events_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "ai_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_alert_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_alert_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_alerts: {
        Row: {
          action: string
          alert_key: string
          company_id: string
          created_at: string
          description: string
          first_seen_at: string
          id: string
          last_event_at: string
          last_seen_at: string
          metric: string | null
          occurrence_count: number
          reopened_count: number
          resolved_at: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          action: string
          alert_key: string
          company_id: string
          created_at?: string
          description: string
          first_seen_at?: string
          id?: string
          last_event_at?: string
          last_seen_at?: string
          metric?: string | null
          occurrence_count?: number
          reopened_count?: number
          resolved_at?: string | null
          severity: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          action?: string
          alert_key?: string
          company_id?: string
          created_at?: string
          description?: string
          first_seen_at?: string
          id?: string
          last_event_at?: string
          last_seen_at?: string
          metric?: string | null
          occurrence_count?: number
          reopened_count?: number
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnesis_access_log: {
        Row: {
          action: string
          actor_user_id: string | null
          company_id: string
          created_at: string
          customer_id: string | null
          detail: string | null
          id: string
          record_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          detail?: string | null
          id?: string
          record_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          detail?: string | null
          id?: string
          record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anamnesis_access_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnesis_access_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnesis_records: {
        Row: {
          actor_user_id: string | null
          alerts: string[]
          answers: Json
          appointment_id: string | null
          company_id: string
          consent_lgpd: boolean
          consent_procedure: boolean
          consent_truth: boolean
          created_at: string
          customer_id: string
          filled_at: string
          filled_by: string
          id: string
          sections: string[]
          signature_data: string | null
          updated_at: string
        }
        Insert: {
          actor_user_id?: string | null
          alerts?: string[]
          answers?: Json
          appointment_id?: string | null
          company_id: string
          consent_lgpd?: boolean
          consent_procedure?: boolean
          consent_truth?: boolean
          created_at?: string
          customer_id: string
          filled_at?: string
          filled_by?: string
          id?: string
          sections?: string[]
          signature_data?: string | null
          updated_at?: string
        }
        Update: {
          actor_user_id?: string | null
          alerts?: string[]
          answers?: Json
          appointment_id?: string | null
          company_id?: string
          consent_lgpd?: boolean
          consent_procedure?: boolean
          consent_truth?: boolean
          created_at?: string
          customer_id?: string
          filled_at?: string
          filled_by?: string
          id?: string
          sections?: string[]
          signature_data?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnesis_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnesis_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnesis_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnesis_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_birthdays_this_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnesis_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "appointment_confirmations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
          {
            foreignKeyName: "appointment_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_products: {
        Row: {
          appointment_id: string
          company_id: string
          created_at: string
          discount_cents: number
          id: string
          product_id: string
          quantity: number
          unit_price_cents: number
        }
        Insert: {
          appointment_id: string
          company_id: string
          created_at?: string
          discount_cents?: number
          id?: string
          product_id: string
          quantity?: number
          unit_price_cents?: number
        }
        Update: {
          appointment_id?: string
          company_id?: string
          created_at?: string
          discount_cents?: number
          id?: string
          product_id?: string
          quantity?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "appointment_products_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          {
            foreignKeyName: "appointment_reminders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
          completed_at: string | null
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
          completed_at?: string | null
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
          completed_at?: string | null
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
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
      attendance_events: {
        Row: {
          amount_cents: number
          appointment_id: string | null
          company_id: string
          created_at: string
          customer_id: string
          event: string
          hours_before: number | null
          id: string
          notes: string | null
          occurred_at: string
          scheduled_for: string | null
        }
        Insert: {
          amount_cents?: number
          appointment_id?: string | null
          company_id: string
          created_at?: string
          customer_id: string
          event: string
          hours_before?: number | null
          id?: string
          notes?: string | null
          occurred_at?: string
          scheduled_for?: string | null
        }
        Update: {
          amount_cents?: number
          appointment_id?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string
          event?: string
          hours_before?: number | null
          id?: string
          notes?: string | null
          occurred_at?: string
          scheduled_for?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_birthdays_this_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_settings: {
        Row: {
          attention_score: number
          company_id: string
          created_at: string
          late_cancel_hours: number
          lookback_days: number
          min_no_shows_for_action: number
          reminder_offsets_hours: number[]
          risk_action: string
          risk_score: number
          updated_at: string
          waitlist_enabled: boolean
          waitlist_hold_minutes: number
          weight_cancel: number
          weight_completed: number
          weight_late_cancel: number
          weight_no_show: number
        }
        Insert: {
          attention_score?: number
          company_id: string
          created_at?: string
          late_cancel_hours?: number
          lookback_days?: number
          min_no_shows_for_action?: number
          reminder_offsets_hours?: number[]
          risk_action?: string
          risk_score?: number
          updated_at?: string
          waitlist_enabled?: boolean
          waitlist_hold_minutes?: number
          weight_cancel?: number
          weight_completed?: number
          weight_late_cancel?: number
          weight_no_show?: number
        }
        Update: {
          attention_score?: number
          company_id?: string
          created_at?: string
          late_cancel_hours?: number
          lookback_days?: number
          min_no_shows_for_action?: number
          reminder_offsets_hours?: number[]
          risk_action?: string
          risk_score?: number
          updated_at?: string
          waitlist_enabled?: boolean
          waitlist_hold_minutes?: number
          weight_cancel?: number
          weight_completed?: number
          weight_late_cancel?: number
          weight_no_show?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          company_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      business_expenses: {
        Row: {
          amount_cents: number
          category: string
          company_id: string
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          financial_transaction_id: string | null
          id: string
          paid_at: string | null
          payment_method: string | null
          status: string
        }
        Insert: {
          amount_cents: number
          category?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          description: string
          due_date?: string | null
          financial_transaction_id?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          status?: string
        }
        Update: {
          amount_cents?: number
          category?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          financial_transaction_id?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_expenses_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
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
          {
            foreignKeyName: "campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          company_id: string
          counted_cents: number | null
          difference_cents: number | null
          expected_cents: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_cents: number
          status: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          company_id: string
          counted_cents?: number | null
          difference_cents?: number | null
          expected_cents?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_cents?: number
          status?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string
          counted_cents?: number | null
          difference_cents?: number | null
          expected_cents?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_cents?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          company_id: string
          created_at: string
          description: string | null
          entity: string
          entity_id: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          entity: string
          entity_id?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          entity?: string
          entity_id?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "commerce_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
            foreignKeyName: "commissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
          admin_notes: string | null
          amenities: string[]
          app_icon_url: string | null
          banner_url: string | null
          booking_slot_interval_min: number
          buffer_min: number
          city: string | null
          contracted_plan: string | null
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
          is_trial: boolean
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
          owner_name: string | null
          owner_whatsapp: string | null
          parent_company_id: string | null
          phone: string | null
          pix_bank: string | null
          pix_holder: string | null
          pix_key: string | null
          pix_qr_url: string | null
          plan_code: string | null
          plan_cycle_months: number | null
          portal_bg_style: string
          portal_bg_url: string | null
          portal_button_color: string | null
          portal_card_style: string
          portal_highlight: string
          portal_slogan: string | null
          portal_text_color: string | null
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
          trial_days: number | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          website_url: string | null
          welcome_message: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          amenities?: string[]
          app_icon_url?: string | null
          banner_url?: string | null
          booking_slot_interval_min?: number
          buffer_min?: number
          city?: string | null
          contracted_plan?: string | null
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
          is_trial?: boolean
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
          owner_name?: string | null
          owner_whatsapp?: string | null
          parent_company_id?: string | null
          phone?: string | null
          pix_bank?: string | null
          pix_holder?: string | null
          pix_key?: string | null
          pix_qr_url?: string | null
          plan_code?: string | null
          plan_cycle_months?: number | null
          portal_bg_style?: string
          portal_bg_url?: string | null
          portal_button_color?: string | null
          portal_card_style?: string
          portal_highlight?: string
          portal_slogan?: string | null
          portal_text_color?: string | null
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
          trial_days?: number | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          website_url?: string | null
          welcome_message?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          amenities?: string[]
          app_icon_url?: string | null
          banner_url?: string | null
          booking_slot_interval_min?: number
          buffer_min?: number
          city?: string | null
          contracted_plan?: string | null
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
          is_trial?: boolean
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
          owner_name?: string | null
          owner_whatsapp?: string | null
          parent_company_id?: string | null
          phone?: string | null
          pix_bank?: string | null
          pix_holder?: string | null
          pix_key?: string | null
          pix_qr_url?: string | null
          plan_code?: string | null
          plan_cycle_months?: number | null
          portal_bg_style?: string
          portal_bg_url?: string | null
          portal_button_color?: string | null
          portal_card_style?: string
          portal_highlight?: string
          portal_slogan?: string | null
          portal_text_color?: string | null
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
          trial_days?: number | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
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
            foreignKeyName: "companies_parent_company_id_fkey"
            columns: ["parent_company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["code"]
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
          {
            foreignKeyName: "company_hours_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_users: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          job_title: string | null
          permissions: Json
          role: Database["public"]["Enums"]["app_role"]
          staff_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          job_title?: string | null
          permissions?: Json
          role?: Database["public"]["Enums"]["app_role"]
          staff_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          job_title?: string | null
          permissions?: Json
          role?: Database["public"]["Enums"]["app_role"]
          staff_id?: string | null
          updated_at?: string
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
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_users_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      costing_settings: {
        Row: {
          allocation_basis: string
          block_below_cost: boolean
          company_id: string
          created_at: string
          default_margin_pct: number
          min_margin_pct: number
          monthly_appointments: number
          monthly_hours: number
          updated_at: string
        }
        Insert: {
          allocation_basis?: string
          block_below_cost?: boolean
          company_id: string
          created_at?: string
          default_margin_pct?: number
          min_margin_pct?: number
          monthly_appointments?: number
          monthly_hours?: number
          updated_at?: string
        }
        Update: {
          allocation_basis?: string
          block_below_cost?: boolean
          company_id?: string
          created_at?: string
          default_margin_pct?: number
          min_margin_pct?: number
          monthly_appointments?: number
          monthly_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "costing_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costing_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "public_companies"
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
          {
            foreignKeyName: "coupons_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
            foreignKeyName: "customer_dates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
            foreignKeyName: "customer_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
      customer_plan_services: {
        Row: {
          company_id: string
          created_at: string
          customer_plan_id: string
          id: string
          notes: string | null
          service_id: string
          service_name: string | null
          sessions_total: number
          sessions_used: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_plan_id: string
          id?: string
          notes?: string | null
          service_id: string
          service_name?: string | null
          sessions_total?: number
          sessions_used?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_plan_id?: string
          id?: string
          notes?: string | null
          service_id?: string
          service_name?: string | null
          sessions_total?: number
          sessions_used?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_plan_services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_plan_services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_plan_services_customer_plan_id_fkey"
            columns: ["customer_plan_id"]
            isOneToOne: false
            referencedRelation: "customer_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_plan_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_plans: {
        Row: {
          amount_cents: number
          cancel_reason: string | null
          cancelled_at: string | null
          company_id: string
          created_at: string
          customer_id: string
          expires_at: string | null
          id: string
          kind: string
          notes: string | null
          payment_method: string | null
          plan_id: string | null
          plan_name: string
          renewed_from_id: string | null
          sold_at: string
          sold_by: string | null
          status: string
          updated_at: string
          waive_deposit: boolean
        }
        Insert: {
          amount_cents?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          company_id: string
          created_at?: string
          customer_id: string
          expires_at?: string | null
          id?: string
          kind?: string
          notes?: string | null
          payment_method?: string | null
          plan_id?: string | null
          plan_name: string
          renewed_from_id?: string | null
          sold_at?: string
          sold_by?: string | null
          status?: string
          updated_at?: string
          waive_deposit?: boolean
        }
        Update: {
          amount_cents?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string
          expires_at?: string | null
          id?: string
          kind?: string
          notes?: string | null
          payment_method?: string | null
          plan_id?: string | null
          plan_name?: string
          renewed_from_id?: string | null
          sold_at?: string
          sold_by?: string | null
          status?: string
          updated_at?: string
          waive_deposit?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "customer_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_plans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_birthdays_this_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_plans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_plans_renewed_from_id_fkey"
            columns: ["renewed_from_id"]
            isOneToOne: false
            referencedRelation: "customer_plans"
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
          {
            foreignKeyName: "customer_profile_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
            foreignKeyName: "customer_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
          {
            foreignKeyName: "financial_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
          sale_id: string | null
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
          sale_id?: string | null
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
          sale_id?: string | null
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
            foreignKeyName: "financial_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
            foreignKeyName: "financial_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
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
          {
            foreignKeyName: "gallery_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
          operation: string | null
          product_id: string
          quantity: number
          reason: string | null
          sale_id: string | null
          total_cost: number | null
          type: Database["public"]["Enums"]["movement_type"]
          unit_cost: number | null
        }
        Insert: {
          appointment_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          operation?: string | null
          product_id: string
          quantity: number
          reason?: string | null
          sale_id?: string | null
          total_cost?: number | null
          type: Database["public"]["Enums"]["movement_type"]
          unit_cost?: number | null
        }
        Update: {
          appointment_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          operation?: string | null
          product_id?: string
          quantity?: number
          reason?: string | null
          sale_id?: string | null
          total_cost?: number | null
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
            foreignKeyName: "inventory_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
          {
            foreignKeyName: "loyalty_programs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "public_companies"
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
          {
            foreignKeyName: "loyalty_rewards_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
            foreignKeyName: "loyalty_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
            foreignKeyName: "messaging_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
          {
            foreignKeyName: "messaging_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "public_companies"
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
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      overhead_costs: {
        Row: {
          company_id: string
          created_at: string
          id: string
          include_in_costing: boolean
          label: string
          monthly_cents: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          include_in_costing?: boolean
          label: string
          monthly_cents?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          include_in_costing?: boolean
          label?: string
          monthly_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "overhead_costs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overhead_costs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
          {
            foreignKeyName: "payment_methods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_options: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_options_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_options_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          company_id: string
          created_at: string
          description: string | null
          entity: string
          entity_id: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          entity: string
          entity_id?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          entity?: string
          entity_id?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_services: {
        Row: {
          company_id: string
          created_at: string
          id: string
          notes: string | null
          plan_id: string
          service_id: string
          sessions: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          plan_id: string
          service_id: string
          sessions?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          plan_id?: string
          service_id?: string
          sessions?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_services_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_session_usage: {
        Row: {
          actor_user_id: string | null
          appointment_id: string | null
          company_id: string
          created_at: string
          customer_id: string | null
          customer_plan_id: string
          id: string
          notes: string | null
          quantity: number
          service_id: string | null
          service_name: string | null
          staff_id: string | null
          staff_name: string | null
          used_at: string
        }
        Insert: {
          actor_user_id?: string | null
          appointment_id?: string | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          customer_plan_id: string
          id?: string
          notes?: string | null
          quantity?: number
          service_id?: string | null
          service_name?: string | null
          staff_id?: string | null
          staff_name?: string | null
          used_at?: string
        }
        Update: {
          actor_user_id?: string | null
          appointment_id?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          customer_plan_id?: string
          id?: string
          notes?: string | null
          quantity?: number
          service_id?: string | null
          service_name?: string | null
          staff_id?: string | null
          staff_name?: string | null
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_session_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_session_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_session_usage_customer_plan_id_fkey"
            columns: ["customer_plan_id"]
            isOneToOne: false
            referencedRelation: "customer_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          duration_days: number | null
          id: string
          image_url: string | null
          kind: string
          name: string
          price_cents: number
          promo_price_cents: number | null
          sessions_total: number | null
          updated_at: string
          valid_until: string | null
          waive_deposit: boolean
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_days?: number | null
          id?: string
          image_url?: string | null
          kind?: string
          name: string
          price_cents?: number
          promo_price_cents?: number | null
          sessions_total?: number | null
          updated_at?: string
          valid_until?: string | null
          waive_deposit?: boolean
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_days?: number | null
          id?: string
          image_url?: string | null
          kind?: string
          name?: string
          price_cents?: number
          promo_price_cents?: number | null
          sessions_total?: number | null
          updated_at?: string
          valid_until?: string | null
          waive_deposit?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          default_trial_days: number
          id: boolean
          pix_bank: string | null
          pix_holder: string | null
          pix_key: string | null
          platform_name: string
          review_expiration_days: number
          updated_at: string
        }
        Insert: {
          default_trial_days?: number
          id?: boolean
          pix_bank?: string | null
          pix_holder?: string | null
          pix_key?: string | null
          platform_name?: string
          review_expiration_days?: number
          updated_at?: string
        }
        Update: {
          default_trial_days?: number
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
      procedure_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          company_id: string
          created_at: string
          description: string | null
          entity: string
          id: string
          new_data: Json | null
          old_data: Json | null
          procedure_id: string | null
          procedure_name: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          entity: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          procedure_id?: string | null
          procedure_name?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          entity?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          procedure_id?: string | null
          procedure_name?: string | null
        }
        Relationships: []
      }
      procedure_costs: {
        Row: {
          amount_cents: number
          company_id: string
          created_at: string
          id: string
          label: string
          procedure_id: string
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          company_id: string
          created_at?: string
          id?: string
          label: string
          procedure_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          company_id?: string
          created_at?: string
          id?: string
          label?: string
          procedure_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_costs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_costs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_costs_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_items: {
        Row: {
          category: string | null
          company_id: string
          consumption_unit: string | null
          conversion_factor: number
          converted_qty: number
          created_at: string
          id: string
          notes: string | null
          procedure_id: string
          product_id: string | null
          product_name: string | null
          purchase_unit: string | null
          quantity: number
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          company_id: string
          consumption_unit?: string | null
          conversion_factor?: number
          converted_qty?: number
          created_at?: string
          id?: string
          notes?: string | null
          procedure_id: string
          product_id?: string | null
          product_name?: string | null
          purchase_unit?: string | null
          quantity?: number
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          company_id?: string
          consumption_unit?: string | null
          conversion_factor?: number
          converted_qty?: number
          created_at?: string
          id?: string
          notes?: string | null
          procedure_id?: string
          product_id?: string | null
          product_name?: string | null
          purchase_unit?: string | null
          quantity?: number
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_items_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_staff_prices: {
        Row: {
          company_id: string
          created_at: string
          id: string
          price_cents: number
          procedure_id: string
          staff_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          price_cents?: number
          procedure_id: string
          staff_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          price_cents?: number
          procedure_id?: string
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_staff_prices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_staff_prices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_staff_prices_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_staff_prices_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_versions: {
        Row: {
          actor_user_id: string | null
          company_id: string
          created_at: string
          id: string
          note: string | null
          procedure_id: string
          snapshot: Json
          totals: Json | null
          version: number
        }
        Insert: {
          actor_user_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          note?: string | null
          procedure_id: string
          snapshot: Json
          totals?: Json | null
          version?: number
        }
        Update: {
          actor_user_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          note?: string | null
          procedure_id?: string
          snapshot?: Json
          totals?: Json | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "procedure_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_versions_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      procedures: {
        Row: {
          active: boolean
          apply_overhead: boolean
          block_below_cost: boolean
          category: string | null
          commission_type: string
          commission_value: number
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          duration_max_min: number | null
          duration_min: number
          duration_min_min: number | null
          id: string
          ideal_price_cents: number
          image_url: string | null
          labor_hour_rate_cents: number
          min_price_cents: number
          name: string
          other_costs_cents: number
          practiced_price_cents: number | null
          promo_price_cents: number | null
          service_id: string | null
          subcategory: string | null
          suggested_price_cents: number
          target_margin_pct: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          apply_overhead?: boolean
          block_below_cost?: boolean
          category?: string | null
          commission_type?: string
          commission_value?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_max_min?: number | null
          duration_min?: number
          duration_min_min?: number | null
          id?: string
          ideal_price_cents?: number
          image_url?: string | null
          labor_hour_rate_cents?: number
          min_price_cents?: number
          name: string
          other_costs_cents?: number
          practiced_price_cents?: number | null
          promo_price_cents?: number | null
          service_id?: string | null
          subcategory?: string | null
          suggested_price_cents?: number
          target_margin_pct?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          apply_overhead?: boolean
          block_below_cost?: boolean
          category?: string | null
          commission_type?: string
          commission_value?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_max_min?: number | null
          duration_min?: number
          duration_min_min?: number | null
          id?: string
          ideal_price_cents?: number
          image_url?: string | null
          labor_hour_rate_cents?: number
          min_price_cents?: number
          name?: string
          other_costs_cents?: number
          practiced_price_cents?: number | null
          promo_price_cents?: number | null
          service_id?: string | null
          subcategory?: string | null
          suggested_price_cents?: number
          target_margin_pct?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedures_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          avg_cost: number
          barcode: string | null
          batch: string | null
          brand: string | null
          category: string | null
          company_id: string
          cost_price: number
          created_at: string
          expires_on: string | null
          id: string
          ideal_stock: number
          image_url: string | null
          internal_code: string | null
          last_cost: number | null
          location: string | null
          min_stock: number
          name: string
          notes: string | null
          promo_price: number | null
          sale_price: number
          scope: string
          sku: string | null
          stock_qty: number
          supplier: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          avg_cost?: number
          barcode?: string | null
          batch?: string | null
          brand?: string | null
          category?: string | null
          company_id: string
          cost_price?: number
          created_at?: string
          expires_on?: string | null
          id?: string
          ideal_stock?: number
          image_url?: string | null
          internal_code?: string | null
          last_cost?: number | null
          location?: string | null
          min_stock?: number
          name: string
          notes?: string | null
          promo_price?: number | null
          sale_price?: number
          scope?: string
          sku?: string | null
          stock_qty?: number
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          avg_cost?: number
          barcode?: string | null
          batch?: string | null
          brand?: string | null
          category?: string | null
          company_id?: string
          cost_price?: number
          created_at?: string
          expires_on?: string | null
          id?: string
          ideal_stock?: number
          image_url?: string | null
          internal_code?: string | null
          last_cost?: number | null
          location?: string | null
          min_stock?: number
          name?: string
          notes?: string | null
          promo_price?: number | null
          sale_price?: number
          scope?: string
          sku?: string | null
          stock_qty?: number
          supplier?: string | null
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
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
      public_api_events: {
        Row: {
          company_id: string | null
          created_at: string
          detail: string | null
          duration_ms: number | null
          id: number
          identifier_hash: string | null
          outcome: string
          scope: string
          status_code: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          detail?: string | null
          duration_ms?: number | null
          id?: never
          identifier_hash?: string | null
          outcome: string
          scope: string
          status_code?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          detail?: string | null
          duration_ms?: number | null
          id?: never
          identifier_hash?: string | null
          outcome?: string
          scope?: string
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "public_api_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_api_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      public_api_rate_limits: {
        Row: {
          identifier_hash: string
          request_count: number
          scope: string
          updated_at: string
          window_started_at: string
        }
        Insert: {
          identifier_hash: string
          request_count?: number
          scope: string
          updated_at?: string
          window_started_at: string
        }
        Update: {
          identifier_hash?: string
          request_count?: number
          scope?: string
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      public_client_verifications: {
        Row: {
          company_id: string
          consumed_at: string | null
          created_at: string
          customer_id: string | null
          expires_at: string
          id: string
          phone_hash: string
          token_hash: string
        }
        Insert: {
          company_id: string
          consumed_at?: string | null
          created_at?: string
          customer_id?: string | null
          expires_at: string
          id?: string
          phone_hash: string
          token_hash: string
        }
        Update: {
          company_id?: string
          consumed_at?: string | null
          created_at?: string
          customer_id?: string | null
          expires_at?: string
          id?: string
          phone_hash?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_client_verifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_client_verifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_client_verifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_birthdays_this_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_client_verifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_sales: {
        Row: {
          commission_amount: number | null
          commission_percent: number
          company_id: string
          created_at: string
          earned_at: string | null
          first_payment_amount: number | null
          first_payment_id: string | null
          id: string
          paid_at: string | null
          payout_reference: string | null
          reseller_id: string
          scheduled_payout_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          commission_amount?: number | null
          commission_percent: number
          company_id: string
          created_at?: string
          earned_at?: string | null
          first_payment_amount?: number | null
          first_payment_id?: string | null
          id?: string
          paid_at?: string | null
          payout_reference?: string | null
          reseller_id: string
          scheduled_payout_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          commission_amount?: number | null
          commission_percent?: number
          company_id?: string
          created_at?: string
          earned_at?: string | null
          first_payment_amount?: number | null
          first_payment_id?: string | null
          id?: string
          paid_at?: string | null
          payout_reference?: string | null
          reseller_id?: string
          scheduled_payout_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_sales_first_payment_id_fkey"
            columns: ["first_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_sales_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      resellers: {
        Row: {
          active: boolean
          commission_percent: number
          created_at: string
          email: string
          id: string
          name: string
          payout_day: number
          phone: string | null
          pix_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          commission_percent: number
          created_at?: string
          email: string
          id?: string
          name: string
          payout_day?: number
          phone?: string | null
          pix_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          commission_percent?: number
          created_at?: string
          email?: string
          id?: string
          name?: string
          payout_day?: number
          phone?: string | null
          pix_key?: string | null
          updated_at?: string
          user_id?: string
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
            foreignKeyName: "review_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
            foreignKeyName: "review_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
          public_link_enabled: boolean
          public_token: string | null
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
          public_link_enabled?: boolean
          public_token?: string | null
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
          public_link_enabled?: boolean
          public_token?: string | null
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
          {
            foreignKeyName: "review_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "public_companies"
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
          customer_name: string | null
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
          customer_name?: string | null
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
          customer_name?: string | null
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
            foreignKeyName: "reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
      sale_items: {
        Row: {
          company_id: string
          created_at: string
          discount_cents: number
          id: string
          kind: string
          name: string
          product_id: string | null
          quantity: number
          sale_id: string
          service_id: string | null
          total_cents: number
          unit_cost: number | null
          unit_price_cents: number
        }
        Insert: {
          company_id: string
          created_at?: string
          discount_cents?: number
          id?: string
          kind?: string
          name: string
          product_id?: string | null
          quantity?: number
          sale_id: string
          service_id?: string | null
          total_cents?: number
          unit_cost?: number | null
          unit_price_cents?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          discount_cents?: number
          id?: string
          kind?: string
          name?: string
          product_id?: string | null
          quantity?: number
          sale_id?: string
          service_id?: string | null
          total_cents?: number
          unit_cost?: number | null
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_payments: {
        Row: {
          amount_cents: number
          company_id: string
          created_at: string
          id: string
          installments: number
          method_name: string
          payment_option_id: string | null
          sale_id: string
        }
        Insert: {
          amount_cents?: number
          company_id: string
          created_at?: string
          id?: string
          installments?: number
          method_name: string
          payment_option_id?: string | null
          sale_id: string
        }
        Update: {
          amount_cents?: number
          company_id?: string
          created_at?: string
          id?: string
          installments?: number
          method_name?: string
          payment_option_id?: string | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_payment_option_id_fkey"
            columns: ["payment_option_id"]
            isOneToOne: false
            referencedRelation: "payment_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          appointment_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          discount_cents: number
          id: string
          notes: string | null
          occurred_at: string
          services_cents: number
          staff_id: string | null
          status: string
          subtotal_cents: number
          surcharge_cents: number
          total_cents: number
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount_cents?: number
          id?: string
          notes?: string | null
          occurred_at?: string
          services_cents?: number
          staff_id?: string | null
          status?: string
          subtotal_cents?: number
          surcharge_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount_cents?: number
          id?: string
          notes?: string | null
          occurred_at?: string
          services_cents?: number
          staff_id?: string | null
          status?: string
          subtotal_cents?: number
          surcharge_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_birthdays_this_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_staff_id_fkey"
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
          anamnesis_section: string | null
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
          show_on_booking: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          anamnesis_section?: string | null
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
          show_on_booking?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          anamnesis_section?: string | null
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
          show_on_booking?: boolean
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
          {
            foreignKeyName: "services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
          {
            foreignKeyName: "staff_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
      subscription_plans: {
        Row: {
          active: boolean
          code: string
          created_at: string
          cycle_months: number | null
          cycle_total_cents: number | null
          description: string | null
          discount_percent: number | null
          features: Json
          max_users: number | null
          monthly_cents: number
          name: string
          selectable: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          cycle_months?: number | null
          cycle_total_cents?: number | null
          description?: string | null
          discount_percent?: number | null
          features?: Json
          max_users?: number | null
          monthly_cents?: number
          name: string
          selectable?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          cycle_months?: number | null
          cycle_total_cents?: number | null
          description?: string | null
          discount_percent?: number | null
          features?: Json
          max_users?: number | null
          monthly_cents?: number
          name?: string
          selectable?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
            foreignKeyName: "time_blocks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
      unit_conversions: {
        Row: {
          company_id: string
          created_at: string
          factor: number
          from_unit: string
          id: string
          notes: string | null
          to_unit: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          factor: number
          from_unit: string
          id?: string
          notes?: string | null
          to_unit: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          factor?: number
          from_unit?: string
          id?: string
          notes?: string | null
          to_unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_conversions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_conversions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          company_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          company_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          company_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
      waitlist_entries: {
        Row: {
          company_id: string
          converted_appointment_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string
          id: string
          notes: string | null
          notified_at: string | null
          offered_appointment_id: string | null
          offered_at: string | null
          phone: string | null
          preferred_date: string | null
          preferred_period: string
          reserved_until: string | null
          service_id: string | null
          staff_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          converted_appointment_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name: string
          id?: string
          notes?: string | null
          notified_at?: string | null
          offered_appointment_id?: string | null
          offered_at?: string | null
          phone?: string | null
          preferred_date?: string | null
          preferred_period?: string
          reserved_until?: string | null
          service_id?: string | null
          staff_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          converted_appointment_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string
          id?: string
          notes?: string | null
          notified_at?: string | null
          offered_appointment_id?: string | null
          offered_at?: string | null
          phone?: string | null
          preferred_date?: string | null
          preferred_period?: string
          reserved_until?: string | null
          service_id?: string | null
          staff_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_converted_appointment_id_fkey"
            columns: ["converted_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_birthdays_this_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_offered_appointment_id_fkey"
            columns: ["offered_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "whatsapp_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "public_companies"
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
          {
            foreignKeyName: "whatsapp_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
          {
            foreignKeyName: "whatsapp_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      public_companies: {
        Row: {
          address: string | null
          amenities: string[] | null
          app_icon_url: string | null
          banner_url: string | null
          booking_slot_interval_min: number | null
          buffer_min: number | null
          city: string | null
          deposit_enabled: boolean | null
          deposit_type: string | null
          deposit_value: number | null
          description: string | null
          facebook_url: string | null
          id: string | null
          instagram_url: string | null
          latitude: number | null
          listed_in_marketplace: boolean | null
          logo_url: string | null
          longitude: number | null
          max_advance_days: number | null
          min_advance_min: number | null
          name: string | null
          niche_id: string | null
          online_booking_enabled: boolean | null
          phone: string | null
          portal_bg_style: string | null
          portal_bg_url: string | null
          portal_button_color: string | null
          portal_card_style: string | null
          portal_highlight: string | null
          portal_slogan: string | null
          portal_text_color: string | null
          primary_color: string | null
          secondary_color: string | null
          short_description: string | null
          show_reviews_on_portal: boolean | null
          show_staff_on_portal: boolean | null
          slug: string | null
          state: string | null
          status: Database["public"]["Enums"]["company_status"] | null
          sub_niche_id: string | null
          theme: string | null
          tiktok_url: string | null
          website_url: string | null
          welcome_message: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          app_icon_url?: string | null
          banner_url?: string | null
          booking_slot_interval_min?: number | null
          buffer_min?: number | null
          city?: string | null
          deposit_enabled?: boolean | null
          deposit_type?: string | null
          deposit_value?: number | null
          description?: string | null
          facebook_url?: string | null
          id?: string | null
          instagram_url?: string | null
          latitude?: number | null
          listed_in_marketplace?: boolean | null
          logo_url?: string | null
          longitude?: number | null
          max_advance_days?: number | null
          min_advance_min?: number | null
          name?: string | null
          niche_id?: string | null
          online_booking_enabled?: boolean | null
          phone?: string | null
          portal_bg_style?: string | null
          portal_bg_url?: string | null
          portal_button_color?: string | null
          portal_card_style?: string | null
          portal_highlight?: string | null
          portal_slogan?: string | null
          portal_text_color?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          short_description?: string | null
          show_reviews_on_portal?: boolean | null
          show_staff_on_portal?: boolean | null
          slug?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"] | null
          sub_niche_id?: string | null
          theme?: string | null
          tiktok_url?: string | null
          website_url?: string | null
          welcome_message?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          app_icon_url?: string | null
          banner_url?: string | null
          booking_slot_interval_min?: number | null
          buffer_min?: number | null
          city?: string | null
          deposit_enabled?: boolean | null
          deposit_type?: string | null
          deposit_value?: number | null
          description?: string | null
          facebook_url?: string | null
          id?: string | null
          instagram_url?: string | null
          latitude?: number | null
          listed_in_marketplace?: boolean | null
          logo_url?: string | null
          longitude?: number | null
          max_advance_days?: number | null
          min_advance_min?: number | null
          name?: string | null
          niche_id?: string | null
          online_booking_enabled?: boolean | null
          phone?: string | null
          portal_bg_style?: string | null
          portal_bg_url?: string | null
          portal_button_color?: string | null
          portal_card_style?: string | null
          portal_highlight?: string | null
          portal_slogan?: string | null
          portal_text_color?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          short_description?: string | null
          show_reviews_on_portal?: boolean | null
          show_staff_on_portal?: boolean | null
          slug?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"] | null
          sub_niche_id?: string | null
          theme?: string | null
          tiktok_url?: string | null
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
            foreignKeyName: "companies_sub_niche_id_fkey"
            columns: ["sub_niche_id"]
            isOneToOne: false
            referencedRelation: "sub_niches"
            referencedColumns: ["id"]
          },
        ]
      }
      public_time_blocks: {
        Row: {
          company_id: string | null
          ends_at: string | null
          id: string | null
          staff_id: string | null
          starts_at: string | null
        }
        Insert: {
          company_id?: string | null
          ends_at?: string | null
          id?: string | null
          staff_id?: string | null
          starts_at?: string | null
        }
        Update: {
          company_id?: string | null
          ends_at?: string | null
          id?: string | null
          staff_id?: string | null
          starts_at?: string | null
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
            foreignKeyName: "time_blocks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "public_companies"
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
    }
    Functions: {
      can_access_appointment: {
        Args: { _company: string; _keys: string[]; _staff: string }
        Returns: boolean
      }
      checkout_appointment_with_products: {
        Args: {
          _appointment_id: string
          _payment_amount_cents: number
          _payment_kind: string
          _payment_method: string
          _products: Json
        }
        Returns: Json
      }
      company_features: { Args: { _company: string }; Returns: Json }
      consume_public_rate_limit: {
        Args: {
          _identifier_hash: string
          _limit: number
          _scope: string
          _window_seconds: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after_seconds: number
        }[]
      }
      create_company_for_user_as_super_admin: {
        Args: {
          _admin_notes: string
          _contracted_plan: string
          _email: string
          _monthly_fee: number
          _name: string
          _next_due_at: string
          _niche_id: string
          _owner_name: string
          _phone: string
          _slug: string
          _status: Database["public"]["Enums"]["company_status"]
          _sub_niche_id: string
          _user_id: string
        }
        Returns: Json
      }
      customer_booking_rule: {
        Args: { _company: string; _customer: string }
        Returns: {
          action: string
          classification: string
          no_shows: number
          score: number
        }[]
      }
      customer_reliability: {
        Args: { _company: string }
        Returns: {
          attendance_rate: number
          cancels: number
          classification: string
          completed: number
          customer_id: string
          last_event_at: string
          late_cancels: number
          no_shows: number
          score: number
          total: number
        }[]
      }
      delete_company_as_super_admin: {
        Args: { _company: string }
        Returns: Json
      }
      has_any_permission: {
        Args: { _company: string; _keys: string[] }
        Returns: boolean
      }
      has_feature: {
        Args: { _company: string; _key: string }
        Returns: boolean
      }
      has_permission: {
        Args: { _company: string; _key: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_admin: { Args: { _company: string }; Returns: boolean }
      is_company_blocked: { Args: { _company: string }; Returns: boolean }
      is_company_member: { Args: { _company: string }; Returns: boolean }
      is_reseller: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      link_reseller_company: {
        Args: { _company_id: string; _reseller_id: string }
        Returns: Json
      }
      mark_business_expense_paid: {
        Args: { p_expense_id: string; p_payment_method_id: string }
        Returns: string
      }
      mark_reseller_commission_paid: {
        Args: { _reference?: string; _sale_id: string }
        Returns: Json
      }
      plan_mark_expired: { Args: never; Returns: undefined }
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
      system_health_snapshot: { Args: never; Returns: Json }
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
      company_status:
        | "active"
        | "due_soon"
        | "overdue"
        | "suspended"
        | "trial"
        | "trial_expired"
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
      company_status: [
        "active",
        "due_soon",
        "overdue",
        "suspended",
        "trial",
        "trial_expired",
      ],
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
