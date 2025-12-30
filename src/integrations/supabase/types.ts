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
      cattle: {
        Row: {
          breed: string
          cattle_type: string
          created_at: string | null
          created_by: string | null
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
          status?: Database["public"]["Enums"]["cattle_status"] | null
          tag_number?: string
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: []
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
            foreignKeyName: "customer_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      is_authenticated: { Args: never; Returns: boolean }
      is_manager_or_admin: { Args: { _user_id: string }; Returns: boolean }
      setup_initial_admin: { Args: never; Returns: undefined }
      verify_pin: { Args: { _phone: string; _pin: string }; Returns: string }
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
