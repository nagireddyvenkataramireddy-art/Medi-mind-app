
import React, { useState } from 'react';
import { Medication, Appointment, PharmacySearchResponse, ConditionAdvice } from '../types';
import SafetyCheck from './SafetyCheck';
import { findNearbyPlaces, getConditionAdvice } from '../services/geminiService';
import { Calendar as CalendarIcon, MapPin, Stethoscope, Plus, X, Clock, FileText, ChevronRight, ShieldCheck, ChevronLeft, List, Building2, Loader2, Navigation, ExternalLink, Map, CalendarPlus, Hospital, HeartPulse, Check, AlertOctagon, Info } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { 
  format, 
  isPast, 
  isToday, 
  endOfMonth, 
  endOfWeek, 
  eachDayOfInterval, 
  addMonths, 
  isSameMonth, 
  isSameDay,
  addDays
} from 'date-fns';

interface CareViewProps {
  medications: Medication[];
  appointments: Appointment[];
  onAddAppointment: (appt: Appointment) => void;
  onDeleteAppointment: (id: string) => void;
}

const SPECIALTIES = [
  "General Practitioner",
  "Cardiologist",
  "Dermatologist",
  "Endocrinologist",
  "Gastroenterologist",
  "Gynecologist",
  "Neurologist",
  "Oncologist",
  "Ophthalmologist",
  "Optometrist",
  "Orthopedist",
  "Pediatrician",
  "Psychiatrist",
  "Pulmonologist",
  "Radiologist",
  "Urologist",
  "Dentist",
  "ENT Specialist",
  "Physical Therapist"
];

const CareView: React.FC<CareViewProps> = ({ medications, appointments, onAddAppointment, onDeleteAppointment }) => {
  const [activeTab, setActiveTab] = useState<'appointments' | 'safety' | 'pharmacy' | 'hospital' | 'wellness'>('appointments');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [isAdding, setIsAdding] = useState(false);

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Search State (Pharmacy & Hospital)
  const [searchResult, setSearchResult] = useState<PharmacySearchResponse | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Wellness State
  const [diagnosisInput, setDiagnosisInput] = useState('');
  const [conditionAdvice, setConditionAdvice] = useState<ConditionAdvice | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  // Form State
  const [doctorName, setDoctorName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newAppt: Appointment = {
      id: uuidv4(),
      doctorName,
      specialty,
      date,
      time,
      location,
      notes
    };
    onAddAppointment(newAppt);
    setIsAdding(false);
    resetForm();
  };

  const resetForm = () => {
    setDoctorName('');
    setSpecialty('');
    setDate('');
    setTime('');
    setLocation('');
    setNotes('');
  };

  const handleFindPlaces = (type: 'pharmacy' | 'hospital') => {
    setLoadingSearch(true);
    setLocationError(null);
    setSearchResult(null);

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser.");
      setLoadingSearch(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const result = await findNearbyPlaces(latitude, longitude, type);
        setSearchResult(result);
        setLoadingSearch(false);
      },
      (error) => {
        console.error("Error getting location:", error);
        setLocationError("Unable to retrieve your location. Please check permissions.");
        setLoadingSearch(false);
      }
    );
  };

  const handleGetAdvice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagnosisInput.trim()) return;
    
    setLoadingAdvice(true);
    setConditionAdvice(null);
    const result = await getConditionAdvice(diagnosisInput);
    setConditionAdvice(result);
    setLoadingAdvice(false);
  }

  const sortedAppointments = [...appointments].sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time}`);
    const dateB = new Date(`${b.date}T${b.time}`);
    return dateA.getTime() - dateB.getTime();
  });

  const upcomingAppointments = sortedAppointments.filter(a => !isPast(new Date(`${a.date}T${a.time}`)) || isToday(new Date(a.date + 'T00:00')));
  const pastAppointments = sortedAppointments.filter(a => isPast(new Date(`${a.date}T${a.time}`)) && !isToday(new Date(a.date + 'T00:00')));

  // Calendar Helpers
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(addMonths(currentMonth, -1));
  
  const safeStartOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const dayOfWeek = safeStartOfMonth.getDay(); // 0 is Sunday
  const safeStartOfWeek = new Date(safeStartOfMonth);
  safeStartOfWeek.setDate(safeStartOfMonth.getDate() - dayOfWeek);

  const calendarDays = eachDayOfInterval({
    start: safeStartOfWeek,
    end: endOfWeek(endOfMonth(currentMonth))
  });

  const getAppointmentsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return appointments.filter(a => a.date === dateStr);
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="bg-white p-1.5 rounded-xl border border-slate-200 flex gap-2 shadow-sm overflow-x-auto no-scrollbar">
        {[
          { id: 'appointments', label: 'Visits', icon: <CalendarIcon size={16} /> },
          { id: 'safety', label: 'Safety', icon: <ShieldCheck size={16} /> },
          { id: 'wellness', label: 'Wellness', icon: <HeartPulse size={16} /> },
          { id: 'pharmacy', label: 'Pharmacy', icon: <Building2 size={16} /> },
          { id: 'hospital', label: 'Hospital', icon: <Hospital size={16} /> },
        ].map(tab => (
           <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              setSearchResult(null); // Clear search when switching tabs
              setConditionAdvice(null);
              setDiagnosisInput('');
            }}
            className={`flex-1 min-w-[100px] py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'safety' ? (
        <SafetyCheck medications={medications} />
      ) : activeTab === 'wellness' ? (
        <div className="animate-fadeIn space-y-6">
          <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl shadow-lg p-6 text-white">
            <h2 className="text-2xl font-bold mb-2">Condition & Diet Advice</h2>
            <p className="text-purple-100 mb-6 max-w-sm">
              Enter a diagnosis (e.g., Diabetes, Hypertension) to get personalized dietary tips and lifestyle advice.
            </p>
            <form onSubmit={handleGetAdvice} className="relative">
              <input 
                value={diagnosisInput}
                onChange={e => setDiagnosisInput(e.target.value)}
                placeholder="Enter condition (e.g. Type 2 Diabetes)"
                className="w-full p-4 pr-14 rounded-xl text-slate-800 outline-none shadow-sm"
              />
              <button 
                type="submit" 
                disabled={loadingAdvice || !diagnosisInput.trim()}
                className="absolute right-2 top-2 bottom-2 bg-purple-600 hover:bg-purple-800 text-white px-3 rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {loadingAdvice ? <Loader2 className="animate-spin" /> : <ChevronRight />}
              </button>
            </form>
          </div>

          {conditionAdvice && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2">
                Advice for {conditionAdvice.condition}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="bg-green-50 rounded-xl p-5 border border-green-100">
                    <h4 className="flex items-center gap-2 font-bold text-green-800 mb-3">
                      <Check className="bg-green-200 p-1 rounded-full text-green-700" size={20} />
                      Recommended Foods
                    </h4>
                    <ul className="space-y-2">
                      {conditionAdvice.recommendedFoods.map((item, i) => (
                        <li key={i} className="text-sm text-green-800 flex items-start gap-2">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0"></span>
                          {item}
                        </li>
                      ))}
                    </ul>
                 </div>

                 <div className="bg-red-50 rounded-xl p-5 border border-red-100">
                    <h4 className="flex items-center gap-2 font-bold text-red-800 mb-3">
                      <X className="bg-red-200 p-1 rounded-full text-red-700" size={20} />
                      Foods to Avoid
                    </h4>
                    <ul className="space-y-2">
                      {conditionAdvice.avoidFoods.map((item, i) => (
                        <li key={i} className="text-sm text-red-800 flex items-start gap-2">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0"></span>
                          {item}
                        </li>
                      ))}
                    </ul>
                 </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
                <h4 className="flex items-center gap-2 font-bold text-blue-800 mb-3">
                  <Info className="bg-blue-200 p-1 rounded-full text-blue-700" size={20} />
                  Lifestyle Tips
                </h4>
                <div className="space-y-2">
                   {conditionAdvice.lifestyleTips.map((tip, i) => (
                     <p key={i} className="text-sm text-blue-800 flex gap-2">
                       <span className="font-bold text-blue-400">{i+1}.</span> {tip}
                     </p>
                   ))}
                </div>
              </div>
              
              <div className="text-[10px] text-center text-slate-400">
                AI-generated advice. Please consult a nutritionist or doctor for professional medical plans.
              </div>
            </div>
          )}
        </div>
      ) : (activeTab === 'pharmacy' || activeTab === 'hospital') ? (
        <div className="animate-fadeIn space-y-4">
           <div className={`rounded-2xl shadow-lg p-6 text-white relative overflow-hidden ${activeTab === 'pharmacy' ? 'bg-gradient-to-br from-teal-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-pink-600'}`}>
             <div className="relative z-10">
               <h2 className="text-2xl font-bold mb-2">
                 {activeTab === 'pharmacy' ? 'Nearest Medical Stores' : 'Nearby Hospitals'}
               </h2>
               <p className={`${activeTab === 'pharmacy' ? 'text-teal-100' : 'text-red-100'} mb-6 max-w-sm`}>
                 {activeTab === 'pharmacy' 
                   ? "Need a refill? Find top-rated pharmacies and medical supply stores near your current location."
                   : "Find nearby hospitals, clinics, and emergency care centers quickly."
                 }
               </p>
               <button 
                 onClick={() => handleFindPlaces(activeTab as 'pharmacy' | 'hospital')}
                 disabled={loadingSearch}
                 className={`bg-white px-6 py-3 rounded-xl font-bold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-75 ${activeTab === 'pharmacy' ? 'text-teal-600 hover:bg-teal-50' : 'text-red-600 hover:bg-red-50'}`}
               >
                 {loadingSearch ? <Loader2 className="animate-spin" /> : <Map size={18} />}
                 {searchResult ? 'Search Again' : 'Find Nearby'}
               </button>
             </div>
             {activeTab === 'pharmacy' ? (
                <MapPin size={100} className="text-white opacity-10 absolute -bottom-4 -right-4" />
             ) : (
                <Hospital size={100} className="text-white opacity-10 absolute -bottom-4 -right-4" />
             )}
           </div>

           {locationError && (
             <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-sm font-medium flex items-center gap-2">
               <X size={18} /> {locationError}
             </div>
           )}

           {searchResult && (
             <div className="space-y-4">
               <div className="flex justify-between items-end px-1">
                 <h3 className="font-bold text-slate-700">Found Locations</h3>
                 <span className="text-xs font-bold text-slate-400 bg-white px-2 py-1 rounded-full border border-slate-200">
                   {searchResult.places.length} Results
                 </span>
               </div>
               
               {/* Clean Card List */}
               {searchResult.places.length > 0 ? (
                 <div className="grid grid-cols-1 gap-3">
                   {searchResult.places.map((place, idx) => (
                     <a 
                       key={idx}
                       href={place.uri}
                       target="_blank"
                       rel="noreferrer"
                       className={`group flex items-center p-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.99] ${activeTab === 'pharmacy' ? 'hover:border-teal-200' : 'hover:border-red-200'}`}
                     >
                       <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mr-4 transition-colors ${
                         activeTab === 'pharmacy' 
                           ? 'bg-teal-50 text-teal-600 group-hover:bg-teal-500 group-hover:text-white' 
                           : 'bg-red-50 text-red-600 group-hover:bg-red-500 group-hover:text-white'
                       }`}>
                         {activeTab === 'pharmacy' ? <Building2 size={20} /> : <Hospital size={20} />}
                       </div>
                       
                       <div className="flex-1 min-w-0 mr-4">
                         <h4 className={`font-bold text-slate-800 text-sm sm:text-base truncate transition-colors ${activeTab === 'pharmacy' ? 'group-hover:text-teal-700' : 'group-hover:text-red-700'}`}>
                           {place.title}
                         </h4>
                         <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                           <MapPin size={12} />
                           <span className="truncate">View on Google Maps</span>
                         </div>
                       </div>

                       <div className={`text-slate-300 transition-colors ${activeTab === 'pharmacy' ? 'group-hover:text-teal-500' : 'group-hover:text-red-500'}`}>
                         <Navigation size={20} />
                       </div>
                     </a>
                   ))}
                 </div>
               ) : (
                  <div className="p-8 text-center bg-white border border-slate-100 rounded-xl shadow-sm">
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                        <MapPin size={24} />
                      </div>
                      <p className="text-slate-500 text-sm font-medium">
                         No direct map links found. Check the summary below.
                      </p>
                  </div>
               )}

               {/* Text Summary */}
               {searchResult.text && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                     <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                       <FileText size={12} /> AI Summary
                     </h5>
                     <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {searchResult.text}
                     </div>
                  </div>
               )}
             </div>
           )}
        </div>
      ) : (
        <div className="space-y-6 animate-fadeIn">
          {/* Add Appointment Button */}
          {!isAdding ? (
            <div className="flex gap-2">
              <button
                onClick={() => setIsAdding(true)}
                className="flex-1 bg-white border-2 border-dashed border-blue-200 hover:border-blue-400 text-blue-500 rounded-xl p-4 flex items-center justify-center gap-2 font-bold transition-all hover:bg-blue-50 hover:shadow-sm"
              >
                <Plus size={20} /> Schedule New Appointment
              </button>
              <div className="bg-white p-1 rounded-xl flex items-center border border-slate-100 shadow-sm">
                 <button 
                  onClick={() => setViewMode('list')}
                  className={`p-3 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                  title="List View"
                 >
                   <List size={20} />
                 </button>
                 <button 
                  onClick={() => setViewMode('calendar')}
                  className={`p-3 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Calendar View"
                 >
                   <CalendarIcon size={20} />
                 </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-5 overflow-hidden animate-slideDown">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Stethoscope size={20} className="text-blue-500" />
                  New Appointment
                </h3>
                <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Doctor Name</label>
                    <input 
                      required
                      value={doctorName}
                      onChange={e => setDoctorName(e.target.value)}
                      placeholder="Dr. Smith"
                      className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Specialty</label>
                    <input 
                      required
                      value={specialty}
                      onChange={e => setSpecialty(e.target.value)}
                      placeholder="Cardiologist"
                      list="specialties-list"
                      className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                    />
                    <datalist id="specialties-list">
                      {SPECIALTIES.map(s => <option key={s} value={s} />)}
                    </datalist>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Date</label>
                    <input 
                      type="date"
                      required
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Time</label>
                    <input 
                      type="time"
                      required
                      value={time}
                      onChange={e => setTime(e.target.value)}
                      className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-slate-700"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Location (Optional)</label>
                  <input 
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="City Hospital, Room 302"
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Notes (Optional)</label>
                  <textarea 
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Bring blood test results..."
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none h-20 transition-shadow"
                  />
                </div>
                <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 flex items-center justify-center gap-2">
                  <Clock size={18} /> Schedule Appointment
                </button>
              </form>
            </div>
          )}

          {viewMode === 'list' ? (
             <>
                {/* Upcoming List */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                    Upcoming Visits
                  </h3>
                  {upcomingAppointments.length === 0 ? (
                    <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center text-slate-400">
                      <Stethoscope size={40} className="mx-auto mb-3 opacity-20" />
                      <p>No upcoming appointments scheduled.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {upcomingAppointments.map(appt => (
                        <AppointmentCard key={appt.id} appt={appt} onDelete={onDeleteAppointment} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Past List */}
                {pastAppointments.length > 0 && (
                  <div className="pt-4 border-t border-slate-200">
                     <button className="flex items-center gap-2 text-slate-400 font-medium text-sm hover:text-slate-600 transition-colors group">
                       Show Past Appointments 
                       <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                     </button>
                  </div>
                )}
             </>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
               {/* Calendar Header */}
               <div className="p-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
                  <button onClick={prevMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-500">
                    <ChevronLeft size={20} />
                  </button>
                  <h3 className="font-bold text-lg text-slate-800">
                    {format(currentMonth, 'MMMM yyyy')}
                  </h3>
                  <button onClick={nextMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-500">
                    <ChevronRight size={20} />
                  </button>
               </div>

               {/* Calendar Grid */}
               <div className="p-4">
                  <div className="grid grid-cols-7 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="text-center text-[10px] font-extrabold text-slate-400 uppercase py-1 tracking-wider">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, idx) => {
                       const appts = getAppointmentsForDate(day);
                       const isSelected = isSameDay(day, selectedDate);
                       const isCurrentMonth = isSameMonth(day, currentMonth);
                       const isTodayDate = isToday(day);

                       return (
                         <button
                           key={idx}
                           onClick={() => setSelectedDate(day)}
                           className={`
                             min-h-[3.5rem] rounded-xl flex flex-col items-center justify-start pt-2 relative transition-all border
                             ${isSelected ? 'bg-blue-50 border-blue-500 z-10 shadow-sm' : 'bg-transparent border-transparent hover:bg-slate-50'}
                             ${!isCurrentMonth ? 'opacity-30' : 'opacity-100'}
                           `}
                         >
                            <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isTodayDate ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700'}`}>
                              {format(day, 'd')}
                            </span>
                            
                            {appts.length > 0 && (
                              <div className="flex gap-0.5 mt-0.5">
                                {appts.slice(0, 3).map((_, i) => (
                                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500 ring-1 ring-white"></div>
                                ))}
                                {appts.length > 3 && <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>}
                              </div>
                            )}
                         </button>
                       );
                    })}
                  </div>
               </div>
               
               {/* Selected Date Appointments */}
               <div className="border-t border-slate-100 bg-slate-50/50 p-4 min-h-[150px]">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    {format(selectedDate, 'EEEE, MMMM do')}
                  </h4>
                  {getAppointmentsForDate(selectedDate).length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-slate-400 py-2 h-full">
                       <p className="text-sm">No appointments.</p>
                       <button onClick={() => setIsAdding(true)} className="text-xs text-blue-500 hover:text-blue-700 font-medium mt-2">
                         + Add one for this day
                       </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {getAppointmentsForDate(selectedDate).map(appt => (
                        <AppointmentCard key={appt.id} appt={appt} onDelete={onDeleteAppointment} />
                      ))}
                    </div>
                  )}
               </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface AppointmentCardProps {
  appt: Appointment;
  onDelete: (id: string) => void;
}

const AppointmentCard: React.FC<AppointmentCardProps> = ({ appt, onDelete }) => {
  const downloadICS = () => {
    // Basic ICS generation
    const startDate = format(new Date(`${appt.date}T${appt.time}`), "yyyyMMdd'T'HHmmss");
    // Assume 1 hour duration
    const endDate = format(addDays(new Date(`${appt.date}T${appt.time}`), 0).setHours(new Date(`${appt.date}T${appt.time}`).getHours() + 1), "yyyyMMdd'T'HHmmss");
    
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Doctor Appointment: ${appt.doctorName}
DTSTART:${startDate}
DTEND:${endDate}
DESCRIPTION:${appt.specialty} - ${appt.notes || ''}
LOCATION:${appt.location || ''}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'appointment.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow group relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
      <div className="flex justify-between items-start">
        <div className="flex gap-4">
          <div className="bg-blue-50 text-blue-600 w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 border border-blue-100 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider">{format(new Date(appt.date + 'T00:00'), 'MMM')}</span>
              <span className="text-xl font-bold leading-none">{format(new Date(appt.date + 'T00:00'), 'dd')}</span>
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-lg">{appt.doctorName}</h4>
            <p className="text-blue-600 text-sm font-medium mb-1">{appt.specialty}</p>
            <div className="flex flex-col gap-1 mt-2">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                <Clock size={14} /> {format(new Date(`2000-01-01T${appt.time}`), 'h:mm a')}
              </div>
              {appt.location && (
                <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                  <MapPin size={14} /> {appt.location}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <button 
            onClick={downloadICS}
            className="text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all p-2"
            title="Add to Calendar"
          >
            <CalendarPlus size={18} />
          </button>
          <button 
            onClick={() => onDelete(appt.id)}
            className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all p-2"
            title="Cancel Appointment"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      {appt.notes && (
        <div className="mt-4 pt-3 border-t border-slate-50 text-xs text-slate-500 flex gap-2">
          <FileText size={14} className="flex-shrink-0 mt-0.5 text-slate-400" />
          {appt.notes}
        </div>
      )}
    </div>
  );
};

export default CareView;
