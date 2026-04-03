
import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Medication, LogEntry, FrequencyType, MoodType, MoodEntry, SnoozeEntry, WellnessGoal } from '../types';
import MedicationCard from './MedicationCard';
import { format } from 'date-fns';
import { AlertTriangle, Check, Flame, CalendarClock, Sunrise, Sun, Moon, Coffee, Clock, Smile, Meh, Frown, ThumbsUp, Activity, Plus, Droplet, Utensils, Footprints, Brain, Dumbbell, X, Target, Trash2 } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';

interface DashboardProps {
  medications: Medication[];
  logs: LogEntry[];
  moods: MoodEntry[];
  snoozedItems: SnoozeEntry[];
  onDeleteMedication: (id: string) => void;
  onLogMedication: (medId: string, status: 'TAKEN' | 'SKIPPED', time?: string) => void;
  onRefillMedication: (medId: string, newStock: number) => void;
  onEditMedication: (med: Medication) => void;
  onUpdateMedication: (med: Medication) => void;
  onLogMood: (mood: MoodType) => void;
  onSnoozeMedication: (medId: string, time: string, minutes: number) => void;
  userName: string;
  wellnessGoals: WellnessGoal[];
  onAddGoal: (goal: WellnessGoal) => void;
  onUpdateGoalProgress: (id: string, increment: number) => void;
  onDeleteGoal: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  medications, logs, moods, snoozedItems, 
  onDeleteMedication, onLogMedication, onRefillMedication, onEditMedication, onUpdateMedication, onLogMood, onSnoozeMedication,
  userName, wellnessGoals, onAddGoal, onUpdateGoalProgress, onDeleteGoal
}) => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayLogs = logs.filter(log => log.dateStr === todayStr);
  const todaysMood = moods.find(m => m.dateStr === todayStr);

  // Add Goal State
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalUnit, setNewGoalUnit] = useState('');
  const [newGoalIcon, setNewGoalIcon] = useState<WellnessGoal['icon']>('water');

  const lowStockMeds = useMemo(() => medications.filter(m => m.currentStock <= m.lowStockThreshold), [medications]);

  // Greeting Logic
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Streak Calculation
  const streakDays = useMemo(() => {
    const hasTakenToday = todayLogs.some(l => l.status === 'TAKEN');
    const baseStreak = 12; // Mock base streak for demo
    return hasTakenToday ? baseStreak + 1 : baseStreak;
  }, [todayLogs]);

  // Daily Progress Calculation
  const progressStats = useMemo(() => {
    let totalScheduled = 0;
    medications.forEach(m => {
       if (m.frequency === 'DAILY') totalScheduled += m.times.length;
       // Simplify for other types
    });
    const taken = todayLogs.filter(l => l.status === 'TAKEN').length;
    const skipped = todayLogs.filter(l => l.status === 'SKIPPED').length;
    const progress = totalScheduled > 0 ? Math.round((taken / totalScheduled) * 100) : 0;
    return { taken, totalScheduled, progress, skipped };
  }, [medications, todayLogs]);

  // Progress Animation
  const progressValue = useMotionValue(0);
  const progressTextRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const controls = animate(progressValue, progressStats.progress, { duration: 1, ease: "easeOut" });
    return controls.stop;
  }, [progressStats.progress, progressValue]);

  useEffect(() => {
    // Manually update text content to avoid React rendering MotionValue objects
    const unsubscribe = progressValue.on("change", (latest) => {
      if (progressTextRef.current) {
        progressTextRef.current.textContent = `${Math.round(latest)}%`;
      }
    });
    return unsubscribe;
  }, [progressValue]);

  // Determine Next Dose
  const nextDose = useMemo(() => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    let upcoming: { med: Medication, time: string, diff: number } | null = null;

    medications.forEach(med => {
      if (med.frequency === FrequencyType.AS_NEEDED) return;
      
      med.times.forEach(time => {
        const [h, m] = time.split(':').map(Number);
        const timeMinutes = h * 60 + m;
        
        // Check if already logged
        const isLogged = todayLogs.some(l => l.medicationId === med.id && l.scheduledTime === time);
        
        if (!isLogged) {
          const diff = timeMinutes - currentMinutes;
          // Only look at future or very recent past (within 60 mins overdue)
          if (diff > -60) {
            if (!upcoming || (diff < upcoming.diff && diff >= -60)) { 
               upcoming = { med, time, diff };
            }
          }
        }
      });
    });

    return upcoming;
  }, [medications, todayLogs]);

  // Group Medications
  const groupedMeds = useMemo(() => {
    const groups = {
      morning: [] as Medication[],
      afternoon: [] as Medication[],
      evening: [] as Medication[],
      asNeeded: [] as Medication[]
    };

    medications.forEach(med => {
      if (med.frequency === FrequencyType.AS_NEEDED) {
        groups.asNeeded.push(med);
        return;
      }
      
      if (med.times.length > 0) {
        const firstTime = med.times[0];
        const hour = parseInt(firstTime.split(':')[0]);
        
        if (hour < 12) groups.morning.push(med);
        else if (hour < 17) groups.afternoon.push(med);
        else groups.evening.push(med);
      }
    });

    return groups;
  }, [medications]);

  const handleAddGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle || !newGoalTarget) return;

    onAddGoal({
      id: uuidv4(),
      title: newGoalTitle,
      target: Number(newGoalTarget),
      current: 0,
      unit: newGoalUnit || 'times',
      icon: newGoalIcon,
      dateStr: todayStr
    });

    setIsAddingGoal(false);
    setNewGoalTitle('');
    setNewGoalTarget('');
    setNewGoalUnit('');
    setNewGoalIcon('water');
  };

  const renderSection = (title: string, icon: React.ReactNode, meds: Medication[]) => {
    if (meds.length === 0) return null;
    return (
      <div className="mb-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2 px-1">
          {icon} {title}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AnimatePresence mode='popLayout'>
            {meds.map(med => {
              const snoozeEntry = snoozedItems.find(s => s.medicationId === med.id);
              return (
                <motion.div
                  key={med.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <MedicationCard 
                    medication={med} 
                    onDelete={onDeleteMedication}
                    onLog={onLogMedication}
                    onRefill={onRefillMedication}
                    onEdit={onEditMedication}
                    onUpdate={onUpdateMedication}
                    onSnooze={onSnoozeMedication}
                    todayLogs={todayLogs.filter(log => log.medicationId === med.id)}
                    snoozeUntil={snoozeEntry ? snoozeEntry.wakeUpTime : undefined}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  const allDone = !nextDose && progressStats.totalScheduled > 0 && progressStats.taken >= progressStats.totalScheduled;
  const isEmpty = medications.length === 0;

  const MoodButton = ({ type, icon, label }: { type: MoodType, icon: React.ReactNode, label: string }) => {
    const isSelected = todaysMood?.type === type;
    
    let containerClass = "hover:bg-slate-50";
    let iconClass = "bg-white border border-slate-100 text-slate-400";
    let textClass = "text-slate-400";

    if (isSelected) {
      switch (type) {
        case 'GREAT':
          containerClass = "bg-green-100 ring-2 ring-green-500 shadow-sm";
          iconClass = "bg-green-500 text-white";
          textClass = "text-green-700";
          break;
        case 'GOOD':
          containerClass = "bg-blue-100 ring-2 ring-blue-500 shadow-sm";
          iconClass = "bg-blue-500 text-white";
          textClass = "text-blue-700";
          break;
        case 'OKAY':
          containerClass = "bg-yellow-100 ring-2 ring-yellow-500 shadow-sm";
          iconClass = "bg-yellow-500 text-white";
          textClass = "text-yellow-700";
          break;
        case 'LOW':
          containerClass = "bg-orange-100 ring-2 ring-orange-500 shadow-sm";
          iconClass = "bg-orange-500 text-white";
          textClass = "text-orange-700";
          break;
        case 'PAIN':
          containerClass = "bg-red-100 ring-2 ring-red-500 shadow-sm";
          iconClass = "bg-red-500 text-white";
          textClass = "text-red-700";
          break;
      }
    }

    return (
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => onLogMood(type)}
        className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all w-full ${containerClass} ${isSelected ? 'scale-105' : ''}`}
      >
        <div className={`p-2 rounded-full transition-colors ${iconClass}`}>
          {icon}
        </div>
        <span className={`text-[10px] font-bold ${textClass}`}>{label}</span>
      </motion.button>
    );
  };

  return (
    <div className="pb-10 space-y-6">
      {/* Top Greeting & Stats */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-1">{getGreeting()},</h1>
          <h2 className="text-xl text-slate-500 font-medium">{userName}</h2>
        </div>
        
        {!isEmpty && (
           <div className="relative w-16 h-16 flex items-center justify-center">
              {/* Circular Progress Ring */}
              <svg className="w-full h-full transform -rotate-90">
                 <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-200" />
                 <motion.circle 
                   cx="32" cy="32" r="28" 
                   stroke="currentColor" 
                   strokeWidth="6" 
                   fill="transparent" 
                   strokeDasharray={175} 
                   initial={{ strokeDashoffset: 175 }}
                   animate={{ strokeDashoffset: 175 - (175 * progressStats.progress) / 100 }}
                   transition={{ duration: 1, ease: "easeOut" }}
                   className="text-blue-500" 
                   strokeLinecap="round" 
                 />
              </svg>
              <span ref={progressTextRef} className="absolute text-xs font-bold text-slate-700">
                {Math.round(progressValue.get())}%
              </span>
           </div>
        )}
      </div>

      {/* Hero Card: Next Dose */}
      <AnimatePresence mode="wait">
        {!isEmpty && (
          <motion.div 
            key={allDone ? 'done' : nextDose ? nextDose.med.id + nextDose.time : 'empty'}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            transition={{ duration: 0.3 }}
          >
            {allDone ? (
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-[2rem] p-8 text-white shadow-xl shadow-emerald-200/50 flex items-center justify-between relative overflow-hidden group hover:scale-[1.01] transition-transform">
                 <div className="relative z-10">
                   <h3 className="text-2xl font-bold mb-2">All Caught Up!</h3>
                   <p className="text-emerald-100 font-medium">You've completed your schedule for today.</p>
                 </div>
                 <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm relative z-10 ring-4 ring-white/10">
                   <Check size={32} strokeWidth={3} />
                 </div>
                 {/* Decorative Blobs */}
                 <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity"></div>
              </div>
            ) : nextDose ? (
              <div className="bg-white rounded-[2rem] p-1 border border-slate-100 shadow-xl shadow-slate-200/50">
                 <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[1.8rem] p-6 sm:p-8 text-white relative overflow-hidden group">
                    <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                      <div>
                        <div className="inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 backdrop-blur-md ring-1 ring-white/30">
                          <Clock size={12} /> Next Up • {nextDose.time}
                        </div>
                        <h3 className="text-3xl font-bold mb-1 tracking-tight">{nextDose.med.name}</h3>
                        <p className="text-blue-100 text-lg opacity-90 font-medium">{nextDose.med.dosage}</p>
                        
                        {nextDose.med.notes && (
                          <div className="mt-4 flex items-center gap-2 text-sm text-blue-50 bg-black/10 p-2 px-3 rounded-lg inline-block backdrop-blur-sm">
                            <span>📝 {nextDose.med.notes}</span>
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={() => onLogMedication(nextDose!.med.id, 'TAKEN', nextDose!.time)}
                        className="bg-white text-blue-600 px-8 py-4 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:bg-blue-50 transition-all flex items-center justify-center gap-2 group/btn whitespace-nowrap"
                      >
                        <Check size={20} className="group-hover/btn:scale-110 transition-transform" />
                        Take Now
                      </button>
                    </div>
                    
                    <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500 rounded-full opacity-30 blur-3xl group-hover:opacity-40 transition-opacity"></div>
                    <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-blue-400 rounded-full opacity-20 blur-2xl"></div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-[2rem] p-8 text-center border-2 border-dashed border-slate-200">
                 <p className="text-slate-400 font-medium">No active medication schedule.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wellness Goals Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
             <Target size={14} /> Daily Wellness Goals
          </h3>
          <button 
             onClick={() => setIsAddingGoal(!isAddingGoal)}
             className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
          >
             <Plus size={14} /> Add Goal
          </button>
        </div>

        {isAddingGoal && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 overflow-hidden"
          >
             <form onSubmit={handleAddGoalSubmit} className="space-y-3">
                <div className="flex gap-2 overflow-x-auto pb-2">
                   {[
                     { id: 'water', icon: <Droplet size={18} /> },
                     { id: 'exercise', icon: <Dumbbell size={18} /> },
                     { id: 'sleep', icon: <Moon size={18} /> },
                     { id: 'food', icon: <Utensils size={18} /> },
                     { id: 'steps', icon: <Footprints size={18} /> },
                     { id: 'mindfulness', icon: <Brain size={18} /> },
                   ].map(opt => (
                     <button
                       key={opt.id}
                       type="button"
                       onClick={() => setNewGoalIcon(opt.id as any)}
                       className={`p-3 rounded-xl border transition-colors ${newGoalIcon === opt.id ? 'bg-blue-50 border-blue-500 text-blue-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-white'}`}
                     >
                       {opt.icon}
                     </button>
                   ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input 
                    placeholder="Goal Title (e.g. Drink Water)"
                    value={newGoalTitle}
                    onChange={e => setNewGoalTitle(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                    required
                  />
                  <div className="flex gap-2">
                     <input 
                        type="number"
                        placeholder="Target"
                        value={newGoalTarget}
                        onChange={e => setNewGoalTarget(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                        required
                     />
                     <input 
                        placeholder="Unit"
                        value={newGoalUnit}
                        onChange={e => setNewGoalUnit(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                     />
                  </div>
                </div>
                <div className="flex gap-2">
                   <button type="submit" className="flex-1 bg-blue-600 text-white text-sm font-bold py-2 rounded-lg">Save Goal</button>
                   <button type="button" onClick={() => setIsAddingGoal(false)} className="flex-1 bg-slate-100 text-slate-600 text-sm font-bold py-2 rounded-lg">Cancel</button>
                </div>
             </form>
          </motion.div>
        )}

        {wellnessGoals.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
             {wellnessGoals.map(goal => (
               <GoalCard 
                 key={goal.id} 
                 goal={goal} 
                 onUpdateProgress={onUpdateGoalProgress} 
                 onDelete={onDeleteGoal} 
               />
             ))}
          </div>
        ) : !isAddingGoal && (
           <div className="bg-slate-50 rounded-xl p-6 text-center border border-dashed border-slate-200">
              <p className="text-slate-400 text-sm">No daily goals set yet.</p>
           </div>
        )}
      </div>

      {/* Mood Tracker Widget */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100/60 p-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
           <Activity size={14} /> Daily Check-in
        </h3>
        <div className="flex justify-between items-center gap-2">
          <MoodButton type="GREAT" icon={<ThumbsUp size={20} />} label="Great" />
          <MoodButton type="GOOD" icon={<Smile size={20} />} label="Good" />
          <MoodButton type="OKAY" icon={<Meh size={20} />} label="Okay" />
          <MoodButton type="LOW" icon={<Frown size={20} />} label="Low" />
          <MoodButton type="PAIN" icon={<Activity size={20} />} label="Pain" />
        </div>
      </div>

      {/* Refill Alert */}
      <AnimatePresence>
        {lowStockMeds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-100 rounded-[1.5rem] p-5 flex flex-col gap-3 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-400/10 rounded-full -mr-10 -mt-10 blur-xl pointer-events-none"></div>
            
            <div className="flex items-center gap-3 relative z-10">
              <div className="bg-white p-2.5 rounded-full text-red-500 shadow-sm border border-red-100 animate-pulse">
                <AlertTriangle size={20} />
              </div>
              <div>
                 <h3 className="font-bold text-red-900 text-sm leading-tight">Restock Needed</h3>
                 <p className="text-red-700/80 text-xs font-medium">You're running low on supplies.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-1 relative z-10 pl-1">
              {lowStockMeds.map(med => (
                <div key={med.id} className="flex items-center justify-between gap-3 text-xs font-bold text-red-700 bg-white p-2 px-3 rounded-lg border border-red-200 shadow-sm">
                  <div className="flex items-center gap-2">
                     <span>{med.name}</span>
                     <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{med.currentStock} Left</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grouped Lists */}
      {isEmpty ? (
        <div className="bg-white rounded-[2rem] border-2 border-dashed border-slate-200 p-12 text-center animate-fadeIn">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <CalendarClock size={40} className="text-blue-500" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Your Schedule is Empty</h3>
          <p className="text-slate-400 max-w-xs mx-auto mb-6 text-sm">Add your first medication to start building your daily health routine.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {renderSection('Morning', <Sunrise size={16} />, groupedMeds.morning)}
          {renderSection('Afternoon', <Sun size={16} />, groupedMeds.afternoon)}
          {renderSection('Evening', <Moon size={16} />, groupedMeds.evening)}
          {renderSection('As Needed', <Coffee size={16} />, groupedMeds.asNeeded)}
        </div>
      )}
    </div>
  );
};

const GoalCard: React.FC<{ 
  goal: WellnessGoal, 
  onUpdateProgress: (id: string, inc: number) => void,
  onDelete: (id: string) => void
}> = ({ goal, onUpdateProgress, onDelete }) => {
  const percent = Math.min(100, Math.round((goal.current / goal.target) * 100));
  const isComplete = goal.current >= goal.target;
  
  const getIcon = () => {
    switch(goal.icon) {
       case 'water': return <Droplet size={20} />;
       case 'exercise': return <Dumbbell size={20} />;
       case 'sleep': return <Moon size={20} />;
       case 'food': return <Utensils size={20} />;
       case 'steps': return <Footprints size={20} />;
       case 'mindfulness': return <Brain size={20} />;
       default: return <Target size={20} />;
    }
  };
  
  const getColor = () => {
     switch(goal.icon) {
       case 'water': return 'text-blue-500 bg-blue-50 border-blue-100';
       case 'exercise': return 'text-orange-500 bg-orange-50 border-orange-100';
       case 'sleep': return 'text-indigo-500 bg-indigo-50 border-indigo-100';
       case 'food': return 'text-green-500 bg-green-50 border-green-100';
       case 'steps': return 'text-teal-500 bg-teal-50 border-teal-100';
       case 'mindfulness': return 'text-purple-500 bg-purple-50 border-purple-100';
       default: return 'text-slate-500 bg-slate-50 border-slate-100';
     }
  };

  const getRingColor = () => {
    switch(goal.icon) {
       case 'water': return 'text-blue-500';
       case 'exercise': return 'text-orange-500';
       case 'sleep': return 'text-indigo-500';
       case 'food': return 'text-green-500';
       case 'steps': return 'text-teal-500';
       case 'mindfulness': return 'text-purple-500';
       default: return 'text-slate-500';
    }
  };

  return (
    <div className={`p-4 rounded-2xl border flex items-center justify-between group relative overflow-hidden bg-white shadow-sm hover:shadow-md transition-all ${isComplete ? 'border-green-200' : 'border-slate-100'}`}>
      {/* Background Fill for progress */}
      <motion.div 
         initial={{ width: 0 }}
         animate={{ width: `${percent}%` }}
         className={`absolute left-0 top-0 bottom-0 opacity-10 pointer-events-none ${isComplete ? 'bg-green-500' : getRingColor().replace('text-', 'bg-')}`}
      />

      <div className="flex items-center gap-3 relative z-10">
         <div className="relative w-12 h-12 flex items-center justify-center">
            {/* Progress Ring */}
            <svg className="w-full h-full transform -rotate-90">
               <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-slate-100" />
               <motion.circle 
                 cx="24" cy="24" r="20" 
                 stroke="currentColor" 
                 strokeWidth="3" 
                 fill="transparent" 
                 strokeDasharray={126} 
                 initial={{ strokeDashoffset: 126 }}
                 animate={{ strokeDashoffset: 126 - (126 * percent) / 100 }}
                 className={isComplete ? 'text-green-500' : getRingColor()} 
                 strokeLinecap="round" 
               />
            </svg>
            <div className={`absolute inset-0 flex items-center justify-center ${isComplete ? 'text-green-600' : getRingColor()}`}>
               {isComplete ? <Check size={18} strokeWidth={3} /> : getIcon()}
            </div>
         </div>
         
         <div>
            <h4 className="font-bold text-slate-700 text-sm">{goal.title}</h4>
            <p className="text-xs text-slate-500 font-medium">
               <span className={isComplete ? 'text-green-600 font-bold' : 'text-slate-800'}>{goal.current}</span>
               <span className="text-slate-400"> / {goal.target} {goal.unit}</span>
            </p>
         </div>
      </div>

      <div className="flex items-center gap-1 relative z-10">
         <button 
           onClick={() => onUpdateProgress(goal.id, -1)}
           className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
           disabled={goal.current <= 0}
         >
           -
         </button>
         <button 
           onClick={() => onUpdateProgress(goal.id, 1)}
           className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors shadow-sm ${isComplete ? 'bg-green-100 text-green-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
         >
           +
         </button>
      </div>

      <button 
        onClick={() => onDelete(goal.id)}
        className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};

export default Dashboard;
