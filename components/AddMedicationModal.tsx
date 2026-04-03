import React, { useState, useEffect, useRef } from 'react';
import { Medication, FrequencyType, SoundType, Profile } from '../types';
import { parseMedicationInput, identifyPillFromImage, parseMedicationAudio } from '../services/geminiService';
import { playNotificationSound } from '../services/audioService';
import { Sparkles, Plus, X, Loader2, Package, Bell, Play, Timer, Camera, ScanLine, Pill, Tablets, Syringe, Droplet, Activity, SprayCan, AlertTriangle, Mic, Square, Check, Trash2, ArrowRight, Calendar } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format, addMinutes } from 'date-fns';

interface AddMedicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (med: Medication) => void;
  onUpdate?: (med: Medication) => void;
  initialData?: Medication | null;
  activeProfile: Profile;
}

const COLORS = [
  { name: 'blue', class: 'bg-blue-500', border: 'border-blue-200' },
  { name: 'teal', class: 'bg-teal-500', border: 'border-teal-200' },
  { name: 'red', class: 'bg-red-500', border: 'border-red-200' },
  { name: 'orange', class: 'bg-orange-500', border: 'border-orange-200' },
  { name: 'purple', class: 'bg-purple-500', border: 'border-purple-200' },
  { name: 'pink', class: 'bg-pink-500', border: 'border-pink-200' },
  { name: 'indigo', class: 'bg-indigo-500', border: 'border-indigo-200' },
];

const ICONS = [
  { name: 'pill', icon: <Pill size={20} /> },
  { name: 'tablet', icon: <Tablets size={20} /> },
  { name: 'bottle', icon: <Package size={20} /> },
  { name: 'syringe', icon: <Syringe size={20} /> },
  { name: 'droplet', icon: <Droplet size={20} /> },
  { name: 'inhaler', icon: <SprayCan size={20} /> },
  { name: 'other', icon: <Activity size={20} /> },
];

const getSupportedMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg',
    'audio/aac'
  ];
  return types.find(type => MediaRecorder.isTypeSupported(type)) || '';
};

const AddMedicationModal: React.FC<AddMedicationModalProps> = ({ isOpen, onClose, onAdd, onUpdate, initialData, activeProfile }) => {
  const [mode, setMode] = useState<'ai' | 'manual' | 'scan'>('ai');
  const [aiInput, setAiInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  
  // Voice State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Manual State
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState<FrequencyType>(FrequencyType.DAILY);
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [notes, setNotes] = useState('');
  const [currentStock, setCurrentStock] = useState<number | string>(30);
  const [lowStockThreshold, setLowStockThreshold] = useState<number | string>(5);
  const [expiryDate, setExpiryDate] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reminderSound, setReminderSound] = useState<SoundType>('default');
  
  // Customization State
  const [selectedColor, setSelectedColor] = useState('blue');
  const [selectedIcon, setSelectedIcon] = useState('pill');

  // Interval State
  const [intervalVal, setIntervalVal] = useState(4);
  const [intervalUnit, setIntervalUnit] = useState<'hours' | 'minutes'>('hours');
  const [intervalStartTime, setIntervalStartTime] = useState('08:00');

  // Pill Identification Confidence
  const [confidenceWarning, setConfidenceWarning] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setMode('manual');
        setName(initialData.name);
        setDosage(initialData.dosage);
        setFrequency(initialData.frequency);
        setTimes(initialData.times.length > 0 ? initialData.times : ['08:00']);
        setNotes(initialData.notes || '');
        setCurrentStock(initialData.currentStock);
        setLowStockThreshold(initialData.lowStockThreshold);
        setExpiryDate(initialData.expiryDate || '');
        setStartDate(initialData.startDate || format(new Date(), 'yyyy-MM-dd'));
        setReminderSound(initialData.reminderSound || 'default');
        setSelectedColor(initialData.color || 'blue');
        setSelectedIcon(initialData.icon || 'pill');
        
        if (initialData.frequency === FrequencyType.INTERVAL && initialData.interval) {
          const hours = Math.floor(initialData.interval / 60);
          if (hours > 0 && initialData.interval % 60 === 0) {
            setIntervalVal(hours);
            setIntervalUnit('hours');
          } else {
            setIntervalVal(initialData.interval);
            setIntervalUnit('minutes');
          }
          setIntervalStartTime(initialData.startTime || '08:00');
        }
      } else {
        resetForm();
        if (activeProfile.preferredSound) {
          setReminderSound(activeProfile.preferredSound);
        }
      }
    } else {
      stopRecordingCleanup();
    }
  }, [isOpen, initialData, activeProfile]);

  useEffect(() => {
    return () => stopRecordingCleanup();
  }, []);

  const stopRecordingCleanup = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    setIsRecording(false);
  };

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim()) return;

    setIsParsing(true);
    const parsed = await parseMedicationInput(aiInput);
    setIsParsing(false);

    if (parsed) {
      applyParsedData(parsed);
    } else {
      alert("Could not understand that. Please try again or use manual entry.");
    }
  };

  const applyParsedData = (parsed: any) => {
    setName(parsed.name);
    setDosage(parsed.dosage);
    setFrequency(parsed.frequency as FrequencyType);
    setTimes(parsed.times.length > 0 ? parsed.times : ['09:00']);
    setNotes(parsed.notes || '');
    if (parsed.currentStock) {
      setCurrentStock(parsed.currentStock);
    }
    setMode('manual');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blobType = mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1];
          const finalMimeType = base64String.split(';')[0].split(':')[1];
          
          setIsParsing(true);
          const parsed = await parseMedicationAudio(base64Data, finalMimeType);
          setIsParsing(false);
          
          if (parsed) {
             applyParsedData(parsed);
          } else {
             alert("Could not understand audio. Please try again.");
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone permission denied. Please allow access to use voice input.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
      audioChunksRef.current = [];
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setMode('scan');
    setConfidenceWarning(null);
    
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        
        const result = await identifyPillFromImage(base64Data);
        
        setIsParsing(false);
        if (result && result.name) {
          setName(result.name);
          if (result.dosage) setDosage(result.dosage);
          if (result.confidence && result.confidence !== 'HIGH') {
             setConfidenceWarning(`Confidence: ${result.confidence}. Please verify details.`);
          }
          setMode('manual');
        } else {
          alert("Could not identify medication. Please try manual entry.");
          setMode('manual');
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      setIsParsing(false);
      alert("Error processing image.");
      setMode('manual');
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const calculateIntervalTimes = () => {
    const calculatedTimes: string[] = [];
    const [startH, startM] = intervalStartTime.split(':').map(Number);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let current = new Date(startOfToday);
    current.setHours(startH);
    current.setMinutes(startM);

    const endOfDay = new Date(startOfToday);
    endOfDay.setHours(23);
    endOfDay.setMinutes(59);

    const intervalMins = intervalUnit === 'hours' ? intervalVal * 60 : intervalVal;

    while (current <= endOfDay) {
      calculatedTimes.push(format(current, 'HH:mm'));
      current = addMinutes(current, intervalMins);
    }
    return calculatedTimes;
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalTimes = times;
    let intervalInMinutes = undefined;

    if (frequency === FrequencyType.AS_NEEDED) {
      finalTimes = [];
    } else if (frequency === FrequencyType.INTERVAL) {
      finalTimes = calculateIntervalTimes();
      intervalInMinutes = intervalUnit === 'hours' ? intervalVal * 60 : intervalVal;
    }

    const newMed: Medication = {
      id: initialData ? initialData.id : uuidv4(),
      name,
      dosage,
      frequency,
      times: finalTimes,
      notes,
      color: selectedColor,
      icon: selectedIcon,
      daysOfWeek: [], // Simplified for now
      currentStock: Number(currentStock) || 0,
      lowStockThreshold: Number(lowStockThreshold) || 0,
      expiryDate: expiryDate || undefined,
      startDate: startDate,
      reminderSound: reminderSound,
      refillDate: initialData?.refillDate,
      interval: intervalInMinutes,
      startTime: frequency === FrequencyType.INTERVAL ? intervalStartTime : undefined
    };

    if (initialData && onUpdate) {
      onUpdate(newMed);
    } else {
      onAdd(newMed);
    }
    onClose();
  };

  const resetForm = () => {
    setName('');
    setDosage('');
    setFrequency(FrequencyType.DAILY);
    setTimes(['08:00']);
    setNotes('');
    setAiInput('');
    setCurrentStock(30);
    setLowStockThreshold(5);
    setExpiryDate('');
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setReminderSound(activeProfile.preferredSound || 'default');
    setMode('ai');
    setIntervalVal(4);
    setIntervalUnit('hours');
    setIntervalStartTime('08:00');
    setSelectedColor('blue');
    setSelectedIcon('pill');
    setConfidenceWarning(null);
  };

  const addTime = () => setTimes([...times, '12:00']);
  const updateTime = (index: number, val: string) => {
    const newTimes = [...times];
    newTimes[index] = val;
    setTimes(newTimes);
  };
  const removeTime = (index: number) => {
    setTimes(times.filter((_, i) => i !== index));
  };

  const testSound = () => {
    playNotificationSound(reminderSound);
  };

  const inputClass = "w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-800 placeholder:text-slate-400 font-medium";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto ring-1 ring-black/5">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-20">
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              {initialData ? 'Edit Medication' : 'Add Medication'}
            </h2>
            <p className="text-xs text-slate-500 font-medium">Profile: <span className="text-blue-600">{activeProfile.name}</span></p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {!initialData && (
            <div className="grid grid-cols-3 gap-2 mb-6 p-1.5 bg-slate-100 rounded-2xl">
              <button 
                className={`py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'ai' ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setMode('ai')}
              >
                <Sparkles size={16} /> Voice
              </button>
              <button 
                className={`py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'manual' ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setMode('manual')}
              >
                Manual
              </button>
              <button 
                className={`py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'scan' ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera size={16} /> Scan
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                capture="environment"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {mode === 'scan' ? (
             <div className="flex flex-col items-center justify-center py-12 text-center animate-fadeIn">
               <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6 relative">
                 {isParsing ? (
                   <>
                    <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <Loader2 className="text-indigo-600" size={32} />
                   </>
                 ) : (
                   <ScanLine className="text-indigo-600" size={32} />
                 )}
               </div>
               <h3 className="text-xl font-bold text-slate-800 mb-2">{isParsing ? 'Analyzing Image...' : 'Processing'}</h3>
               <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed">
                 Gemini is analyzing your photo to identify the medication name and dosage details.
               </p>
             </div>
          ) : mode === 'ai' ? (
            <form onSubmit={handleAiSubmit} className="space-y-4 animate-fadeIn">
              <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl">
                 <div className="flex gap-3">
                   <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                     <Sparkles size={20} />
                   </div>
                   <div>
                      <p className="text-sm font-bold text-slate-700">Gemini Assistant</p>
                      <p className="text-xs text-slate-500 leading-relaxed mt-1">Tap the mic and say something like:<br/> <span className="text-indigo-600 italic">"Take Amoxicillin 500mg three times a day for a week."</span></p>
                   </div>
                 </div>
              </div>
              
              <div className="relative">
                {isRecording ? (
                  <div className="w-full h-[200px] bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] flex flex-col items-center justify-center gap-4 shadow-xl shadow-indigo-200 animate-fadeIn text-white overflow-hidden relative">
                     {/* Animated Waves */}
                     <div className="absolute flex items-center justify-center">
                        <span className="w-20 h-20 border-4 border-white/20 rounded-full animate-[ping_2s_linear_infinite]"></span>
                        <span className="absolute w-32 h-32 border-4 border-white/10 rounded-full animate-[ping_2s_linear_infinite_0.5s]"></span>
                     </div>

                     <div className="z-10 flex flex-col items-center mt-4">
                        <div className="mb-2 font-bold text-2xl tracking-tight">Listening...</div>
                        <p className="text-indigo-100 text-sm font-medium opacity-90">Say your schedule clearly</p>
                     </div>

                     <div className="z-20 flex gap-4 mt-4 w-full px-8">
                        <button 
                           type="button" 
                           onClick={cancelRecording}
                           className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-colors backdrop-blur-sm border border-white/10"
                        >
                          Cancel
                        </button>
                        <button 
                           type="button" 
                           onClick={stopRecording}
                           className="flex-1 py-3 bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl text-sm font-bold transition-colors shadow-lg flex items-center justify-center gap-2"
                        >
                          <Check size={18} /> Done
                        </button>
                     </div>
                  </div>
                ) : (
                  <div className="relative group">
                    <textarea
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      placeholder="Type or speak your schedule..."
                      className="w-full p-5 pb-16 bg-slate-50 rounded-[1.5rem] border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none min-h-[160px] resize-none text-slate-800 placeholder:text-slate-400 transition-all text-lg leading-relaxed"
                      disabled={isParsing}
                    />
                    <button 
                      type="button"
                      onClick={startRecording}
                      disabled={isParsing}
                      className="absolute bottom-4 right-4 bg-indigo-600 text-white p-3 rounded-full hover:bg-indigo-700 transition-transform hover:scale-110 shadow-lg shadow-indigo-200"
                    >
                      <Mic size={24} />
                    </button>
                  </div>
                )}
              </div>

              {!isRecording && (
                <button 
                  type="submit" 
                  disabled={!aiInput.trim() || isParsing}
                  className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold text-lg hover:bg-slate-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-slate-200"
                >
                  {isParsing ? <Loader2 size={24} className="animate-spin" /> : <Sparkles size={20} />}
                  {isParsing ? 'Processing...' : 'Create Schedule'}
                </button>
              )}
            </form>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-6 animate-fadeIn">
              {confidenceWarning && (
                <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-200 flex items-start gap-3 text-sm">
                  <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
                  <span>{confidenceWarning}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Medication Name</label>
                  <input 
                    required 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Lisinopril"
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Dosage</label>
                    <input 
                      required 
                      value={dosage}
                      onChange={(e) => setDosage(e.target.value)}
                      placeholder="e.g. 10mg"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Frequency</label>
                    <div className="relative">
                      <select 
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value as FrequencyType)}
                        className={`${inputClass} appearance-none`}
                      >
                        <option value={FrequencyType.DAILY}>Daily</option>
                        <option value={FrequencyType.WEEKLY}>Weekly</option>
                        <option value={FrequencyType.INTERVAL}>Interval</option>
                        <option value={FrequencyType.AS_NEEDED}>As Needed</option>
                      </select>
                      <ArrowRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Color</label>
                    <div className="flex gap-2">
                       {COLORS.slice(0, 5).map(c => (
                         <button
                           key={c.name}
                           type="button"
                           onClick={() => setSelectedColor(c.name)}
                           className={`w-8 h-8 rounded-full ${c.class} transition-transform ${selectedColor === c.name ? 'scale-125 ring-2 ring-offset-2 ring-slate-300' : 'opacity-40 hover:opacity-100'}`}
                         />
                       ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Icon</label>
                    <div className="flex flex-wrap gap-2">
                       {ICONS.map(i => (
                         <button
                           key={i.name}
                           type="button"
                           onClick={() => setSelectedIcon(i.name)}
                           className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${selectedIcon === i.name ? 'bg-indigo-50 border-indigo-500 text-indigo-600' : 'border-slate-200 text-slate-300 hover:border-slate-300'}`}
                         >
                           {i.icon}
                         </button>
                       ))}
                    </div>
                  </div>
                </div>

                {/* Inventory Section */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Package size={16} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">Inventory Tracking</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Current Stock</label>
                      <input 
                        type="number"
                        value={currentStock}
                        onChange={(e) => setCurrentStock(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Low Warning At</label>
                      <input 
                        type="number"
                        value={lowStockThreshold}
                        onChange={(e) => setLowStockThreshold(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-bold"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Expiry Date (Optional)</label>
                      <input 
                        type="date"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Start Date */}
                <div>
                   <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Start Date</label>
                   <div className="relative">
                      <input 
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className={inputClass}
                      />
                      <Calendar size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                   </div>
                </div>

                {frequency === FrequencyType.INTERVAL ? (
                   <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                     <h4 className="font-bold text-blue-800 text-sm mb-3">Interval Schedule</h4>
                     <div className="flex items-center gap-3 mb-3">
                       <span className="text-sm text-blue-600">Take every</span>
                       <input 
                         type="number" 
                         min="1"
                         value={intervalVal}
                         onChange={(e) => setIntervalVal(Number(e.target.value))}
                         className="w-16 p-2 rounded-lg border border-blue-200 text-center font-bold"
                       />
                       <select 
                         value={intervalUnit}
                         onChange={(e) => setIntervalUnit(e.target.value as 'hours' | 'minutes')}
                         className="p-2 rounded-lg border border-blue-200 text-sm"
                       >
                         <option value="hours">Hours</option>
                         <option value="minutes">Minutes</option>
                       </select>
                     </div>
                     <div className="flex items-center gap-3">
                       <span className="text-sm text-blue-600">Starting at</span>
                       <input 
                         type="time" 
                         value={intervalStartTime}
                         onChange={(e) => setIntervalStartTime(e.target.value)}
                         className="p-2 rounded-lg border border-blue-200 font-bold"
                       />
                     </div>
                     <p className="text-xs text-blue-400 mt-2">
                       Times will be automatically calculated for the day.
                     </p>
                   </div>
                ) : frequency !== FrequencyType.AS_NEEDED && (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Scheduled Times</label>
                    <div className="space-y-2">
                      {times.map((time, idx) => (
                        <div key={idx} className="flex gap-2">
                          <div className="relative flex-1">
                            <input 
                              type="time"
                              value={time}
                              onChange={(e) => updateTime(idx, e.target.value)}
                              className={`${inputClass} tracking-widest`}
                            />
                            <Timer size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
                          {times.length > 1 && (
                            <button 
                              type="button" 
                              onClick={() => removeTime(idx)}
                              className="p-3.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors border border-transparent hover:border-red-100"
                            >
                              <Trash2 size={20} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button 
                        type="button" 
                        onClick={addTime}
                        className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <Plus size={16} /> Add Time
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Notification Sound */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                   <label className="block text-xs font-bold text-slate-500 mb-2 flex items-center gap-2">
                      <Bell size={14} /> Notification Sound
                   </label>
                   <div className="flex gap-2">
                     <select 
                       value={reminderSound}
                       onChange={(e) => setReminderSound(e.target.value as SoundType)}
                       className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none"
                     >
                       <option value="default">Default</option>
                       <option value="chime">Chime</option>
                       <option value="alert">Alert</option>
                       <option value="soft">Soft</option>
                       <option value="harp">Harp</option>
                       <option value="nature">Nature</option>
                       <option value="arcade">Arcade</option>
                       <option value="glass">Glass</option>
                     </select>
                     <button 
                       type="button"
                       onClick={testSound}
                       className="p-2 bg-white border border-slate-200 rounded-lg text-blue-500 hover:bg-blue-50"
                     >
                       <Play size={18} />
                     </button>
                   </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Notes (Optional)</label>
                  <input 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Take with food"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-[2] py-4 bg-blue-600 text-white rounded-xl font-bold shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all transform active:scale-[0.98]"
                >
                  {initialData ? 'Save Changes' : 'Save Medicine'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddMedicationModal;