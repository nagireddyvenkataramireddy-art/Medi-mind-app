
import React, { useState, useMemo } from 'react';
import { VitalEntry, VitalType } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { Activity, Heart, Scale, Droplet, Plus, Watch, RefreshCw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface VitalsViewProps {
  vitals: VitalEntry[];
  onAddVital: (vital: VitalEntry) => void;
  watchConnected?: boolean;
  onSyncWatch?: () => Promise<number | null>;
}

const VitalsView: React.FC<VitalsViewProps> = ({ vitals, onAddVital, watchConnected = false, onSyncWatch }) => {
  const [activeType, setActiveType] = useState<VitalType>('BLOOD_PRESSURE');
  const [value1, setValue1] = useState(''); // Systolic or single value
  const [value2, setValue2] = useState(''); // Diastolic (for BP)
  const [isAdding, setIsAdding] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const getUnit = (type: VitalType) => {
    switch(type) {
      case 'BLOOD_PRESSURE': return 'mmHg';
      case 'GLUCOSE': return 'mg/dL';
      case 'HEART_RATE': return 'bpm';
      case 'WEIGHT': return 'kg';
    }
  };

  const getColor = (type: VitalType) => {
    switch(type) {
      case 'BLOOD_PRESSURE': return '#ef4444'; // Red
      case 'GLUCOSE': return '#3b82f6'; // Blue
      case 'HEART_RATE': return '#10b981'; // Green
      case 'WEIGHT': return '#f59e0b'; // Amber
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let finalValue = value1;
    if (activeType === 'BLOOD_PRESSURE') {
      finalValue = `${value1}/${value2}`;
    }

    const newVital: VitalEntry = {
      id: uuidv4(),
      type: activeType,
      value: finalValue,
      unit: getUnit(activeType),
      dateStr: format(new Date(), 'yyyy-MM-dd'),
      timestamp: Date.now()
    };

    onAddVital(newVital);
    setValue1('');
    setValue2('');
    setIsAdding(false);
  };

  const handleSyncWatch = async () => {
    if (!watchConnected) {
      alert("Please connect your Fire-Boltt watch in Settings first.");
      return;
    }
    
    if (!onSyncWatch) return;

    setIsSyncing(true);
    
    try {
      const heartRate = await onSyncWatch();
      
      if (heartRate) {
        const newVital: VitalEntry = {
          id: uuidv4(),
          type: 'HEART_RATE',
          value: heartRate.toString(),
          unit: 'bpm',
          dateStr: format(new Date(), 'yyyy-MM-dd'),
          timestamp: Date.now()
        };
        
        onAddVital(newVital);
        alert(`Synced: Heart Rate ${heartRate} bpm from Fire-Boltt`);
      } else {
        alert("Could not read heart rate. Make sure watch is measuring or screen is on.");
      }
    } catch (e) {
      alert("Sync failed. Check connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  const chartData = useMemo(() => {
    return vitals
      .filter(v => v.type === activeType)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(v => {
        if (v.type === 'BLOOD_PRESSURE') {
          const [sys, dia] = v.value.split('/');
          return {
            date: format(new Date(v.timestamp), 'MMM dd'),
            systolic: parseInt(sys),
            diastolic: parseInt(dia),
            fullDate: format(new Date(v.timestamp), 'MMM dd HH:mm')
          };
        }
        return {
          date: format(new Date(v.timestamp), 'MMM dd'),
          value: parseFloat(v.value),
          fullDate: format(new Date(v.timestamp), 'MMM dd HH:mm')
        };
      });
  }, [vitals, activeType]);

  const inputClass = "w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400";

  return (
    <div className="space-y-6">
      {/* Type Selector */}
      <div className="grid grid-cols-4 gap-2">
        {(['BLOOD_PRESSURE', 'HEART_RATE', 'GLUCOSE', 'WEIGHT'] as VitalType[]).map(type => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
              activeType === type 
                ? 'bg-white border-blue-500 shadow-md text-blue-600' 
                : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-white'
            }`}
          >
            {type === 'BLOOD_PRESSURE' && <Activity size={24} />}
            {type === 'HEART_RATE' && <Heart size={24} />}
            {type === 'GLUCOSE' && <Droplet size={24} />}
            {type === 'WEIGHT' && <Scale size={24} />}
            <span className="text-[10px] font-bold mt-1 text-center leading-tight">
              {type.replace('_', ' ')}
            </span>
          </button>
        ))}
      </div>

      {/* Chart Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-slate-800">
            {activeType.replace('_', ' ')} Trends
          </h2>
          <div className="flex gap-2">
            {watchConnected && activeType === 'HEART_RATE' && (
              <button 
                onClick={handleSyncWatch}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
              >
                 {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : <Watch size={14} />}
                 {isSyncing ? 'Syncing...' : 'Sync Watch'}
              </button>
            )}
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1.5 rounded flex items-center">
              Unit: {getUnit(activeType)}
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                {activeType === 'BLOOD_PRESSURE' ? (
                  <>
                    <Line type="monotone" dataKey="systolic" stroke="#ef4444" strokeWidth={2} dot={{r: 4}} name="Systolic" />
                    <Line type="monotone" dataKey="diastolic" stroke="#f87171" strokeWidth={2} strokeDasharray="5 5" dot={{r: 4}} name="Diastolic" />
                  </>
                ) : (
                  <Line type="monotone" dataKey="value" stroke={getColor(activeType)} strokeWidth={2} dot={{r: 4}} />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <Activity size={32} className="mb-2 opacity-50" />
              <p>No data recorded yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Entry Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
           <h3 className="font-bold text-slate-700">Log New Entry</h3>
           <button 
             onClick={() => setIsAdding(!isAdding)}
             className={`p-2 rounded-full transition-colors ${isAdding ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-600'}`}
           >
             <Plus size={20} className={`transition-transform ${isAdding ? 'rotate-45' : ''}`} />
           </button>
        </div>

        {isAdding && (
          <form onSubmit={handleSubmit} className="animate-fadeIn">
            <div className="flex gap-4 items-end">
              {activeType === 'BLOOD_PRESSURE' ? (
                <>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">Systolic</label>
                    <input 
                      type="number" required placeholder="120"
                      value={value1} onChange={e => setValue1(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <span className="text-2xl text-slate-300 pb-3">/</span>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">Diastolic</label>
                    <input 
                      type="number" required placeholder="80"
                      value={value2} onChange={e => setValue2(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </>
              ) : (
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">Value ({getUnit(activeType)})</label>
                  <input 
                    type="number" required step="0.1"
                    value={value1} onChange={e => setValue1(e.target.value)}
                    className={inputClass}
                  />
                </div>
              )}
              <button 
                type="submit"
                className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
              >
                Save
              </button>
            </div>
          </form>
        )}

        {/* Recent Entries List */}
        <div className="mt-6 space-y-2">
           {vitals
             .filter(v => v.type === activeType)
             .sort((a, b) => b.timestamp - a.timestamp)
             .slice(0, 5)
             .map(v => (
               <div key={v.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg transition-colors border border-slate-50">
                 <span className="text-sm text-slate-500">{format(new Date(v.timestamp), 'MMM dd, h:mm a')}</span>
                 <span className="font-bold text-slate-700">{v.value} <span className="text-xs font-normal text-slate-400">{v.unit}</span></span>
               </div>
             ))
           }
        </div>
      </div>
    </div>
  );
};

export default VitalsView;
