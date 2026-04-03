
import React, { useState } from 'react';
import { Medication, LogEntry, VitalEntry, MoodEntry, MoodType } from '../types';
import { format, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Printer, CheckCircle2, FileText, Loader2, Sparkles, Copy, Smile, Meh, Frown, ThumbsUp, Activity, Heart, Clock } from 'lucide-react';
import { generateHealthReport } from '../services/geminiService';

interface HistoryViewProps {
  medications: Medication[];
  logs: LogEntry[];
  vitals?: VitalEntry[];
  moods?: MoodEntry[];
  userName: string;
}

const HistoryView: React.FC<HistoryViewProps> = ({ medications, logs, vitals = [], moods = [], userName }) => {
  const [report, setReport] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Generate last 7 days of data for Chart
  const data = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayLogs = logs.filter(l => l.dateStr === dateStr);
    
    const taken = dayLogs.filter(l => l.status === 'TAKEN').length;
    const skipped = dayLogs.filter(l => l.status === 'SKIPPED').length;
    
    let totalScheduled = 0;
    medications.forEach(med => {
        if (med.frequency === 'DAILY') totalScheduled += med.times.length;
    });

    return {
      name: format(date, 'EEE'),
      fullDate: format(date, 'MMM do'),
      taken,
      skipped,
      total: Math.max(taken + skipped, totalScheduled) 
    };
  });

  // Mood History Data for Visualizer
  const moodHistory = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const entry = moods.find(m => m.dateStr === dateStr); // simplified to take one
    return {
      day: format(date, 'EEE'),
      mood: entry?.type
    };
  });

  const getMoodIcon = (type?: MoodType) => {
    switch (type) {
      case 'GREAT': return <ThumbsUp size={16} className="text-green-600" />;
      case 'GOOD': return <Smile size={16} className="text-blue-600" />;
      case 'OKAY': return <Meh size={16} className="text-yellow-600" />;
      case 'LOW': return <Frown size={16} className="text-orange-600" />;
      case 'PAIN': return <Activity size={16} className="text-red-600" />;
      default: return <div className="w-4 h-4 rounded-full bg-slate-100" />;
    }
  };

  const getMoodColor = (type?: MoodType) => {
     switch(type) {
       case 'GREAT': return 'bg-green-100 border-green-200';
       case 'GOOD': return 'bg-blue-100 border-blue-200';
       case 'OKAY': return 'bg-yellow-100 border-yellow-200';
       case 'LOW': return 'bg-orange-100 border-orange-200';
       case 'PAIN': return 'bg-red-100 border-red-200';
       default: return 'bg-slate-50 border-slate-100';
     }
  }

  const latestBP = vitals.filter(v => v.type === 'BLOOD_PRESSURE').sort((a,b) => b.timestamp - a.timestamp)[0];
  const latestWeight = vitals.filter(v => v.type === 'WEIGHT').sort((a,b) => b.timestamp - a.timestamp)[0];

  const totalTaken = logs.filter(l => l.status === 'TAKEN').length;
  const totalLogs = logs.length;
  const adherenceRate = totalLogs > 0 ? Math.round((totalTaken / totalLogs) * 100) : 100;

  const handleExportPDF = () => {
    const title = `MediMind_Report_${format(new Date(), 'yyyy-MM-dd')}`;
    const date = new Date().toLocaleDateString();
    
    // Process markdown to basic HTML for the report if present
    let reportHtml = '';
    if (report) {
      reportHtml = `
        <div class="stat-box" style="background: #f8fafc; border-left: 4px solid #6366f1;">
          <h2 style="color: #4f46e5; margin-top: 0;">AI Doctor's Analysis</h2>
          <div class="report-content">${report}</div>
        </div>
      `;
    }

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 800px; margin: 0 auto; line-height: 1.5; }
            h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 5px; font-size: 24px; }
            .header-meta { color: #64748b; font-size: 0.9em; margin-bottom: 30px; display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; }
            .stat-box { background: #fff; padding: 20px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #e2e8f0; page-break-inside: avoid; }
            h2 { color: #334155; font-size: 1.2em; margin-top: 0; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.85em; }
            th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e2e8f0; }
            th { background-color: #f8fafc; color: #475569; font-weight: 600; }
            .taken { color: #15803d; font-weight: bold; background-color: #dcfce7; padding: 2px 8px; border-radius: 99px; font-size: 0.8em; }
            .skipped { color: #b91c1c; font-weight: bold; background-color: #fee2e2; padding: 2px 8px; border-radius: 99px; font-size: 0.8em; }
            .med-name { font-weight: 600; color: #334155; }
            .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 0.7em; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            
            /* AI Report Styles */
            .report-content h2 { color: #4338ca; font-size: 1.1em; border-bottom: 1px solid #e0e7ff; padding-bottom: 5px; margin-top: 15px; }
            .report-content p { margin-bottom: 8px; }
            .report-content ul { padding-left: 20px; margin-bottom: 10px; }
            .report-content li { margin-bottom: 4px; }
            
            @media print {
              body { padding: 0; }
              .stat-box { border: 1px solid #ccc; }
            }
          </style>
        </head>
        <body>
          <h1>MediMind Health Report</h1>
          <div class="header-meta">
             <div>Patient: <strong>${userName}</strong></div>
             <div>Date: ${date}</div>
          </div>

          <div class="stat-box">
            <h2>Adherence Summary</h2>
            <div style="display: flex; gap: 20px; justify-content: space-around; text-align: center;">
              <div>
                <div style="font-size: 0.7em; color: #64748b; text-transform: uppercase; font-weight: 700;">Score</div>
                <div style="font-size: 2em; font-weight: 800; color: #2563eb;">${adherenceRate}%</div>
              </div>
              <div>
                <div style="font-size: 0.7em; color: #64748b; text-transform: uppercase; font-weight: 700;">Taken</div>
                <div style="font-size: 2em; font-weight: 800; color: #16a34a;">${totalTaken}</div>
              </div>
              <div>
                <div style="font-size: 0.7em; color: #64748b; text-transform: uppercase; font-weight: 700;">Skipped</div>
                <div style="font-size: 2em; font-weight: 800; color: #dc2626;">${totalLogs - totalTaken}</div>
              </div>
            </div>
          </div>
          
          ${reportHtml}

          <div class="stat-box">
            <h2>Activity Log (Last 30 Days)</h2>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Medication</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${logs.slice().reverse().slice(0, 50).map(log => {
                  const med = medications.find(m => m.id === log.medicationId);
                  return `
                    <tr>
                      <td>${log.dateStr} <span style="color:#94a3b8; font-size:0.9em">${log.scheduledTime}</span></td>
                      <td class="med-name">${med?.name || 'Unknown'}</td>
                      <td><span class="${log.status === 'TAKEN' ? 'taken' : 'skipped'}">${log.status}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <div class="footer">
            Generated by MediMind AI • Consult your doctor for professional medical advice.
          </div>
        </body>
      </html>
    `;

    // Create hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.visibility = 'hidden';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(content);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (error) {
          console.error("Printing failed", error);
          alert("Unable to print directly. Please use your browser's share or print option.");
        } finally {
          // Remove iframe after print dialog usage to clean up
          setTimeout(() => {
             if (document.body.contains(iframe)) {
               document.body.removeChild(iframe);
             }
          }, 2000);
        }
      }, 500);
    }
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    const result = await generateHealthReport(medications, logs, vitals, moods);
    setReport(result);
    setGenerating(false);
  };

  const handleCopyReport = () => {
    if (report) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = report;
      navigator.clipboard.writeText(tempDiv.innerText);
      alert("Report text copied to clipboard!");
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      {/* Summary Score Card */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-6 text-white flex items-center justify-between shadow-lg shadow-blue-200">
        <div>
          <h3 className="text-blue-100 font-medium mb-1">Overall Adherence</h3>
          <div className="text-4xl font-bold">{adherenceRate}%</div>
          <p className="text-sm text-blue-100 mt-2 opacity-80">
            {adherenceRate >= 90 ? 'Excellent work! Keeping it up.' : 'Try to stay more consistent.'}
          </p>
        </div>
        <div className="bg-white/20 p-3 rounded-full">
           <CheckCircle2 size={32} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {/* Adherence Chart */}
         <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Weekly Adherence</h2>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="taken" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} barSize={16} />
                  <Bar dataKey="skipped" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
         </div>

         {/* Wellbeing Overview */}
         <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Wellbeing Overview</h2>
            
            <div className="mb-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mood History (7 Days)</h4>
              <div className="flex justify-between items-center gap-1">
                 {moodHistory.map((m, i) => (
                   <div key={i} className="flex flex-col items-center gap-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${getMoodColor(m.mood as MoodType)}`}>
                        {getMoodIcon(m.mood as MoodType)}
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold">{m.day.charAt(0)}</span>
                   </div>
                 ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-50">
               <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Latest Vitals</h4>
               <div className="flex gap-4">
                  <div className="flex-1 bg-slate-50 rounded-lg p-2.5 flex items-center gap-2">
                     <Heart size={16} className="text-red-500" />
                     <div>
                       <div className="text-[10px] text-slate-400 font-bold">BP</div>
                       <div className="text-xs font-bold text-slate-700">{latestBP ? latestBP.value : '--/--'}</div>
                     </div>
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-lg p-2.5 flex items-center gap-2">
                     <Activity size={16} className="text-orange-500" />
                     <div>
                       <div className="text-[10px] text-slate-400 font-bold">Weight</div>
                       <div className="text-xs font-bold text-slate-700">{latestWeight ? `${latestWeight.value}kg` : '--'}</div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* AI Doctor Report Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center flex-wrap gap-2">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-500" /> AI Health Report
          </h3>
          <div className="flex gap-2">
            <button 
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Printer size={14} /> Print / PDF
            </button>
            <button 
              onClick={handleGenerateReport} 
              disabled={generating}
              className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              {report ? 'Regenerate Analysis' : 'Generate Analysis'}
            </button>
          </div>
        </div>
        
        <div className="p-6">
          {generating ? (
            <div className="py-12 text-center text-slate-400">
              <div className="relative w-16 h-16 mx-auto mb-4">
                 <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                 <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="font-medium text-slate-600">Analyzing your health data...</p>
              <p className="text-xs text-slate-400 mt-1">Reviewing medications, adherence logs, and vitals.</p>
            </div>
          ) : report ? (
            <div>
              <div 
                className="prose prose-sm prose-indigo max-w-none text-slate-600 leading-relaxed bg-indigo-50/30 p-6 rounded-xl border border-indigo-50"
                dangerouslySetInnerHTML={{ __html: report }}
              />
              <div className="flex justify-between items-center mt-4 px-1">
                 <p className="text-xs text-slate-400 italic">This AI report is for informational purposes only.</p>
                 <button onClick={handleCopyReport} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                   <Copy size={12} /> Copy Text
                 </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-3 text-indigo-500 shadow-sm border border-slate-100">
                <FileText size={28} />
              </div>
              <h4 className="font-bold text-slate-700 mb-1">Create a Doctor's Report</h4>
              <p className="text-sm text-slate-500 max-w-xs mx-auto">
                Generate a professional summary of your adherence, vitals, and wellbeing to share with your healthcare provider.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Log Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-50 font-bold text-slate-700 flex justify-between items-center">
          <span>Activity Log</span>
          <span className="text-xs text-slate-400 font-medium bg-slate-50 px-2 py-1 rounded">Last 30 Days</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 uppercase bg-slate-50/50">
              <tr>
                <th className="px-6 py-3 font-bold">Date & Time</th>
                <th className="px-6 py-3 font-bold">Medication</th>
                <th className="px-6 py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-400 italic">
                    No logs recorded yet.
                  </td>
                </tr>
              ) : (
                logs.slice().reverse().slice(0, 30).map(log => {
                  const med = medications.find(m => m.id === log.medicationId);
                  return (
                    <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-slate-600">
                        <div className="flex flex-col">
                           <span className="font-medium">{log.dateStr}</span>
                           <span className="text-xs text-slate-400">{log.scheduledTime || format(new Date(log.timestamp), 'h:mm a')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800">
                        {med?.name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                          log.status === 'TAKEN' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {log.status === 'TAKEN' ? <CheckCircle2 size={12} /> : <Activity size={12} />}
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HistoryView;
