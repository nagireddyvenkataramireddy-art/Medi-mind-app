

export enum FrequencyType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  AS_NEEDED = 'AS_NEEDED',
  INTERVAL = 'INTERVAL'
}

export type SoundType = 'default' | 'chime' | 'alert' | 'soft' | 'harp' | 'nature' | 'arcade' | 'glass' | 'shimmer' | 'echo';

export interface Profile {
  id: string;
  name: string;
  avatar: string; // emoji or color
  themeColor: string;
  preferredSound?: SoundType;
  // Extended Health Profile
  gender?: 'Male' | 'Female' | 'Other';
  age?: string;
  bloodType?: string;
  height?: string;
  weight?: string;
  allergies?: string[]; // Array of strings for tags
  conditions?: string[]; // Array of strings for tags
  insurance?: {
    provider: string;
    policyNumber: string;
    groupNumber?: string;
    holderName?: string;
  };
  emergencyContact?: {
    name: string;
    relation: string;
    phone: string;
  };
}

export interface Medication {
  id: string;
  profileId?: string; // Links data to a specific user profile
  name: string;
  dosage: string;
  frequency: FrequencyType;
  times: string[]; // "HH:mm" format 24h
  daysOfWeek?: number[]; // 0-6 for Sunday-Saturday, used if WEEKLY
  interval?: number; // in minutes, used if INTERVAL
  startTime?: string; // used if INTERVAL
  startDate?: string; // YYYY-MM-DD
  notes?: string;
  color: string;
  icon: string; // key for lucide icon
  currentStock: number;
  lowStockThreshold: number;
  expiryDate?: string; // YYYY-MM-DD
  refillDate?: string; // YYYY-MM-DD
  reminderSound?: SoundType;
}

export interface LogEntry {
  id: string;
  profileId?: string;
  medicationId: string;
  timestamp: number;
  status: 'TAKEN' | 'SKIPPED';
  scheduledTime?: string; // The time slot this log corresponds to (for daily/weekly)
  dateStr: string; // YYYY-MM-DD for easy grouping
}

export interface Appointment {
  id: string;
  profileId?: string;
  doctorName: string;
  specialty: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  location?: string;
  notes?: string;
}

export interface ParsedMedicationSchedule {
  name: string;
  dosage: string;
  frequency: FrequencyType;
  times: string[];
  daysOfWeek?: number[];
  notes?: string;
  currentStock?: number;
}

export interface DrugInfo {
  description: string;
  sideEffects: string[];
  tips: string;
}

export interface Interaction {
  medication1: string;
  medication2: string;
  severity: 'HIGH' | 'MODERATE' | 'LOW';
  description: string;
}

export interface InteractionAnalysis {
  interactions: Interaction[];
  summary: string;
  safeToTake: boolean;
}

export interface ConditionAdvice {
  condition: string;
  recommendedFoods: string[];
  avoidFoods: string[];
  lifestyleTips: string[];
}

export type VitalType = 'BLOOD_PRESSURE' | 'GLUCOSE' | 'HEART_RATE' | 'WEIGHT';

export interface VitalEntry {
  id: string;
  profileId?: string;
  type: VitalType;
  value: string; // stored as string to handle "120/80"
  unit: string;
  dateStr: string;
  timestamp: number;
}

export type MoodType = 'GREAT' | 'GOOD' | 'OKAY' | 'LOW' | 'PAIN';

export interface MoodEntry {
  id: string;
  profileId?: string;
  type: MoodType;
  note?: string;
  timestamp: number;
  dateStr: string;
}

export interface SnoozeEntry {
  medicationId: string;
  scheduledTime: string;
  wakeUpTime: number;
}

export interface PlaceResult {
  title: string;
  uri: string;
}

export interface PharmacySearchResponse {
  text: string;
  places: PlaceResult[];
}

export interface WellnessGoal {
  id: string;
  title: string;
  target: number;
  current: number;
  unit: string;
  icon: 'water' | 'exercise' | 'sleep' | 'mindfulness' | 'steps' | 'food';
  dateStr: string; // Last updated date to handle resets
}
