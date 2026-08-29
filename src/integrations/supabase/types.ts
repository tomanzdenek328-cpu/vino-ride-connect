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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      cash_payouts: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          driver_id: string
          id: string
          reason: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          driver_id: string
          id?: string
          reason?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          driver_id?: string
          id?: string
          reason?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          participants: string[] | null
          sender_id: string
          thread_key: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          participants?: string[] | null
          sender_id: string
          thread_key: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          participants?: string[] | null
          sender_id?: string
          thread_key?: string
        }
        Relationships: []
      }
      driver_locations: {
        Row: {
          busy: boolean
          driver_id: string
          heading: number | null
          lat: number | null
          lng: number | null
          online: boolean
          speed: number | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          busy?: boolean
          driver_id: string
          heading?: number | null
          lat?: number | null
          lng?: number | null
          online?: boolean
          speed?: number | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          busy?: boolean
          driver_id?: string
          heading?: number | null
          lat?: number | null
          lng?: number | null
          online?: boolean
          speed?: number | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fcm_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string | null
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          approval: string
          assigned_driver_id: string | null
          assigned_driver_ids: string[]
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          customer_name: string | null
          customer_phone: string | null
          destination: string | null
          destination_lat: number | null
          destination_lng: number | null
          driver_arrived_at: string | null
          estimated_distance_km: number | null
          estimated_price: number | null
          id: string
          notes: string | null
          passengers: number
          pickup_address: string
          pickup_lat: number | null
          pickup_lng: number | null
          priority: boolean
          released: boolean
          scheduled_time: string | null
          source: string
          status: Database["public"]["Enums"]["order_status"]
          tracking_code: string | null
          updated_at: string
          vehicle_type: string | null
        }
        Insert: {
          approval?: string
          assigned_driver_id?: string | null
          assigned_driver_ids?: string[]
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          destination?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          driver_arrived_at?: string | null
          estimated_distance_km?: number | null
          estimated_price?: number | null
          id?: string
          notes?: string | null
          passengers?: number
          pickup_address: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          priority?: boolean
          released?: boolean
          scheduled_time?: string | null
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          tracking_code?: string | null
          updated_at?: string
          vehicle_type?: string | null
        }
        Update: {
          approval?: string
          assigned_driver_id?: string | null
          assigned_driver_ids?: string[]
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          destination?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          driver_arrived_at?: string | null
          estimated_distance_km?: number | null
          estimated_price?: number | null
          id?: string
          notes?: string | null
          passengers?: number
          pickup_address?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          priority?: boolean
          released?: boolean
          scheduled_time?: string | null
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          tracking_code?: string | null
          updated_at?: string
          vehicle_type?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          call_sign: string
          created_at: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          call_sign?: string
          created_at?: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          call_sign?: string
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rides: {
        Row: {
          amount: number
          completed_at: string
          created_at: string
          destination: string | null
          driver_id: string
          id: string
          order_id: string | null
          payment_method: string
          pickup_address: string | null
          plate: string | null
        }
        Insert: {
          amount: number
          completed_at?: string
          created_at?: string
          destination?: string | null
          driver_id: string
          id?: string
          order_id?: string | null
          payment_method: string
          pickup_address?: string | null
          plate?: string | null
        }
        Update: {
          amount?: number
          completed_at?: string
          created_at?: string
          destination?: string | null
          driver_id?: string
          id?: string
          order_id?: string | null
          payment_method?: string
          pickup_address?: string | null
          plate?: string | null
        }
        Relationships: []
      }
      sos_alerts: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          lat: number | null
          lng: number | null
          resolved_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          resolved_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          resolved_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: []
      }
      tariffs: {
        Row: {
          base_fare: number
          capacity: number
          created_at: string
          hourly_extra_km: number
          hourly_next_hour: number
          hourly_next_km: number
          hourly_rate: number
          hustopece_flat: number
          hustopece_flat_weekend: number
          id: string
          included_km: number
          label: string
          mikulov_flat: number
          mikulov_flat_weekend: number
          per_km: number
          short_base_fare: number
          short_base_fare_weekend: number
          short_km_limit: number
          short_per_km: number
          short_per_km_weekend: number
          sort_order: number
          updated_at: string
          vehicle_type: string
          weekend_base_fare: number
          weekend_per_km: number
        }
        Insert: {
          base_fare?: number
          capacity?: number
          created_at?: string
          hourly_extra_km?: number
          hourly_next_hour?: number
          hourly_next_km?: number
          hourly_rate?: number
          hustopece_flat?: number
          hustopece_flat_weekend?: number
          id?: string
          included_km?: number
          label: string
          mikulov_flat?: number
          mikulov_flat_weekend?: number
          per_km?: number
          short_base_fare?: number
          short_base_fare_weekend?: number
          short_km_limit?: number
          short_per_km?: number
          short_per_km_weekend?: number
          sort_order?: number
          updated_at?: string
          vehicle_type: string
          weekend_base_fare?: number
          weekend_per_km?: number
        }
        Update: {
          base_fare?: number
          capacity?: number
          created_at?: string
          hourly_extra_km?: number
          hourly_next_hour?: number
          hourly_next_km?: number
          hourly_rate?: number
          hustopece_flat?: number
          hustopece_flat_weekend?: number
          id?: string
          included_km?: number
          label?: string
          mikulov_flat?: number
          mikulov_flat_weekend?: number
          per_km?: number
          short_base_fare?: number
          short_base_fare_weekend?: number
          short_km_limit?: number
          short_per_km?: number
          short_per_km_weekend?: number
          sort_order?: number
          updated_at?: string
          vehicle_type?: string
          weekend_base_fare?: number
          weekend_per_km?: number
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
      vehicles: {
        Row: {
          active: boolean
          car_type: string
          created_at: string
          id: string
          notes: string | null
          photo_url: string | null
          plate: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          car_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          photo_url?: string | null
          plate: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          car_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          photo_url?: string | null
          plate?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "dispatcher" | "driver"
      order_status:
        | "pending"
        | "assigned"
        | "accepted"
        | "in_progress"
        | "completed"
        | "cancelled"
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
      app_role: ["dispatcher", "driver"],
      order_status: [
        "pending",
        "assigned",
        "accepted",
        "in_progress",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
