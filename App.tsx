
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Medication, LogEntry, FrequencyType, VitalEntry, Appointment, MoodEntry, MoodType, SnoozeEntry, Profile, WellnessGoal } from './types';
import Dashboard from './components/Dashboard';
import AddMedicationModal from './components/AddMedicationModal';
import HistoryView from './components/HistoryView';
import CareView from './components/CareView';
import VitalsView from './components/VitalsView';
import AssistantView from './components/AssistantView';
import SettingsModal from './components/SettingsModal';
import OnboardingModal from './components/OnboardingModal';
import { playNotificationSound, initAudio } from './services/audioService';
import { Plus, Bell, BellRing, Home, Calendar, Activity, MessageSquareMore, HeartHandshake, UserCircle, Pill, Sparkles, ChevronDown, Users, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'vitals' | 'care' | 'chat'>('home');
  
  // Safe JSON Parse Helper
  const safeParse = (key: string, fallback: any) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch (e) {
      console.error(`Error parsing ${key}`, e);
      return fallback;
    }
  };

  // Profile State
  const [profiles, setProfiles] = useState<Profile[]>(() => 
    safeParse('medimind_profiles', [{ id: 'default', name: 'Myself', avatar: '👤', themeColor: 'blue', allergies: [], conditions: [] }])
  );
  
  const [activeProfileId, setActiveProfileId] = useState<string>(() => 
    localStorage.getItem('medimind_active_profile') || 'default'
  );

  const [medications, setMedications] = useState<Medication[]>(() => safeParse('medimind_meds', []));
  const [logs, setLogs] = useState<LogEntry[]>(() => safeParse('medimind_logs', []));
  const [vitals, setVitals] = useState<VitalEntry[]>(() => safeParse('medimind_vitals', []));
  const [appointments, setAppointments] = useState<Appointment[]>(() => safeParse('medimind_appointments', []));
  const [moods, setMoods] = useState<MoodEntry[]>(() => safeParse('medimind_moods', []));
  const [wellnessGoals, setWellnessGoals] = useState<WellnessGoal[]>(() => safeParse('medimind_goals', []));
  
  const [snoozedItems, setSnoozedItems] = useState<SnoozeEntry[]>([]);
  
  // Bluetooth State
  const [bluetoothDevice, setBluetoothDevice] = useState<any>(null); // Type 'any' to avoid strict WebBluetooth types issues in some environments
  const [bluetoothServer, setBluetoothServer] = useState<any>(null);
  const [fireBolttConnected, setFireBolttConnected] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  
  // In-App Toast State
  const [toast, setToast] = useState<{title: string, message: string} | null>(null);
  
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'default'
  );

  const lastCheckedMinuteRef = useRef<string>('');

  // Check for first time onboarding
  useEffect(() => {
    const hasOnboarded = localStorage.getItem('medimind_onboarding_complete');
    if (!hasOnboarded) {
      setIsOnboardingOpen(true);
    }
  }, []);

  // Initialize Audio Context on first interaction to allow sounds to play later
  useEffect(() => {
    const handleInteraction = () => {
      initAudio();
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  const handleFinishOnboarding = () => {
    localStorage.setItem('medimind_onboarding_complete', 'true');
    setIsOnboardingOpen(false);
    // Open Add Medication Modal to encourage first action
    setIsAddModalOpen(true);
  };

  // Save Data
  useEffect(() => { localStorage.setItem('medimind_profiles', JSON.stringify(profiles)); }, [profiles]);
  useEffect(() => { localStorage.setItem('medimind_active_profile', activeProfileId); }, [activeProfileId]);
  useEffect(() => { localStorage.setItem('medimind_meds', JSON.stringify(medications)); }, [medications]);
  useEffect(() => { localStorage.setItem('medimind_logs', JSON.stringify(logs)); }, [logs]);
  useEffect(() => { localStorage.setItem('medimind_vitals', JSON.stringify(vitals)); }, [vitals]);
  useEffect(() => { localStorage.setItem('medimind_appointments', JSON.stringify(appointments)); }, [appointments]);
  useEffect(() => { localStorage.setItem('medimind_moods', JSON.stringify(moods)); }, [moods]);
  useEffect(() => { localStorage.setItem('medimind_goals', JSON.stringify(wellnessGoals)); }, [wellnessGoals]);

  // Check and reset daily goals
  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setWellnessGoals(prev => prev.map(g => {
      if (g.dateStr !== today) {
        return { ...g, current: 0, dateStr: today };
      }
      return g;
    }));
  }, []);

  // Derived filtered data for the current profile
  const currentMedications = useMemo(() => 
    medications.filter(m => m.profileId === activeProfileId || (!m.profileId && activeProfileId === 'default')), 
  [medications, activeProfileId]);
  
  const currentLogs = useMemo(() => 
    logs.filter(l => l.profileId === activeProfileId || (!l.profileId && activeProfileId === 'default')), 
  [logs, activeProfileId]);

  const currentVitals = useMemo(() => 
    vitals.filter(v => v.profileId === activeProfileId || (!v.profileId && activeProfileId === 'default')), 
  [vitals, activeProfileId]);

  const currentAppointments = useMemo(() => 
    appointments.filter(a => a.profileId === activeProfileId || (!a.profileId && activeProfileId === 'default')), 
  [appointments, activeProfileId]);

  const currentMoods = useMemo(() => 
    moods.filter(m => m.profileId === activeProfileId || (!m.profileId && activeProfileId === 'default')), 
  [moods, activeProfileId]);

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];

  const triggerNotification = async (title: string, body: string, sound: any) => {
    // Play sound immediately to ensure it alerts even if visual notification fails/delays
    playNotificationSound(sound);
    
    // Always show in-app toast as reliable backup
    setToast({ title, message: body });
    // Auto hide after 5 seconds
    setTimeout(() => setToast(null), 5000);

    const iconUrl = "https://cdn-icons-png.flaticon.com/512/3063/3063822.png"; 
    
    // Try Service Worker first for better mobile support (required for Android Chrome)
    let swRegistration = null;
    if ('serviceWorker' in navigator) {
       try {
         // Wrap in try-catch to prevent origin mismatch errors in preview environments
         swRegistration = await navigator.serviceWorker.getRegistration();
       } catch (error) {
         console.warn("Could not get SW registration (likely origin mismatch in preview):", error);
       }
    }

    if (swRegistration && swRegistration.active) {
       try {
         await swRegistration.showNotification(title, {
            body: body,
            icon: iconUrl,
            vibrate: [200, 100, 200],
            requireInteraction: true,
            tag: 'medication-reminder'
         } as any);
         return;
       } catch (e) {
         console.error("SW Notification failed, falling back to new Notification()", e);
       }
    }

    // Fallback to standard Notification API
    try {
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body: body,
          icon: iconUrl,
          requireInteraction: true,
          vibrate: [200, 100, 200]
        } as any);
      }
    } catch (e) {
      // This catches the "Illegal constructor" error on Android
      console.warn("Notification API failed (expected on Android if SW failed):", e);
    }
  };

  const handleTestNotification = () => {
     triggerNotification(
       "Test Notification",
       "This is how your medication reminders will look and sound.",
       activeProfile.preferredSound || 'default'
     );
  };

  useEffect(() => {
    if (notificationPermission !== 'granted') return;

    const checkReminders = () => {
      const now = new Date();
      const timeStr = format(now, 'HH:mm');
      const dateStr = format(now, 'yyyy-MM-dd');
      const dayOfWeek = now.getDay();
      const currentMinuteKey = `${dateStr} ${timeStr}`;

      // 1. Check Snoozed Items
      setSnoozedItems(prevSnoozes => {
        const remainingSnoozes: SnoozeEntry[] = [];
        prevSnoozes.forEach(snooze => {
           if (Date.now() >= snooze.wakeUpTime) {
             const med = medications.find(m => m.id === snooze.medicationId);
             if (med) {
               const profile = profiles.find(p => p.id === (med.profileId || 'default'));
               const pName = profile?.name || 'User';
               
               const sound = (med.reminderSound && med.reminderSound !== 'default') 
                  ? med.reminderSound 
                  : (profile?.preferredSound || 'default');

               triggerNotification(
                 `Snooze Reminder`,
                 `${pName}, take ${med.name} for your wellness.`,
                 sound
               );
             }
           } else {
             remainingSnoozes.push(snooze);
           }
        });
        return remainingSnoozes;
      });

      if (lastCheckedMinuteRef.current === currentMinuteKey) return;

      // 2. Check Scheduled Times (Global check for all profiles)
      medications.forEach(med => {
        if (med.frequency === FrequencyType.AS_NEEDED) return;
        
        if (med.frequency === FrequencyType.WEEKLY) {
           if (med.daysOfWeek && med.daysOfWeek.length > 0 && !med.daysOfWeek.includes(dayOfWeek)) {
             return;
           }
        }

        if (med.times.includes(timeStr)) {
          // Check logs for specific profile
          const medProfileId = med.profileId || 'default';
          const isLogged = logs.some(l => 
            l.medicationId === med.id && 
            l.dateStr === dateStr && 
            l.scheduledTime === timeStr
          );
          
          const isSnoozed = snoozedItems.some(s => s.medicationId === med.id && s.scheduledTime === timeStr);

          if (!isLogged && !isSnoozed) {
            // Find profile to get name and preferences
            const profile = profiles.find(p => p.id === medProfileId);
            const pName = profile?.name || 'User';
            
            // Sound logic: Medication Sound > Profile Preferred Sound > Default
            const sound = (med.reminderSound && med.reminderSound !== 'default') 
              ? med.reminderSound 
              : (profile?.preferredSound || 'default');
            
            triggerNotification(
              `MediMind Reminder`,
              `${pName}, take ${med.name} for your wellness.`,
              sound
            );
          }
        }
      });

      lastCheckedMinuteRef.current = currentMinuteKey;
    };

    const intervalId = setInterval(checkReminders, 5000);
    checkReminders();

    return () => clearInterval(intervalId);
  }, [medications, logs, notificationPermission, snoozedItems, profiles]);

  const requestPermission = async () => {
    initAudio(); // Unlock audio context
    if (!('Notification' in window)) {
      alert("This browser does not support desktop notifications");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      triggerNotification("Notifications Enabled", "You will now receive medication reminders.", 'chime');
    }
  };

  const handleAddMedication = (med: Medication) => {
    const medWithProfile = { ...med, profileId: activeProfileId };
    setMedications(prev => [...prev, medWithProfile]);
    // Keeps modal open for multiple entries
  };

  const handleUpdateMedication = (updatedMed: Medication) => {
    const medWithProfile = { ...updatedMed, profileId: updatedMed.profileId || activeProfileId };
    setMedications(prev => prev.map(m => m.id === medWithProfile.id ? medWithProfile : m));
    setIsAddModalOpen(false);
    setEditingMedication(null);
  };

  const handleEditClick = (med: Medication) => {
    setEditingMedication(med);
    setIsAddModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingMedication(null);
  };

  const handleDeleteMedication = (id: string) => {
    if (confirm("Are you sure you want to remove this medication?")) {
      setMedications(prev => prev.filter(m => m.id !== id));
    }
  };

  const handleRefillMedication = (medId: string, newStock: number) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    setMedications(prev => prev.map(m => {
      if (m.id === medId) {
        return { 
          ...m, 
          currentStock: newStock,
          refillDate: todayStr 
        };
      }
      return m;
    }));
  };

  const handleSnoozeMedication = (medId: string, time: string, minutes: number) => {
    const wakeUpTime = Date.now() + (minutes * 60 * 1000);
    setSnoozedItems(prev => [
      ...prev.filter(s => !(s.medicationId === medId && s.scheduledTime === time)),
      { medicationId: medId, scheduledTime: time, wakeUpTime }
    ]);
  };

  const handleLogMedication = (medId: string, status: 'TAKEN' | 'SKIPPED', time?: string) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    setSnoozedItems(prev => prev.filter(s => s.medicationId !== medId));

    if (status === 'TAKEN' && notificationPermission === 'granted') {
      const med = medications.find(m => m.id === medId);
      if (med) {
        const potentialStock = med.currentStock - 1;
        if (potentialStock <= med.lowStockThreshold && med.currentStock > med.lowStockThreshold) {
          triggerNotification(
            `Low Stock Alert: ${med.name}`,
            `You only have ${potentialStock} remaining. Consider refilling soon.`,
            'alert'
          );
        }
      }
    }

    const existingIndex = logs.findIndex(l => 
      l.medicationId === medId && 
      l.dateStr === todayStr && 
      l.scheduledTime === time
    );

    if (existingIndex >= 0) {
      const existingLog = logs[existingIndex];
      if (existingLog.status !== status) {
        setMedications(prev => prev.map(m => {
          if (m.id === medId) {
            if (status === 'TAKEN') return { ...m, currentStock: m.currentStock - 1 };
            if (status === 'SKIPPED' && existingLog.status === 'TAKEN') return { ...m, currentStock: m.currentStock + 1 };
          }
          return m;
        }));
      }

      const newLogs = [...logs];
      newLogs[existingIndex].status = status;
      newLogs[existingIndex].timestamp = Date.now();
      setLogs(newLogs);
    } else {
      const newLog: LogEntry = {
        id: uuidv4(),
        medicationId: medId,
        profileId: activeProfileId,
        timestamp: Date.now(),
        status,
        scheduledTime: time,
        dateStr: todayStr
      };
      setLogs(prev => [...prev, newLog]);

      if (status === 'TAKEN') {
        setMedications(prev => prev.map(m => {
          if (m.id === medId) {
            return { ...m, currentStock: Math.max(0, m.currentStock - 1) };
          }
          return m;
        }));
      }
    }
  };

  const handleLogMood = (type: MoodType) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const existingIndex = moods.findIndex(m => m.dateStr === todayStr && (m.profileId === activeProfileId || (!m.profileId && activeProfileId === 'default')));

    if (existingIndex >= 0) {
      const newMoods = [...moods];
      newMoods[existingIndex] = { ...newMoods[existingIndex], type, timestamp: Date.now() };
      setMoods(newMoods);
    } else {
      const newMood: MoodEntry = {
        id: uuidv4(),
        profileId: activeProfileId,
        type,
        timestamp: Date.now(),
        dateStr: todayStr
      };
      setMoods(prev => [...prev, newMood]);
    }
  };

  const handleAddVital = (vital: VitalEntry) => {
    setVitals(prev => [...prev, { ...vital, profileId: activeProfileId }]);
  };

  const handleAddAppointment = (appt: Appointment) => {
    setAppointments(prev => [...prev, { ...appt, profileId: activeProfileId }]);
  };

  const handleDeleteAppointment = (id: string) => {
    if (confirm("Cancel this appointment?")) {
      setAppointments(prev => prev.filter(a => a.id !== id));
    }
  };
  
  const handleAddProfile = (name: string, avatar: string = '👤', themeColor: string = 'blue') => {
    const newProfile: Profile = {
      id: uuidv4(),
      name,
      avatar,
      themeColor,
      allergies: [],
      conditions: []
    };
    setProfiles(prev => [...prev, newProfile]);
    setActiveProfileId(newProfile.id);
  };

  const handleUpdateProfile = (profile: Profile) => {
    setProfiles(prev => prev.map(p => p.id === profile.id ? profile : p));
  };
  
  const handleDeleteProfile = (id: string) => {
    if (profiles.length <= 1) {
      alert("You must have at least one profile.");
      return;
    }
    
    if (confirm("Are you sure you want to delete this profile? All associated data will be hidden.")) {
      setProfiles(prev => prev.filter(p => p.id !== id));
      if (activeProfileId === id) {
        // Switch to the first available profile
        const remaining = profiles.filter(p => p.id !== id);
        if (remaining.length > 0) setActiveProfileId(remaining[0].id);
      }
    }
  };

  // Wellness Goals Handlers
  const handleAddGoal = (goal: WellnessGoal) => {
    setWellnessGoals(prev => [...prev, goal]);
  };

  const handleUpdateGoalProgress = (id: string, increment: number) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setWellnessGoals(prev => prev.map(g => {
      if (g.id === id) {
        const newCurrent = Math.max(0, g.current + increment);
        return { ...g, current: newCurrent, dateStr: today };
      }
      return g;
    }));
  };

  const handleDeleteGoal = (id: string) => {
      setWellnessGoals(prev => prev.filter(g => g.id !== id));
  }

  // BLUETOOTH INTEGRATION
  const handleConnectWatch = async () => {
    try {
      const nav = navigator as any;
      if (!nav.bluetooth) {
        alert("Web Bluetooth is not supported in this browser. Please use Chrome on Android/Desktop.");
        return;
      }

      // Check availability first
      const isAvailable = await nav.bluetooth.getAvailability();
      if (!isAvailable) {
        alert("Bluetooth is not available on this device or is disabled.");
        return;
      }

      const device = await nav.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
        optionalServices: ['battery_service']
      });

      const server = await device.gatt.connect();
      setBluetoothDevice(device);
      setBluetoothServer(server);
      setFireBolttConnected(true);
      
      device.addEventListener('gattserverdisconnected', () => {
         setFireBolttConnected(false);
         setBluetoothDevice(null);
         setBluetoothServer(null);
         alert("Watch disconnected.");
      });

    } catch (error: any) {
      console.error("Bluetooth connection failed:", error);
      if (error.name === 'NotFoundError') {
        // User cancelled the picker
        return;
      } else if (error.name === 'SecurityError') {
        alert("Bluetooth security error. Ensure you are using HTTPS.");
      } else {
        alert(`Could not connect to watch: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const handleReadWatchData = async (): Promise<number | null> => {
    if (!bluetoothServer || !fireBolttConnected) return null;

    try {
      const service = await bluetoothServer.getPrimaryService('heart_rate');
      const characteristic = await service.getCharacteristic('heart_rate_measurement');
      
      // Setup a one-time listener for the value
      return new Promise((resolve) => {
         const handler = (event: any) => {
            const value = event.target.value;
            const flags = value.getUint8(0);
            const rate16Bits = flags & 0x1;
            let heartRate = 0;
            if (rate16Bits) {
              heartRate = value.getUint16(1, true); // 16-bit
            } else {
              heartRate = value.getUint8(1); // 8-bit
            }
            
            characteristic.stopNotifications();
            characteristic.removeEventListener('characteristicvaluechanged', handler);
            resolve(heartRate);
         };

         characteristic.startNotifications().then(() => {
            characteristic.addEventListener('characteristicvaluechanged', handler);
         });
         
         // Timeout if no data
         setTimeout(() => {
           resolve(null);
         }, 5000);
      });
    } catch (error) {
      console.error("Error reading HR:", error);
      return null;
    }
  };

  // Safety fallback for rendering
  if (!activeProfile) return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading Profile...</div>;

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-800 font-sans pb-32">
      {/* Immersive Header */}
      <header className="sticky top-0 z-40 px-4 pt-4 pb-2 bg-[#f1f5f9]/80 backdrop-blur-md transition-all">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Profile Pill */}
            <div className="relative">
              <button 
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 bg-white pl-2 pr-3 py-1.5 rounded-full shadow-sm border border-slate-200/60 active:scale-95 transition-transform"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm shadow-inner">
                  {activeProfile.avatar}
                </div>
                <div className="text-left">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">Hello,</p>
                  <p className="text-sm font-bold text-slate-800 leading-none">{activeProfile.name}</p>
                </div>
                <ChevronDown size={14} className="text-slate-400 ml-1" />
              </button>

              {isProfileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)}></div>
                  <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-slideDown origin-top-left">
                    <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Switch Account</div>
                    {profiles.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setActiveProfileId(p.id);
                          setIsProfileMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-slate-50 transition-colors ${activeProfileId === p.id ? 'bg-blue-50/50' : ''}`}
                      >
                         <span className="text-lg bg-slate-100 w-8 h-8 flex items-center justify-center rounded-full">{p.avatar}</span> 
                         <span className={`font-medium ${activeProfileId === p.id ? 'text-blue-600' : 'text-slate-700'}`}>{p.name}</span>
                         {activeProfileId === p.id && <div className="w-2 h-2 rounded-full bg-blue-500 ml-auto shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>}
                      </button>
                    ))}
                    <div className="border-t border-slate-100 mt-1 pt-1">
                      <button 
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          setIsSettingsModalOpen(true);
                        }}
                        className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 text-slate-500 hover:text-blue-600 hover:bg-slate-50"
                      >
                         <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center"><Users size={16} /></div>
                         Manage Profiles
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={requestPermission}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border ${
                notificationPermission === 'granted' 
                  ? 'bg-white text-blue-500 border-blue-100 shadow-sm' 
                  : 'bg-white text-slate-400 border-transparent'
              }`}
            >
              {notificationPermission === 'granted' ? <BellRing size={20} /> : <Bell size={20} />}
            </button>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="w-10 h-10 rounded-full bg-white text-slate-600 border border-slate-200/60 shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors"
            >
              <UserCircle size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-xl mx-auto px-4 py-4">
        {activeTab === 'home' && (
          <Dashboard 
            medications={currentMedications}
            logs={currentLogs}
            moods={currentMoods}
            snoozedItems={snoozedItems}
            onDeleteMedication={handleDeleteMedication}
            onLogMedication={handleLogMedication}
            onRefillMedication={handleRefillMedication}
            onEditMedication={handleEditClick}
            onUpdateMedication={handleUpdateMedication}
            onLogMood={handleLogMood}
            onSnoozeMedication={handleSnoozeMedication}
            userName={activeProfile.name}
            wellnessGoals={wellnessGoals}
            onAddGoal={handleAddGoal}
            onUpdateGoalProgress={handleUpdateGoalProgress}
            onDeleteGoal={handleDeleteGoal}
          />
        )}
        {activeTab === 'history' && (
          <HistoryView 
            medications={currentMedications} 
            logs={currentLogs} 
            vitals={currentVitals} 
            moods={currentMoods} 
            userName={activeProfile.name}
          />
        )}
        {activeTab === 'vitals' && (
          <VitalsView 
            vitals={currentVitals} 
            onAddVital={handleAddVital} 
            watchConnected={fireBolttConnected}
            onSyncWatch={handleReadWatchData}
          />
        )}
        {activeTab === 'care' && (
          <CareView 
            medications={currentMedications} 
            appointments={currentAppointments}
            onAddAppointment={handleAddAppointment}
            onDeleteAppointment={handleDeleteAppointment}
          />
        )}
        {activeTab === 'chat' && (
          <AssistantView medications={currentMedications} />
        )}
      </main>

      {/* Floating Bottom Navigation */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
        <div className="bg-white/90 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-3xl p-1.5 flex justify-between items-center relative ring-1 ring-black/5">
          <NavButton 
            active={activeTab === 'home'} 
            onClick={() => setActiveTab('home')} 
            icon={<Home size={22} strokeWidth={2.5} />} 
          />
          <NavButton 
            active={activeTab === 'history'} 
            onClick={() => setActiveTab('history')} 
            icon={<Calendar size={22} strokeWidth={2.5} />} 
          />
          
          {/* Floating Action Button for Add */}
          <div className="-mt-8 mx-1">
             <button 
              onClick={() => {
                setEditingMedication(null);
                setIsAddModalOpen(true);
              }}
              className="bg-gradient-to-tr from-slate-900 to-slate-700 hover:scale-110 active:scale-95 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-slate-900/30 transition-all ring-4 ring-[#f1f5f9]"
            >
              <Plus size={28} strokeWidth={3} />
            </button>
          </div>

          <NavButton 
            active={activeTab === 'care'} 
            onClick={() => setActiveTab('care')} 
            icon={<HeartHandshake size={22} strokeWidth={2.5} />} 
          />
          <NavButton 
            active={activeTab === 'chat'} 
            onClick={() => setActiveTab('chat')} 
            icon={<MessageSquareMore size={22} strokeWidth={2.5} />} 
          />
        </div>
      </nav>

      <AddMedicationModal 
        isOpen={isAddModalOpen} 
        onClose={handleCloseModal} 
        onAdd={handleAddMedication}
        onUpdate={handleUpdateMedication}
        initialData={editingMedication}
        activeProfile={activeProfile}
      />
      
      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        profiles={profiles}
        activeProfileId={activeProfileId}
        onAddProfile={handleAddProfile}
        onUpdateProfile={handleUpdateProfile}
        onDeleteProfile={handleDeleteProfile}
        fireBolttConnected={fireBolttConnected}
        onConnectWatch={handleConnectWatch}
        connectedDeviceName={bluetoothDevice?.name}
        onTestNotification={handleTestNotification}
      />

      <OnboardingModal 
        isOpen={isOnboardingOpen}
        onClose={handleFinishOnboarding}
        userName={activeProfile.name}
      />

      {/* In-App Toast Notification Fallback */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] w-[90%] max-w-sm bg-white/95 backdrop-blur-md border-l-4 border-blue-500 rounded-lg shadow-2xl p-4 flex items-start gap-3 ring-1 ring-black/5"
          >
            <div className="bg-blue-100 p-2 rounded-full text-blue-600 flex-shrink-0">
              <Bell size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-slate-800 text-sm truncate">{toast.title}</h4>
              <p className="text-slate-600 text-xs mt-1 leading-snug">{toast.message}</p>
            </div>
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600 p-1">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const NavButton = ({ active, onClick, icon }: { active: boolean, onClick: () => void, icon: React.ReactNode }) => (
  <button 
    onClick={onClick}
    className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 relative ${active ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
  >
    {icon}
    {active && <span className="absolute -bottom-1 w-1 h-1 bg-blue-600 rounded-full"></span>}
  </button>
);

export default App;
