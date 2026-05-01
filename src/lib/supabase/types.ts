export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      block_exercises: {
        Row: {
          block_id: string;
          display_order: number;
          exercise_id: string;
        };
        Insert: {
          block_id: string;
          display_order?: number;
          exercise_id: string;
        };
        Update: {
          block_id?: string;
          display_order?: number;
          exercise_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "block_exercises_block_id_fkey";
            columns: ["block_id"];
            isOneToOne: false;
            referencedRelation: "blocks";
            referencedColumns: ["block_id"];
          },
          {
            foreignKeyName: "block_exercises_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["exercise_id"];
          },
        ];
      };
      blocks: {
        Row: {
          block_id: string;
          block_name: string;
          block_type: Database["public"]["Enums"]["block_type_enum"];
          display_order: number;
          session_id: string;
        };
        Insert: {
          block_id?: string;
          block_name: string;
          block_type?: Database["public"]["Enums"]["block_type_enum"];
          display_order: number;
          session_id: string;
        };
        Update: {
          block_id?: string;
          block_name?: string;
          block_type?: Database["public"]["Enums"]["block_type_enum"];
          display_order?: number;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blocks_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["session_id"];
          },
        ];
      };
      daily_schedules: {
        Row: {
          day_of_week: Database["public"]["Enums"]["day_of_week_enum"];
          is_rest_day: boolean;
          plan_id: string;
          schedule_id: string;
        };
        Insert: {
          day_of_week: Database["public"]["Enums"]["day_of_week_enum"];
          is_rest_day?: boolean;
          plan_id: string;
          schedule_id?: string;
        };
        Update: {
          day_of_week?: Database["public"]["Enums"]["day_of_week_enum"];
          is_rest_day?: boolean;
          plan_id?: string;
          schedule_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_schedules_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "training_plans";
            referencedColumns: ["plan_id"];
          },
        ];
      };
      exercises: {
        Row: {
          created_at: string;
          exercise_id: string;
          is_bodyweight: boolean;
          is_compound: boolean;
          muscle_groups: string[];
          name: string;
          notes: string;
          prescribed_max: number;
          prescribed_min: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          exercise_id?: string;
          is_bodyweight?: boolean;
          is_compound?: boolean;
          muscle_groups?: string[];
          name: string;
          notes?: string;
          prescribed_max: number;
          prescribed_min: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          exercise_id?: string;
          is_bodyweight?: boolean;
          is_compound?: boolean;
          muscle_groups?: string[];
          name?: string;
          notes?: string;
          prescribed_max?: number;
          prescribed_min?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      meal_entries: {
        Row: {
          calories: number;
          carbs_g: number;
          date: string;
          fat_g: number;
          logged_at: string;
          meal_id: string;
          meal_type: string;
          note: string | null;
          protein_g: number;
          user_id: string;
        };
        Insert: {
          calories: number;
          carbs_g: number;
          date: string;
          fat_g: number;
          logged_at?: string;
          meal_id?: string;
          meal_type: string;
          note?: string | null;
          protein_g: number;
          user_id: string;
        };
        Update: {
          calories?: number;
          carbs_g?: number;
          date?: string;
          fat_g?: number;
          logged_at?: string;
          meal_id?: string;
          meal_type?: string;
          note?: string | null;
          protein_g?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      nutrition_targets: {
        Row: {
          cal_max: number;
          cal_min: number;
          carbs_max_g: number;
          carbs_min_g: number;
          fat_max_g: number;
          fat_min_g: number;
          protein_max_g: number;
          protein_min_g: number;
          target_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cal_max: number;
          cal_min: number;
          carbs_max_g: number;
          carbs_min_g: number;
          fat_max_g: number;
          fat_min_g: number;
          protein_max_g: number;
          protein_min_g: number;
          target_id?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cal_max?: number;
          cal_min?: number;
          carbs_max_g?: number;
          carbs_min_g?: number;
          fat_max_g?: number;
          fat_min_g?: number;
          protein_max_g?: number;
          protein_min_g?: number;
          target_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      plan_templates: {
        Row: {
          created_at: string;
          is_public: boolean;
          owner_user_id: string;
          snapshot_json: Json;
          template_id: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          is_public?: boolean;
          owner_user_id: string;
          snapshot_json: Json;
          template_id?: string;
          version: number;
        };
        Update: {
          created_at?: string;
          is_public?: boolean;
          owner_user_id?: string;
          snapshot_json?: Json;
          template_id?: string;
          version?: number;
        };
        Relationships: [];
      };
      pr_history: {
        Row: {
          achieved_at: string;
          exercise_id: string;
          pr_id: string;
          pr_type: Database["public"]["Enums"]["pr_type_enum"];
          reps: number;
          set_log_id: string | null;
          user_id: string;
          weight_kg: number;
        };
        Insert: {
          achieved_at?: string;
          exercise_id: string;
          pr_id?: string;
          pr_type: Database["public"]["Enums"]["pr_type_enum"];
          reps: number;
          set_log_id?: string | null;
          user_id: string;
          weight_kg: number;
        };
        Update: {
          achieved_at?: string;
          exercise_id?: string;
          pr_id?: string;
          pr_type?: Database["public"]["Enums"]["pr_type_enum"];
          reps?: number;
          set_log_id?: string | null;
          user_id?: string;
          weight_kg?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pr_history_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["exercise_id"];
          },
          {
            foreignKeyName: "pr_history_set_log_id_fkey";
            columns: ["set_log_id"];
            isOneToOne: false;
            referencedRelation: "set_logs";
            referencedColumns: ["set_log_id"];
          },
        ];
      };
      profiles: {
        Row: {
          bodyweight_kg: number | null;
          created_at: string;
          display_name: string | null;
          goal_mode: Database["public"]["Enums"]["goal_mode_enum"];
          height_cm: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          bodyweight_kg?: number | null;
          created_at?: string;
          display_name?: string | null;
          goal_mode?: Database["public"]["Enums"]["goal_mode_enum"];
          height_cm?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          bodyweight_kg?: number | null;
          created_at?: string;
          display_name?: string | null;
          goal_mode?: Database["public"]["Enums"]["goal_mode_enum"];
          height_cm?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      session_completions: {
        Row: {
          completed_at: string | null;
          completed_block_ids: string[];
          completion_id: string;
          session_id: string;
          started_at: string;
          user_id: string;
          was_ended_early: boolean;
        };
        Insert: {
          completed_at?: string | null;
          completed_block_ids?: string[];
          completion_id?: string;
          session_id: string;
          started_at?: string;
          user_id: string;
          was_ended_early?: boolean;
        };
        Update: {
          completed_at?: string | null;
          completed_block_ids?: string[];
          completion_id?: string;
          session_id?: string;
          started_at?: string;
          user_id?: string;
          was_ended_early?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "session_completions_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["session_id"];
          },
        ];
      };
      sessions: {
        Row: {
          cardio_distance: string | null;
          cardio_format:
            | Database["public"]["Enums"]["cardio_format_enum"]
            | null;
          cardio_target_zone:
            | Database["public"]["Enums"]["cardio_target_zone_enum"]
            | null;
          description: string | null;
          display_order: number;
          gym: string | null;
          schedule_id: string;
          session_id: string;
          session_name: string;
          session_type: Database["public"]["Enums"]["session_type_enum"];
          timing: Database["public"]["Enums"]["timing_enum"];
        };
        Insert: {
          cardio_distance?: string | null;
          cardio_format?:
            | Database["public"]["Enums"]["cardio_format_enum"]
            | null;
          cardio_target_zone?:
            | Database["public"]["Enums"]["cardio_target_zone_enum"]
            | null;
          description?: string | null;
          display_order: number;
          gym?: string | null;
          schedule_id: string;
          session_id?: string;
          session_name: string;
          session_type: Database["public"]["Enums"]["session_type_enum"];
          timing?: Database["public"]["Enums"]["timing_enum"];
        };
        Update: {
          cardio_distance?: string | null;
          cardio_format?:
            | Database["public"]["Enums"]["cardio_format_enum"]
            | null;
          cardio_target_zone?:
            | Database["public"]["Enums"]["cardio_target_zone_enum"]
            | null;
          description?: string | null;
          display_order?: number;
          gym?: string | null;
          schedule_id?: string;
          session_id?: string;
          session_name?: string;
          session_type?: Database["public"]["Enums"]["session_type_enum"];
          timing?: Database["public"]["Enums"]["timing_enum"];
        };
        Relationships: [
          {
            foreignKeyName: "sessions_schedule_id_fkey";
            columns: ["schedule_id"];
            isOneToOne: false;
            referencedRelation: "daily_schedules";
            referencedColumns: ["schedule_id"];
          },
        ];
      };
      set_logs: {
        Row: {
          block_id: string;
          exercise_id: string;
          is_to_failure: boolean;
          logged_at: string;
          notes: string | null;
          prescribed_max: number;
          prescribed_min: number;
          reps: number;
          session_id: string;
          set_index: number;
          set_log_id: string;
          user_id: string;
          weight_kg: number | null;
        };
        Insert: {
          block_id: string;
          exercise_id: string;
          is_to_failure?: boolean;
          logged_at?: string;
          notes?: string | null;
          prescribed_max: number;
          prescribed_min: number;
          reps: number;
          session_id: string;
          set_index: number;
          set_log_id?: string;
          user_id: string;
          weight_kg?: number | null;
        };
        Update: {
          block_id?: string;
          exercise_id?: string;
          is_to_failure?: boolean;
          logged_at?: string;
          notes?: string | null;
          prescribed_max?: number;
          prescribed_min?: number;
          reps?: number;
          session_id?: string;
          set_index?: number;
          set_log_id?: string;
          user_id?: string;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "set_logs_block_id_fkey";
            columns: ["block_id"];
            isOneToOne: false;
            referencedRelation: "blocks";
            referencedColumns: ["block_id"];
          },
          {
            foreignKeyName: "set_logs_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["exercise_id"];
          },
          {
            foreignKeyName: "set_logs_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["session_id"];
          },
        ];
      };
      training_plans: {
        Row: {
          created_at: string;
          is_active: boolean;
          name: string;
          plan_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          is_active?: boolean;
          name: string;
          plan_id?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          is_active?: boolean;
          name?: string;
          plan_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      block_type_enum: "failure" | "mobility" | "corrective";
      cardio_format_enum: "speed_run" | "endurance_run" | "basketball";
      cardio_target_zone_enum: "sprint" | "zone_2" | "anaerobic" | "game_pace";
      day_of_week_enum: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
      goal_mode_enum: "cut" | "maintain" | "lean_bulk";
      pr_type_enum: "weight" | "in_range_rep";
      session_type_enum: "lifting" | "cardio" | "recovery";
      timing_enum: "am" | "pm" | "anytime";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      block_type_enum: ["failure", "mobility", "corrective"],
      cardio_format_enum: ["speed_run", "endurance_run", "basketball"],
      cardio_target_zone_enum: ["sprint", "zone_2", "anaerobic", "game_pace"],
      day_of_week_enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      goal_mode_enum: ["cut", "maintain", "lean_bulk"],
      pr_type_enum: ["weight", "in_range_rep"],
      session_type_enum: ["lifting", "cardio", "recovery"],
      timing_enum: ["am", "pm", "anytime"],
    },
  },
} as const;
