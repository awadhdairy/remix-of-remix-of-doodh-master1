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
      activity_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          attendance_date: string
          check_in: string | null
          check_out: string | null
          created_at: string | null
          employee_id: string
          id: string
          notes: string | null
          status: string | null
        }
        Insert: {
          attendance_date: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          status?: string | null
        }
        Update: {
          attendance_date?: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_auditor_view"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_attempts: {
        Row: {
          failed_count: number | null
          id: string
          last_attempt: string | null
          locked_until: string | null
          phone: string
        }
        Insert: {
          failed_count?: number | null
          id?: string
          last_attempt?: string | null
          locked_until?: string | null
          phone: string
        }
        Update: {
          failed_count?: number | null
          id?: string
          last_attempt?: string | null
          locked_until?: string | null
          phone?: string
        }
        Relationships: []
      }
      auth_sessions: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          ip_address: string | null
          last_activity: string | null
          session_token: string
          user_agent: string | null
          user_id: string
          user_type: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          last_activity?: string | null
          session_token: string
          user_agent?: string | null
          user_id: string
          user_type?: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          last_activity?: string | null
          session_token?: string
          user_agent?: string | null
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      bottle_transactions: {
        Row: {
          bottle_id: string
          created_at: string | null
          customer_id: string | null
          id: string
          notes: string | null
          quantity: number
          staff_id: string | null
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          bottle_id: string
          created_at?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          quantity: number
          staff_id?: string | null
          transaction_date: string
          transaction_type: string
        }
        Update: {
          bottle_id?: string
          created_at?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          staff_id?: string | null
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "bottle_transactions_bottle_id_fkey"
            columns: ["bottle_id"]
            isOneToOne: false
            referencedRelation: "bottles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bottle_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bottle_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_delivery_view"
            referencedColumns: ["id"]
          },
        ]
      }
      bottles: {
        Row: {
          available_quantity: number
          bottle_type: Database["public"]["Enums"]["bottle_type"]
          created_at: string | null
          deposit_amount: number | null
          id: string
          size: Database["public"]["Enums"]["bottle_size"]
          total_quantity: number
          updated_at: string | null
        }
        Insert: {
          available_quantity?: number
          bottle_type: Database["public"]["Enums"]["bottle_type"]
          created_at?: string | null
          deposit_amount?: number | null
          id?: string
          size: Database["public"]["Enums"]["bottle_size"]
          total_quantity?: number
          updated_at?: string | null
        }
        Update: {
          available_quantity?: number
          bottle_type?: Database["public"]["Enums"]["bottle_type"]
          created_at?: string | null
          deposit_amount?: number | null
          id?: string
          size?: Database["public"]["Enums"]["bottle_size"]
          total_quantity?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      breeding_records: {
        Row: {
          actual_calving_date: string | null
          calf_details: Json | null
          cattle_id: string
          created_at: string | null
          expected_calving_date: string | null
          heat_cycle_day: number | null
          id: string
          insemination_bull: string | null
          insemination_technician: string | null
          notes: string | null
          pregnancy_confirmed: boolean | null
          record_date: string
          record_type: string
          recorded_by: string | null
        }
        Insert: {
          actual_calving_date?: string | null
          calf_details?: Json | null
          cattle_id: string
          created_at?: string | null
          expected_calving_date?: string | null
          heat_cycle_day?: number | null
          id?: string
          insemination_bull?: string | null
          insemination_technician?: string | null
          notes?: string | null
          pregnancy_confirmed?: boolean | null
          record_date: string
          record_type: string
          recorded_by?: string | null
        }
        Update: {
          actual_calving_date?: string | null
          calf_details?: Json | null
          cattle_id?: string
          created_at?: string | null
          expected_calving_date?: string | null
          heat_cycle_day?: number | null
          id?: string
          insemination_bull?: string | null
          insemination_technician?: string | null
          notes?: string | null
          pregnancy_confirmed?: boolean | null
          record_date?: string
          record_type?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "breeding_records_cattle_id_fkey"
            columns: ["cattle_id"]
            isOneToOne: false
            referencedRelation: "cattle"
            referencedColumns: ["id"]
          },
        ]
      }
      cattle: {
        Row: {
          breed: string
          cattle_type: string
          created_at: string | null
          created_by: string | null
          dam_id: string | null
          date_of_birth: string | null
          expected_calving_date: string | null
          id: string
          image_url: string | null
          lactation_number: number | null
          lactation_status:
            | Database["public"]["Enums"]["lactation_status"]
            | null
          last_calving_date: string | null
          name: string | null
          notes: string | null
          purchase_cost: number | null
          purchase_date: string | null
          sire_id: string | null
          status: Database["public"]["Enums"]["cattle_status"] | null
          tag_number: string
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          breed: string
          cattle_type?: string
          created_at?: string | null
          created_by?: string | null
          dam_id?: string | null
          date_of_birth?: string | null
          expected_calving_date?: string | null
          id?: string
          image_url?: string | null
          lactation_number?: number | null
          lactation_status?:
            | Database["public"]["Enums"]["lactation_status"]
            | null
          last_calving_date?: string | null
          name?: string | null
          notes?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          sire_id?: string | null
          status?: Database["public"]["Enums"]["cattle_status"] | null
          tag_number: string
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          breed?: string
          cattle_type?: string
          created_at?: string | null
          created_by?: string | null
          dam_id?: string | null
          date_of_birth?: string | null
          expected_calving_date?: string | null
          id?: string
          image_url?: string | null
          lactation_number?: number | null
          lactation_status?:
            | Database["public"]["Enums"]["lactation_status"]
            | null
          last_calving_date?: string | null
          name?: string | null
          notes?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          sire_id?: string | null
          status?: Database["public"]["Enums"]["cattle_status"] | null
          tag_number?: string
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cattle_dam_id_fkey"
            columns: ["dam_id"]
            isOneToOne: false
            referencedRelation: "cattle"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cattle_sire_id_fkey"
            columns: ["sire_id"]
            isOneToOne: false
            referencedRelation: "cattle"
            referencedColumns: ["id"]
          },
        ]
      }
      cattle_health: {
        Row: {
          cattle_id: string
          cost: number | null
          created_at: string | null
          description: string | null
          id: string
          next_due_date: string | null
          record_date: string
          record_type: string
          recorded_by: string | null
          title: string
          vet_name: string | null
        }
        Insert: {
          cattle_id: string
          cost?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          next_due_date?: string | null
          record_date: string
          record_type: string
          recorded_by?: string | null
          title: string
          vet_name?: string | null
        }
        Update: {
          cattle_id?: string
          cost?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          next_due_date?: string | null
          record_date?: string
          record_type?: string
          recorded_by?: string | null
          title?: string
          vet_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cattle_health_cattle_id_fkey"
            columns: ["cattle_id"]
            isOneToOne: false
            referencedRelation: "cattle"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_accounts: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          customer_id: string
          id: string
          is_approved: boolean | null
          last_login: string | null
          phone: string
          pin_hash: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          customer_id: string
          id?: string
          is_approved?: boolean | null
          last_login?: string | null
          phone: string
          pin_hash?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          customer_id?: string
          id?: string
          is_approved?: boolean | null
          last_login?: string | null
          phone?: string
          pin_hash?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers_delivery_view"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_auth_attempts: {
        Row: {
          failed_count: number | null
          id: string
          last_attempt: string | null
          locked_until: string | null
          phone: string
        }
        Insert: {
          failed_count?: number | null
          id?: string
          last_attempt?: string | null
          locked_until?: string | null
          phone: string
        }
        Update: {
          failed_count?: number | null
          id?: string
          last_attempt?: string | null
          locked_until?: string | null
          phone?: string
        }
        Relationships: []
      }
      customer_bottles: {
        Row: {
          bottle_id: string
          created_at: string | null
          customer_id: string
          id: string
          last_issued_date: string | null
          last_returned_date: string | null
          quantity_pending: number | null
          updated_at: string | null
        }
        Insert: {
          bottle_id: string
          created_at?: string | null
          customer_id: string
          id?: string
          last_issued_date?: string | null
          last_returned_date?: string | null
          quantity_pending?: number | null
          updated_at?: string | null
        }
        Update: {
          bottle_id?: string
          created_at?: string | null
          customer_id?: string
          id?: string
          last_issued_date?: string | null
          last_returned_date?: string | null
          quantity_pending?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_bottles_bottle_id_fkey"
            columns: ["bottle_id"]
            isOneToOne: false
            referencedRelation: "bottles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_bottles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_bottles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_delivery_view"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_ledger: {
        Row: {
          created_at: string | null
          created_by: string | null
          credit_amount: number | null
          customer_id: string
          debit_amount: number | null
          description: string
          id: string
          reference_id: string | null
          running_balance: number | null
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          credit_amount?: number | null
          customer_id: string
          debit_amount?: number | null
          description: string
          id?: string
          reference_id?: string | null
          running_balance?: number | null
          transaction_date?: string
          transaction_type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          credit_amount?: number | null
          customer_id?: string
          debit_amount?: number | null
          description?: string
          id?: string
          reference_id?: string | null
          running_balance?: number | null
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_ledger_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ledger_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_delivery_view"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_products: {
        Row: {
          created_at: string | null
          custom_price: number | null
          customer_id: string
          id: string
          is_active: boolean | null
          product_id: string
          quantity: number
        }
        Insert: {
          created_at?: string | null
          custom_price?: number | null
          customer_id: string
          id?: string
          is_active?: boolean | null
          product_id: string
          quantity: number
        }
        Update: {
          created_at?: string | null
          custom_price?: number | null
          customer_id?: string
          id?: string
          is_active?: boolean | null
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_products_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_products_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_delivery_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_vacations: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_id: string
          end_date: string
          id: string
          is_active: boolean | null
          reason: string | null
          start_date: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          end_date: string
          id?: string
          is_active?: boolean | null
          reason?: string | null
          start_date: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          end_date?: string
          id?: string
          is_active?: boolean | null
          reason?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_vacations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_vacations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_delivery_view"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          advance_balance: number | null
          area: string | null
          billing_cycle: string | null
          created_at: string | null
          credit_balance: number | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          route_id: string | null
          subscription_type: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          advance_balance?: number | null
          area?: string | null
          billing_cycle?: string | null
          created_at?: string | null
          credit_balance?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          route_id?: string | null
          subscription_type?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          advance_balance?: number | null
          area?: string | null
          billing_cycle?: string | null
          created_at?: string | null
          credit_balance?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          route_id?: string | null
          subscription_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_customer_route"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      dairy_settings: {
        Row: {
          address: string | null
          created_at: string | null
          currency: string | null
          dairy_name: string
          email: string | null
          financial_year_start: number | null
          id: string
          invoice_prefix: string | null
          logo_url: string | null
          phone: string | null
          settings: Json | null
          updated_at: string | null
          upi_handle: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          currency?: string | null
          dairy_name?: string
          email?: string | null
          financial_year_start?: number | null
          id?: string
          invoice_prefix?: string | null
          logo_url?: string | null
          phone?: string | null
          settings?: Json | null
          updated_at?: string | null
          upi_handle?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          currency?: string | null
          dairy_name?: string
          email?: string | null
          financial_year_start?: number | null
          id?: string
          invoice_prefix?: string | null
          logo_url?: string | null
          phone?: string | null
          settings?: Json | null
          updated_at?: string | null
          upi_handle?: string | null
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          created_at: string | null
          customer_id: string
          delivered_by: string | null
          delivery_date: string
          delivery_time: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["delivery_status"] | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          delivered_by?: string | null
          delivery_date: string
          delivery_time?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["delivery_status"] | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          delivered_by?: string | null
          delivery_date?: string
          delivery_time?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["delivery_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_delivery_view"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_items: {
        Row: {
          created_at: string | null
          delivery_id: string
          id: string
          product_id: string
          quantity: number
          total_amount: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          delivery_id: string
          id?: string
          product_id: string
          quantity: number
          total_amount: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          delivery_id?: string
          id?: string
          product_id?: string
          quantity?: number
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_shifts: {
        Row: {
          created_at: string | null
          effective_from: string
          effective_to: string | null
          employee_id: string
          id: string
          shift_id: string
        }
        Insert: {
          created_at?: string | null
          effective_from: string
          effective_to?: string | null
          employee_id: string
          id?: string
          shift_id: string
        }
        Update: {
          created_at?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          id?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_auditor_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shifts_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          joining_date: string | null
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          salary: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          joining_date?: string | null
          name: string
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          salary?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          joining_date?: string | null
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          salary?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      equipment: {
        Row: {
          category: string
          created_at: string | null
          id: string
          location: string | null
          model: string | null
          name: string
          notes: string | null
          purchase_cost: number | null
          purchase_date: string | null
          serial_number: string | null
          status: string | null
          updated_at: string | null
          warranty_expiry: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          location?: string | null
          model?: string | null
          name: string
          notes?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: string | null
          updated_at?: string | null
          warranty_expiry?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          location?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: string | null
          updated_at?: string | null
          warranty_expiry?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          cattle_id: string | null
          created_at: string | null
          expense_date: string
          id: string
          notes: string | null
          receipt_url: string | null
          recorded_by: string | null
          title: string
        }
        Insert: {
          amount: number
          category: string
          cattle_id?: string | null
          created_at?: string | null
          expense_date: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          title: string
        }
        Update: {
          amount?: number
          category?: string
          cattle_id?: string | null
          created_at?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_cattle_id_fkey"
            columns: ["cattle_id"]
            isOneToOne: false
            referencedRelation: "cattle"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_consumption: {
        Row: {
          cattle_id: string | null
          consumption_date: string
          created_at: string | null
          feed_id: string
          id: string
          quantity: number
          recorded_by: string | null
        }
        Insert: {
          cattle_id?: string | null
          consumption_date: string
          created_at?: string | null
          feed_id: string
          id?: string
          quantity: number
          recorded_by?: string | null
        }
        Update: {
          cattle_id?: string | null
          consumption_date?: string
          created_at?: string | null
          feed_id?: string
          id?: string
          quantity?: number
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_consumption_cattle_id_fkey"
            columns: ["cattle_id"]
            isOneToOne: false
            referencedRelation: "cattle"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_consumption_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "feed_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_inventory: {
        Row: {
          category: string
          cost_per_unit: number | null
          created_at: string | null
          current_stock: number | null
          id: string
          min_stock_level: number | null
          name: string
          supplier: string | null
          unit: string
          updated_at: string | null
        }
        Insert: {
          category: string
          cost_per_unit?: number | null
          created_at?: string | null
          current_stock?: number | null
          id?: string
          min_stock_level?: number | null
          name: string
          supplier?: string | null
          unit?: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          cost_per_unit?: number | null
          created_at?: string | null
          current_stock?: number | null
          id?: string
          min_stock_level?: number | null
          name?: string
          supplier?: string | null
          unit?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          billing_period_end: string
          billing_period_start: string
          created_at: string | null
          customer_id: string
          discount_amount: number | null
          due_date: string | null
          final_amount: number
          id: string
          invoice_number: string
          notes: string | null
          paid_amount: number | null
          payment_date: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          tax_amount: number | null
          total_amount: number
          updated_at: string | null
          upi_handle: string | null
        }
        Insert: {
          billing_period_end: string
          billing_period_start: string
          created_at?: string | null
          customer_id: string
          discount_amount?: number | null
          due_date?: string | null
          final_amount: number
          id?: string
          invoice_number: string
          notes?: string | null
          paid_amount?: number | null
          payment_date?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          tax_amount?: number | null
          total_amount: number
          updated_at?: string | null
          upi_handle?: string | null
        }
        Update: {
          billing_period_end?: string
          billing_period_start?: string
          created_at?: string | null
          customer_id?: string
          discount_amount?: number | null
          due_date?: string | null
          final_amount?: number
          id?: string
          invoice_number?: string
          notes?: string | null
          paid_amount?: number | null
          payment_date?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string | null
          upi_handle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_delivery_view"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_records: {
        Row: {
          cost: number | null
          created_at: string | null
          description: string | null
          equipment_id: string
          id: string
          maintenance_date: string
          maintenance_type: string
          next_maintenance_date: string | null
          notes: string | null
          performed_by: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          description?: string | null
          equipment_id: string
          id?: string
          maintenance_date: string
          maintenance_type: string
          next_maintenance_date?: string | null
          notes?: string | null
          performed_by?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          description?: string | null
          equipment_id?: string
          id?: string
          maintenance_date?: string
          maintenance_type?: string
          next_maintenance_date?: string | null
          notes?: string | null
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_procurement: {
        Row: {
          created_at: string | null
          fat_percentage: number | null
          id: string
          notes: string | null
          payment_status: string | null
          procurement_date: string
          quantity_liters: number
          rate_per_liter: number | null
          recorded_by: string | null
          session: string
          snf_percentage: number | null
          total_amount: number | null
          updated_at: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Insert: {
          created_at?: string | null
          fat_percentage?: number | null
          id?: string
          notes?: string | null
          payment_status?: string | null
          procurement_date: string
          quantity_liters: number
          rate_per_liter?: number | null
          recorded_by?: string | null
          session: string
          snf_percentage?: number | null
          total_amount?: number | null
          updated_at?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Update: {
          created_at?: string | null
          fat_percentage?: number | null
          id?: string
          notes?: string | null
          payment_status?: string | null
          procurement_date?: string
          quantity_liters?: number
          rate_per_liter?: number | null
          recorded_by?: string | null
          session?: string
          snf_percentage?: number | null
          total_amount?: number | null
          updated_at?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milk_procurement_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "milk_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_production: {
        Row: {
          cattle_id: string
          created_at: string | null
          fat_percentage: number | null
          id: string
          production_date: string
          quality_notes: string | null
          quantity_liters: number
          recorded_by: string | null
          session: string
          snf_percentage: number | null
        }
        Insert: {
          cattle_id: string
          created_at?: string | null
          fat_percentage?: number | null
          id?: string
          production_date: string
          quality_notes?: string | null
          quantity_liters: number
          recorded_by?: string | null
          session: string
          snf_percentage?: number | null
        }
        Update: {
          cattle_id?: string
          created_at?: string | null
          fat_percentage?: number | null
          id?: string
          production_date?: string
          quality_notes?: string | null
          quantity_liters?: number
          recorded_by?: string | null
          session?: string
          snf_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "milk_production_cattle_id_fkey"
            columns: ["cattle_id"]
            isOneToOne: false
            referencedRelation: "cattle"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_vendors: {
        Row: {
          address: string | null
          area: string | null
          created_at: string | null
          current_balance: number | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          area?: string | null
          created_at?: string | null
          current_balance?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          area?: string | null
          created_at?: string | null
          current_balance?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          body: string
          channel: string
          created_at: string | null
          error_message: string | null
          id: string
          recipient_contact: string | null
          recipient_id: string
          recipient_type: string
          sent_at: string | null
          status: string | null
          subject: string | null
          template_id: string | null
        }
        Insert: {
          body: string
          channel: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          recipient_contact?: string | null
          recipient_id: string
          recipient_type: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_id?: string | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          recipient_contact?: string | null
          recipient_id?: string
          recipient_type?: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body: string
          channel: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          subject: string | null
          template_type: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          body: string
          channel: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject?: string | null
          template_type: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string | null
          template_type?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          customer_id: string
          id: string
          invoice_id: string | null
          notes: string | null
          payment_date: string
          payment_mode: string
          recorded_by: string | null
          reference_number: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          customer_id: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date: string
          payment_mode: string
          recorded_by?: string | null
          reference_number?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          customer_id?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_mode?: string
          recorded_by?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_delivery_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_records: {
        Row: {
          base_salary: number
          bonus: number | null
          created_at: string | null
          created_by: string | null
          deductions: number | null
          employee_id: string
          id: string
          net_salary: number
          notes: string | null
          overtime_hours: number | null
          overtime_rate: number | null
          pay_period_end: string
          pay_period_start: string
          payment_date: string | null
          payment_mode: string | null
          payment_status: string | null
        }
        Insert: {
          base_salary?: number
          bonus?: number | null
          created_at?: string | null
          created_by?: string | null
          deductions?: number | null
          employee_id: string
          id?: string
          net_salary?: number
          notes?: string | null
          overtime_hours?: number | null
          overtime_rate?: number | null
          pay_period_end: string
          pay_period_start: string
          payment_date?: string | null
          payment_mode?: string | null
          payment_status?: string | null
        }
        Update: {
          base_salary?: number
          bonus?: number | null
          created_at?: string | null
          created_by?: string | null
          deductions?: number | null
          employee_id?: string
          id?: string
          net_salary?: number
          notes?: string | null
          overtime_hours?: number | null
          overtime_rate?: number | null
          pay_period_end?: string
          pay_period_start?: string
          payment_date?: string | null
          payment_mode?: string | null
          payment_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_auditor_view"
            referencedColumns: ["id"]
          },
        ]
      }
      price_rules: {
        Row: {
          adjustment_type: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          max_fat_percentage: number | null
          max_snf_percentage: number | null
          min_fat_percentage: number | null
          min_snf_percentage: number | null
          name: string
          price_adjustment: number
          product_id: string | null
          updated_at: string | null
        }
        Insert: {
          adjustment_type?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_fat_percentage?: number | null
          max_snf_percentage?: number | null
          min_fat_percentage?: number | null
          min_snf_percentage?: number | null
          name: string
          price_adjustment?: number
          product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          adjustment_type?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_fat_percentage?: number | null
          max_snf_percentage?: number | null
          min_fat_percentage?: number | null
          min_snf_percentage?: number | null
          name?: string
          price_adjustment?: number
          product_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          category: string
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          tax_percentage: number | null
          unit: string
          updated_at: string | null
        }
        Insert: {
          base_price: number
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          tax_percentage?: number | null
          unit?: string
          updated_at?: string | null
        }
        Update: {
          base_price?: number
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          tax_percentage?: number | null
          unit?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          pin_hash: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name: string
          id: string
          is_active?: boolean | null
          phone?: string | null
          pin_hash?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          pin_hash?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      route_stops: {
        Row: {
          created_at: string | null
          customer_id: string
          estimated_arrival_time: string | null
          id: string
          notes: string | null
          route_id: string
          stop_order: number
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          estimated_arrival_time?: string | null
          id?: string
          notes?: string | null
          route_id: string
          stop_order: number
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          estimated_arrival_time?: string | null
          id?: string
          notes?: string | null
          route_id?: string
          stop_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_delivery_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          area: string | null
          assigned_staff: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          sequence_order: number | null
        }
        Insert: {
          area?: string | null
          assigned_staff?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sequence_order?: number | null
        }
        Update: {
          area?: string | null
          assigned_staff?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sequence_order?: number | null
        }
        Relationships: []
      }
      shifts: {
        Row: {
          created_at: string | null
          end_time: string
          id: string
          is_active: boolean | null
          name: string
          start_time: string
        }
        Insert: {
          created_at?: string | null
          end_time: string
          id?: string
          is_active?: boolean | null
          name: string
          start_time: string
        }
        Update: {
          created_at?: string | null
          end_time?: string
          id?: string
          is_active?: boolean | null
          name?: string
          start_time?: string
        }
        Relationships: []
      }
      telegram_config: {
        Row: {
          chat_id: string
          chat_name: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          large_payment_threshold: number | null
          notify_daily_summary: boolean | null
          notify_deliveries: boolean | null
          notify_health_alerts: boolean | null
          notify_inventory_alerts: boolean | null
          notify_payments: boolean | null
          notify_procurement: boolean | null
          notify_production: boolean | null
          updated_at: string | null
        }
        Insert: {
          chat_id: string
          chat_name?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          large_payment_threshold?: number | null
          notify_daily_summary?: boolean | null
          notify_deliveries?: boolean | null
          notify_health_alerts?: boolean | null
          notify_inventory_alerts?: boolean | null
          notify_payments?: boolean | null
          notify_procurement?: boolean | null
          notify_production?: boolean | null
          updated_at?: string | null
        }
        Update: {
          chat_id?: string
          chat_name?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          large_payment_threshold?: number | null
          notify_daily_summary?: boolean | null
          notify_deliveries?: boolean | null
          notify_health_alerts?: boolean | null
          notify_inventory_alerts?: boolean | null
          notify_payments?: boolean | null
          notify_procurement?: boolean | null
          notify_production?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_mode: string
          recorded_by: string | null
          reference_number: string | null
          vendor_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_mode?: string
          recorded_by?: string | null
          reference_number?: string | null
          vendor_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_mode?: string
          recorded_by?: string | null
          reference_number?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "milk_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      customer_accounts_safe: {
        Row: {
          approval_status: string | null
          created_at: string | null
          customer_id: string | null
          id: string | null
          is_approved: boolean | null
          last_login: string | null
          phone: string | null
        }
        Insert: {
          approval_status?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string | null
          is_approved?: boolean | null
          last_login?: string | null
          phone?: string | null
        }
        Update: {
          approval_status?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string | null
          is_approved?: boolean | null
          last_login?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers_delivery_view"
            referencedColumns: ["id"]
          },
        ]
      }
      customers_delivery_view: {
        Row: {
          address: string | null
          area: string | null
          id: string | null
          name: string | null
          phone: string | null
          route_id: string | null
          subscription_type: string | null
        }
        Insert: {
          address?: string | null
          area?: string | null
          id?: string | null
          name?: string | null
          phone?: string | null
          route_id?: string | null
          subscription_type?: string | null
        }
        Update: {
          address?: string | null
          area?: string | null
          id?: string | null
          name?: string | null
          phone?: string | null
          route_id?: string | null
          subscription_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_customer_route"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      dairy_settings_public: {
        Row: {
          address: string | null
          currency: string | null
          dairy_name: string | null
          email: string | null
          invoice_prefix: string | null
          logo_url: string | null
          phone: string | null
        }
        Relationships: []
      }
      employees_auditor_view: {
        Row: {
          created_at: string | null
          id: string | null
          is_active: boolean | null
          joining_date: string | null
          name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          joining_date?: string | null
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          joining_date?: string | null
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles_safe: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_create_staff: {
        Args: {
          _full_name: string
          _phone: string
          _pin: string
          _role: Database["public"]["Enums"]["user_role"]
          _session_token: string
        }
        Returns: Json
      }
      admin_create_staff_user: {
        Args: {
          _full_name: string
          _phone: string
          _pin: string
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: Json
      }
      admin_delete_staff_v2: {
        Args: { _session_token: string; _target_user_id: string }
        Returns: Json
      }
      admin_delete_user:
        | { Args: { _target_user_id: string }; Returns: Json }
        | {
            Args: { _permanent?: boolean; _target_user_id: string }
            Returns: Json
          }
      admin_reactivate_user: {
        Args: {
          _full_name: string
          _pin: string
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: Json
      }
      admin_reset_user_pin: {
        Args: { _new_pin: string; _target_user_id: string }
        Returns: Json
      }
      admin_update_user_status: {
        Args: { _is_active: boolean; _target_user_id: string }
        Returns: Json
      }
      auto_create_daily_attendance: { Args: never; Returns: undefined }
      bootstrap_super_admin: {
        Args: { _phone: string; _pin: string }
        Returns: Json
      }
      change_own_pin: {
        Args: { _current_pin: string; _new_pin: string }
        Returns: Json
      }
      check_phone_availability: { Args: { _phone: string }; Returns: Json }
      cleanup_expired_sessions: { Args: never; Returns: undefined }
      customer_change_pin: {
        Args: { _current_pin: string; _new_pin: string; _session_token: string }
        Returns: Json
      }
      customer_login: { Args: { _phone: string; _pin: string }; Returns: Json }
      customer_logout: { Args: { _session_token: string }; Returns: Json }
      customer_register: {
        Args: { _phone: string; _pin: string }
        Returns: Json
      }
      get_customer_id_from_session: { Args: never; Returns: string }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["user_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_pin_for_customer: { Args: { _pin: string }; Returns: string }
      is_authenticated: { Args: never; Returns: boolean }
      is_customer_on_vacation: {
        Args: { _check_date?: string; _customer_id: string }
        Returns: boolean
      }
      is_manager_or_admin: { Args: { _user_id: string }; Returns: boolean }
      recalculate_vendor_balance: {
        Args: { p_vendor_id: string }
        Returns: number
      }
      register_customer_account: {
        Args: { _phone: string; _pin: string }
        Returns: Json
      }
      run_auto_delivery: { Args: never; Returns: Json }
      setup_initial_admin: { Args: never; Returns: undefined }
      staff_login: { Args: { _phone: string; _pin: string }; Returns: Json }
      staff_logout: { Args: { _session_token: string }; Returns: Json }
      update_customer_pin: {
        Args: { _current_pin: string; _customer_id: string; _new_pin: string }
        Returns: Json
      }
      update_pin_only: {
        Args: { _pin: string; _user_id: string }
        Returns: undefined
      }
      update_user_profile_with_pin: {
        Args: {
          _full_name: string
          _phone: string
          _pin: string
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: undefined
      }
      validate_customer_session: {
        Args: { _session_token: string }
        Returns: Json
      }
      validate_session: { Args: { _session_token: string }; Returns: Json }
      verify_customer_pin: {
        Args: { _phone: string; _pin: string }
        Returns: {
          customer_id: string
          is_approved: boolean
          user_id: string
        }[]
      }
      verify_pin: { Args: { _phone: string; _pin: string }; Returns: string }
      verify_staff_pin: {
        Args: { _phone: string; _pin: string }
        Returns: {
          full_name: string
          is_active: boolean
          role: string
          user_id: string
        }[]
      }
    }
    Enums: {
      bottle_size: "500ml" | "1L" | "2L"
      bottle_type: "glass" | "plastic"
      cattle_status: "active" | "sold" | "deceased" | "dry"
      delivery_status: "pending" | "delivered" | "missed" | "partial"
      lactation_status: "lactating" | "dry" | "pregnant" | "calving"
      payment_status: "paid" | "partial" | "pending" | "overdue"
      user_role:
        | "super_admin"
        | "manager"
        | "accountant"
        | "delivery_staff"
        | "farm_worker"
        | "vet_staff"
        | "auditor"
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
      bottle_size: ["500ml", "1L", "2L"],
      bottle_type: ["glass", "plastic"],
      cattle_status: ["active", "sold", "deceased", "dry"],
      delivery_status: ["pending", "delivered", "missed", "partial"],
      lactation_status: ["lactating", "dry", "pregnant", "calving"],
      payment_status: ["paid", "partial", "pending", "overdue"],
      user_role: [
        "super_admin",
        "manager",
        "accountant",
        "delivery_staff",
        "farm_worker",
        "vet_staff",
        "auditor",
      ],
    },
  },
} as const
