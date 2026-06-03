import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 更新为硬件输出的三个数值对应的行为
export type BehaviorType = 'idle' | 'light_press' | 'normal_press' | 'hard_press';
export type MindfulnessState = 'positive' | 'negative' | 'transforming' | 'idle';
export type AppPhase = 'idle' | 'monitoring' | 'evaluating' | 'narrative' | 'dissolving';
export type NarrativeStep = 0 | 1 | 2 | 3 | 4 | 5;
export type ActiveTab = 'monitor' | 'guide';
export type DeviceStatus = 'disconnected' | 'connecting' | 'connected';

export interface Role {
  id: string;
  name: string;
  color: string;
  gradient: string; // 引入渐变色提升质感
  description: string;
}

export interface SessionRecord {
  id: string;
  timestamp: number;
  duration: number; // seconds
  startState: MindfulnessState;
  endState: MindfulnessState;
  negativeCount: number;
  successTransform: boolean;
}

interface AppState {
  // Device connection
  deviceStatus: DeviceStatus;
  setDeviceStatus: (status: DeviceStatus) => void;

  // Tabs & Mode
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;

  // Real-time behavior state
  currentBehavior: BehaviorType;
  setCurrentBehavior: (behavior: BehaviorType) => void;
  currentPressure: number; // 0.0 - 1.0
  setCurrentPressure: (pressure: number) => void;
  
  // Phase & Evaluation
  appPhase: AppPhase;
  setAppPhase: (phase: AppPhase) => void;
  behaviorHistory: BehaviorType[];
  addBehaviorToHistory: (behavior: BehaviorType) => void;
  clearBehaviorHistory: () => void;

  mindfulnessState: MindfulnessState;
  setMindfulnessState: (state: MindfulnessState) => void;

  // Narrative state
  narrativeStep: NarrativeStep;
  setNarrativeStep: (step: NarrativeStep) => void;
  narrativePressCount: number;
  setNarrativePressCount: (count: number) => void;

  // Role
  currentRole: Role | null;
  setCurrentRole: (role: Role) => void;

  // History & Records
  records: SessionRecord[];
  addRecord: (record: SessionRecord) => void;
  clearRecords: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      deviceStatus: 'disconnected',
      setDeviceStatus: (status) => set({ deviceStatus: status }),

      activeTab: 'monitor',
      setActiveTab: (tab) => set({ activeTab: tab }),

      currentBehavior: 'idle',
      setCurrentBehavior: (behavior) => set({ currentBehavior: behavior }),
      
      currentPressure: 0,
      setCurrentPressure: (pressure) => set({ currentPressure: pressure }),

      appPhase: 'idle',
      setAppPhase: (phase) => set({ appPhase: phase }),
      behaviorHistory: [],
      addBehaviorToHistory: (behavior) => set((state) => ({ 
        behaviorHistory: [...state.behaviorHistory, behavior] 
      })),
      clearBehaviorHistory: () => set({ behaviorHistory: [] }),

      mindfulnessState: 'idle',
      setMindfulnessState: (state) => set({ mindfulnessState: state }),

      narrativeStep: 0,
      setNarrativeStep: (step) => set({ narrativeStep: step }),
      narrativePressCount: 0,
      setNarrativePressCount: (count) => set({ narrativePressCount: count }),

      currentRole: null,
      setCurrentRole: (role) => set({ currentRole: role }),

      records: [],
      addRecord: (record) => set((state) => ({ records: [...state.records, record] })),
      clearRecords: () => set({ records: [] }),
    }),
    {
      name: 'ai-builder-storage',
      partialize: (state) => ({ 
        currentRole: state.currentRole,
        records: state.records 
      }), // Only persist role and records
    }
  )
);
