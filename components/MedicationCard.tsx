
import React, { useState } from 'react';
import { Medication, FrequencyType, DrugInfo, LogEntry } from '../types';
import { Pill, Clock, Calendar, Info, Check, X, AlertCircle, Database, PlusCircle, Pencil, Hourglass, Bell, AlarmClock, Settings, Save, RefreshCw, Tablets, Package, Syringe, Droplet, SprayCan, Activity } from 'lucide-react';
import { getDrugInfo } from '../services/geminiService';
import { format, differenceInDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface MedicationCardProps {
  medication: Medication;
  onDelete: (id: string) => void;
  onLog: (medId: string, status: 'TAKEN' | 'SKIPPED', time?: string) => void;
  onRefill: (medId: string, newStock: number) => void;
  onEdit: (med: Medication) => void;
  onUpdate?: (med: Medication) => void;
  onSnooze: (medId: string, time: string, minutes: number) => void;
  todayLogs: LogEntry[];
  snoozeUntil?: number; // Timestamp if snoozed
}

const MedicationCard: React.FC<MedicationCardProps> = ({ medication, onDelete, onLog, onRefill, onEdit, onUpdate, onSnooze, todayLogs, snoozeUntil }) => {
  const [info, setInfo] = useState<DrugInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSnoozeOptions, setShowSnoozeOptions] = useState<string | null>(null); // Stores the time string currently being snoozed
  
  // Settings State
  const [editThreshold, setEditThreshold] = useState(medication.lowStockThreshold);
  const [editStock, setEditStock] = useState(medication.currentStock);

  const handleFetchInfo = async () => {
    if (info) {
      setShowInfo(!showInfo);
      return;
    }
    setLoadingInfo(true);
    const data = await getDrugInfo(medication.name);
    setInfo(data);
    setLoadingInfo(false);
    setShowInfo(true);
  };
  
  const toggleSettings = () => {
    if (!showSettings) {
      setEditThreshold(medication.lowStockThreshold);
      setEditStock(medication.currentStock);
    }
    setShowSettings(!showSettings);
    setShowInfo(false);
  };

  const handleSaveSettings = () => {
    if (onUpdate) {
      onUpdate({ 
        ...medication, 
        currentStock: Number(editStock), 
        lowStockThreshold: Number(editThreshold) 
      });
    }
    setShowSettings(false);
  };

  const handleRefillClick = () => {
    const message = `Refill ${medication.name}\n\nCurrent Stock: ${medication.currentStock}\n\nEnter the New Total Stock Count (what you have now):`;
    const defaultVal = medication.currentStock.toString();
    
    const amountStr = window.prompt(message, defaultVal);
    
    if (amountStr !== null) {
      const amount = parseInt(amountStr, 10);
      if (!isNaN(amount) && amount >= 0) {
        onRefill(medication.id, amount);
      }
    }
  };

  const isTimeLogged = (time: string) => {
    return todayLogs.some(log => log.scheduledTime === time);
  };

  const getLogStatus = (time: string) => {
    const log = todayLogs.find(log => log.scheduledTime === time);
    return log?.status;
  };

  const handleSnoozeClick = (time: string, minutes: number) => {
    onSnooze(medication.id, time, minutes);
    setShowSnoozeOptions(null);
  };

  const isLowStock = medication.currentStock <= medication.lowStockThreshold;
  
  // Calculate stock status color
  let stockStatusColor = 'bg-emerald-500';
  let stockStatusLabel = 'High Stock';
  
  if (isLowStock) {
    stockStatusColor = 'bg-red-500';
    stockStatusLabel = 'Low Stock';
  } else if (medication.currentStock <= (medication.lowStockThreshold * 3)) {
     stockStatusColor = 'bg-amber-400';
     stockStatusLabel = 'Medium Stock';
  }
  
  // Robust check for future start date using local date string comparison
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isFuture = medication.startDate && medication.startDate > todayStr;

  // Calculate estimates
  let dailyUsage = 0;
  if (medication.frequency === FrequencyType.DAILY) {
    dailyUsage = medication.times.length;
  } else if (medication.frequency === FrequencyType.WEEKLY) {
    dailyUsage = medication.times.length / 7;
  }

  const daysLeft = dailyUsage > 0 ? Math.floor(medication.currentStock / dailyUsage) : null;
  
  let daysToExpiry = null;
  if (medication.expiryDate) {
    // Normalize to start of day for accurate day diff
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(medication.expiryDate + 'T00:00');
    daysToExpiry = differenceInDays(expDate, today);
  }

  // Determine Expiry Style
  const isExpired = daysToExpiry !== null && daysToExpiry < 0;
  const isExpiringSoon = daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 30;

  let expiryColorClass = "";
  let expiryIconClass = "text-slate-400";

  if (isExpired) {
    expiryColorClass = "text-red-600 font-bold";
    expiryIconClass = "text-red-500";
  } else if (isExpiringSoon) {
    expiryColorClass = "text-orange-600 font-bold";
    expiryIconClass = "text-orange-500";
  }

  // Sort times for display
  const sortedTimes = [...medication.times].sort();

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-100 p-5 transition-all hover:shadow-md border-l-4 ${medication.color === 'blue' ? 'border-l-blue-500' : 'border-l-teal-500'} relative overflow-hidden`}>
      {/* Pulsating Indicator for Low Stock */}
      {isLowStock && (
        <div className="absolute top-0 right-0 p-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        </div>
      )}

      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${medication.color === 'blue' ? 'bg-blue-100 text-blue-600' : 'bg-teal-100 text-teal-600'}`}>
            {medication.icon === 'pill' && <Pill size={24} />}
            {medication.icon === 'tablet' && <Tablets size={24} />}
            {medication.icon === 'bottle' && <Package size={24} />}
            {medication.icon === 'syringe' && <Syringe size={24} />}
            {medication.icon === 'droplet' && <Droplet size={24} />}
            {medication.icon === 'inhaler' && <SprayCan size={24} />}
            {medication.icon === 'other' && <Activity size={24} />}
            {!['pill', 'tablet', 'bottle', 'syringe', 'droplet', 'inhaler', 'other'].includes(medication.icon) && <Pill size={24} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-slate-800">{medication.name}</h3>
              {/* Visual Indicator for Stock Level */}
              {isLowStock ? (
                <div title={`Low Stock: ${medication.currentStock} units remaining`}>
                  <AlertCircle 
                    size={16} 
                    className="text-red-500 fill-red-50" 
                  />
                </div>
              ) : (
                <div 
                  className={`w-2.5 h-2.5 rounded-full ${stockStatusColor} ring-2 ring-white shadow-sm`} 
                  title={`${stockStatusLabel}: ${medication.currentStock} units remaining`}
                />
              )}
            </div>
            <p className="text-sm text-slate-500">{medication.dosage} • {medication.frequency}</p>
          </div>
        </div>
        <div className="flex items-center mr-4">
            {medication.reminderSound && medication.reminderSound !== 'default' && (
              <div className="text-slate-300 mr-2" title={`Sound: ${medication.reminderSound}`}>
                <Bell size={14} />
              </div>
            )}
            <button 
              onClick={handleFetchInfo}
              className={`transition-colors p-1 ${showInfo ? 'text-blue-500' : 'text-slate-400 hover:text-blue-500'}`}
              title="Get AI Info"
              type="button"
            >
              <Info size={20} />
            </button>
            <button 
              onClick={toggleSettings}
              className={`transition-colors p-1 ml-1 ${showSettings ? 'text-blue-500' : 'text-slate-400 hover:text-blue-500'}`}
              title="Refill Settings"
              type="button"
            >
              <Settings size={20} />
            </button>
        </div>
      </div>

      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-4 bg-slate-50 p-3 rounded-lg text-sm border border-slate-200">
              {loadingInfo ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <span className="animate-spin">⏳</span> Asking Gemini...
                </div>
              ) : info ? (
                <div className="space-y-2">
                  <p className="font-medium text-slate-700">{info.description}</p>
                  <div>
                    <span className="font-bold text-xs uppercase text-slate-400">Side Effects</span>
                    <p className="text-slate-600">{info.sideEffects.join(", ")}</p>
                  </div>
                  <div className="flex items-start gap-2 text-amber-600 bg-amber-50 p-2 rounded">
                    <AlertCircle size={14} className="mt-0.5" />
                    <span>{info.tips}</span>
                  </div>
                </div>
              ) : (
                <p className="text-red-400">Could not retrieve info.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-4 bg-white p-4 rounded-xl text-sm border-2 border-blue-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                 <h4 className="font-bold text-slate-700 flex items-center gap-2">
                   <Settings size={16} className="text-blue-500" />
                   Refill Reminder Settings
                 </h4>
                 <button onClick={toggleSettings} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Current Stock</label>
                  <input 
                    type="number" 
                    value={editStock}
                    onChange={(e) => setEditStock(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Alert Below</label>
                  <input 
                    type="number" 
                    value={editThreshold}
                    onChange={(e) => setEditThreshold(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2 mb-4 text-xs text-slate-500 bg-slate-50 p-2 rounded">
                <Info size={14} />
                <span>
                  {dailyUsage > 0 
                    ? `At current dose, stock alert will trigger in ~${Math.floor((editStock - editThreshold) / dailyUsage)} days.` 
                    : 'Stock alerts will appear when your supply drops below the limit.'}
                </span>
              </div>

              <button 
                onClick={handleSaveSettings}
                className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Save size={16} /> Save Settings
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stock Indicator */}
      <div className={`rounded-lg p-3 mb-3 border ${isLowStock ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Database size={14} className={isLowStock ? "text-red-500" : "text-slate-400"} />
            <span className={`text-sm font-bold ${isLowStock ? "text-red-600" : "text-slate-700"}`}>
              {medication.currentStock} left
            </span>
            {isLowStock && (
              <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">Low</span>
            )}
          </div>
          <button 
            type="button"
            onClick={handleRefillClick}
            className={`text-xs p-1.5 px-2 rounded transition-colors flex items-center gap-1 font-medium border ${isLowStock ? 'bg-white text-red-600 border-red-200 hover:bg-red-50' : 'bg-white text-blue-600 border-blue-100 hover:bg-blue-100'}`}
          >
            <PlusCircle size={14} /> Refill
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200/50">
           {daysLeft !== null && (
             <div className={`flex items-center gap-1 ${isLowStock ? 'text-red-500 font-medium' : ''}`} title="Estimated based on schedule">
               <Hourglass size={12} className={isLowStock ? "text-red-400" : "text-slate-400"} />
               <span>~{daysLeft} days left</span>
             </div>
           )}
           {medication.expiryDate && (
             <div className={`flex items-center gap-1 ${expiryColorClass}`} title={`Expires on ${medication.expiryDate}`}>
               <Calendar size={12} className={expiryIconClass} />
               <span>
                  {isExpiringSoon || isExpired
                    ? (isExpired ? 'Expired' : `Exp in ${daysToExpiry} days`)
                    : `Exp: ${format(new Date(medication.expiryDate + 'T00:00'), 'MM/yy')}`
                  }
               </span>
             </div>
           )}
           {medication.refillDate && (
             <div className="flex items-center gap-1.5 col-span-2 text-slate-500">
               <RefreshCw size={12} className="text-slate-400" />
               <span>Last Refill: <span className="font-medium text-slate-600">{format(new Date(medication.refillDate + 'T00:00'), 'MMM do, yyyy')}</span></span>
             </div>
           )}
        </div>
      </div>

      {medication.notes && (
        <p className="text-xs text-slate-500 italic mb-4 bg-slate-50 p-2 rounded inline-block">
          📝 {medication.notes}
        </p>
      )}

      {isFuture ? (
        <div className="bg-blue-50 text-blue-600 p-3 rounded-lg text-sm font-bold text-center mt-2 border border-blue-100 flex items-center justify-center gap-2">
          <Calendar size={16} />
          Starts on {format(new Date(medication.startDate + 'T00:00'), 'MMM do, yyyy')}
        </div>
      ) : (
        <>
          {medication.frequency === FrequencyType.AS_NEEDED ? (
            <div className="mt-2">
               <button
                type="button"
                onClick={() => onLog(medication.id, 'TAKEN', new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}))}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Check size={18} /> Take Now
              </button>
            </div>
          ) : (
            <div className="space-y-2 mt-2">
              {sortedTimes.map((time) => {
                 const status = getLogStatus(time);
                 const isLogged = !!status;
                 const isSnoozed = snoozeUntil && !isLogged && snoozeUntil > Date.now();
                 const snoozeTimeStr = isSnoozed ? format(new Date(snoozeUntil), 'h:mm a') : '';

                 return (
                  <div key={time} className="flex flex-col gap-2 p-2 rounded-lg bg-slate-50 group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-700 font-medium">
                        <Clock size={16} className="text-slate-400" />
                        {time}
                        {isSnoozed && (
                          <span className="text-xs text-indigo-500 font-normal flex items-center gap-1">
                            <AlarmClock size={12} /> Snoozed until {snoozeTimeStr}
                          </span>
                        )}
                      </div>
                      
                      <AnimatePresence mode="wait">
                        {isLogged ? (
                          <motion.div
                            key="logged"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${status === 'TAKEN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {status === 'TAKEN' ? <Check size={12}/> : <X size={12}/>}
                              {status}
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="actions"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.2 }}
                            className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                          >
                            <button 
                              type="button"
                              onClick={() => setShowSnoozeOptions(showSnoozeOptions === time ? null : time)}
                              className={`p-1.5 rounded-md transition-colors ${showSnoozeOptions === time ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-indigo-50 hover:text-indigo-600'}`}
                              title="Snooze"
                            >
                              <AlarmClock size={18} />
                            </button>
                            <button 
                              type="button"
                              onClick={() => onLog(medication.id, 'SKIPPED', time)}
                              className="p-1.5 text-slate-400 hover:bg-red-100 hover:text-red-600 rounded-md transition-colors"
                              title="Skip"
                            >
                              <X size={18} />
                            </button>
                            <button 
                              type="button"
                              onClick={() => onLog(medication.id, 'TAKEN', time)}
                              className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                              title="Take"
                            >
                              <Check size={18} />
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Snooze Options */}
                    <AnimatePresence>
                      {showSnoozeOptions === time && !isLogged && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex gap-1 justify-end overflow-hidden"
                        >
                           <span className="text-xs text-slate-400 self-center mr-1">Snooze for:</span>
                           <button onClick={() => handleSnoozeClick(time, 5)} className="px-2 py-1 bg-white border border-slate-200 text-xs rounded hover:bg-indigo-50 text-slate-600">5m</button>
                           <button onClick={() => handleSnoozeClick(time, 10)} className="px-2 py-1 bg-white border border-slate-200 text-xs rounded hover:bg-indigo-50 text-slate-600">10m</button>
                           <button onClick={() => handleSnoozeClick(time, 15)} className="px-2 py-1 bg-white border border-slate-200 text-xs rounded hover:bg-indigo-50 text-slate-600">15m</button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end gap-3">
        <button 
          type="button"
          onClick={() => onEdit(medication)}
          className="text-xs text-slate-500 hover:text-blue-600 font-medium flex items-center gap-1"
        >
          <Pencil size={14} /> Edit
        </button>
        <button 
          type="button"
          onClick={() => onDelete(medication.id)}
          className="text-xs text-red-400 hover:text-red-600 font-medium"
        >
          Remove
        </button>
      </div>
    </div>
  );
};

export default MedicationCard;
    