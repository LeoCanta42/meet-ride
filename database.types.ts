export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizers: {
        Row: {
          id: string
          email: string
          name: string
          password_hash: string | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          password_hash?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          password_hash?: string | null
          created_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          id: string
          organizer_id: string | null
          slug: string
          title: string
          description: string | null
          destination: string
          destination_lat: number | null
          destination_lng: number | null
          event_date: string
          shared_password: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organizer_id?: string | null
          slug: string
          title: string
          description?: string | null
          destination: string
          destination_lat?: number | null
          destination_lng?: number | null
          event_date: string
          shared_password: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organizer_id?: string | null
          slug?: string
          title?: string
          description?: string | null
          destination?: string
          destination_lat?: number | null
          destination_lng?: number | null
          event_date?: string
          shared_password?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'events_organizer_id_fkey'
            columns: ['organizer_id']
            isOneToOne: false
            referencedRelation: 'organizers'
            referencedColumns: ['id']
          }
        ]
      }
      participants: {
        Row: {
          id: string
          event_id: string
          name: string
          role: 'rider' | 'passenger'
          phone: string | null
          pin: string | null
          notes: string | null
          pickup_location: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          car_model: string | null
          total_seats: number | null
          price: number | null
          departure_time: string | null
          departure_location: string | null
          departure_lat: number | null
          departure_lng: number | null
          assigned_rider_id: string | null
          token: string
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          name: string
          role: 'rider' | 'passenger'
          phone?: string | null
          pin?: string | null
          notes?: string | null
          pickup_location?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          car_model?: string | null
          total_seats?: number | null
          price?: number | null
          departure_time?: string | null
          departure_location?: string | null
          departure_lat?: number | null
          departure_lng?: number | null
          assigned_rider_id?: string | null
          token: string
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          name?: string
          role?: 'rider' | 'passenger'
          phone?: string | null
          pin?: string | null
          notes?: string | null
          pickup_location?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          car_model?: string | null
          total_seats?: number | null
          price?: number | null
          departure_time?: string | null
          departure_location?: string | null
          departure_lat?: number | null
          departure_lng?: number | null
          assigned_rider_id?: string | null
          token?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'participants_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'participants_assigned_rider_id_fkey'
            columns: ['assigned_rider_id']
            isOneToOne: false
            referencedRelation: 'participants'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      verify_event_password: {
        Args: {
          p_event_id: string
          p_password: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
