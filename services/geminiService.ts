import { GoogleGenAI, Type, Schema, Chat } from "@google/genai";
import { FrequencyType, ParsedMedicationSchedule, DrugInfo, InteractionAnalysis, LogEntry, VitalEntry, MoodEntry, Medication, PharmacySearchResponse, PlaceResult, ConditionAdvice } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Schema for parsing natural language medication schedules
const scheduleSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Name of the medicine" },
    dosage: { type: Type.STRING, description: "Dosage amount e.g. 500mg, 1 pill" },
    frequency: { 
      type: Type.STRING, 
      enum: [FrequencyType.DAILY, FrequencyType.WEEKLY, FrequencyType.AS_NEEDED],
      description: "How often the medicine should be taken"
    },
    times: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Array of times in HH:MM 24h format. If user says 'morning', assume 08:00. If 'night', assume 20:00."
    },
    daysOfWeek: {
      type: Type.ARRAY,
      items: { type: Type.INTEGER },
      description: "Array of integers 0-6 (Sun-Sat) if frequency is WEEKLY."
    },
    notes: { type: Type.STRING, description: "Any special instructions like 'with food'" },
    currentStock: { type: Type.INTEGER, description: "Total quantity of pills/units the user currently has, if mentioned." }
  },
  required: ["name", "frequency", "times"],
};

export const parseMedicationInput = async (input: string): Promise<ParsedMedicationSchedule | null> => {
  if (!apiKey) {
    console.error("API Key missing");
    return null;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Parse this medication reminder request into a structured schedule: "${input}". 
      If the user does not specify a time, infer logical default times (e.g. morning=08:00, noon=12:00, evening=18:00, night=21:00). 
      If no frequency is mentioned but times are, assume DAILY.
      If the user mentions having a supply (e.g. "I have 30 pills" or "bottle of 60"), extract that number to currentStock.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: scheduleSchema,
      },
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as ParsedMedicationSchedule;
  } catch (error) {
    console.error("Error parsing medication:", error);
    return null;
  }
};

export const parseMedicationAudio = async (base64Audio: string, mimeType: string): Promise<ParsedMedicationSchedule | null> => {
  if (!apiKey) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio
            }
          },
          {
            text: `Listen to this audio. Parse this medication reminder request into a structured schedule. 
      If the user does not specify a time, infer logical default times (e.g. morning=08:00, noon=12:00, evening=18:00, night=21:00). 
      If no frequency is mentioned but times are, assume DAILY.
      If the user mentions having a supply, extract that number to currentStock.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: scheduleSchema,
      },
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as ParsedMedicationSchedule;
  } catch (error) {
    console.error("Error parsing medication audio:", error);
    return null;
  }
};

const pillIdSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Identified name of the medication from the label or visual appearance." },
    dosage: { type: Type.STRING, description: "Dosage strength found on the pill or label (e.g., 200mg)." },
    confidence: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"], description: "Confidence level of identification." }
  },
  required: ["name", "confidence"]
};

export const identifyPillFromImage = async (base64Image: string): Promise<{name: string, dosage?: string, confidence?: string} | null> => {
  if (!apiKey) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          },
          {
            text: "Analyze this image. If it is a pill bottle label, extract the medication name and dosage. If it is a loose pill, try to identify it based on shape, color, and imprint. Return structured JSON."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: pillIdSchema
      }
    });

    const text = response.text;
    if (!text) return null;
    const result = JSON.parse(text);
    return { name: result.name, dosage: result.dosage, confidence: result.confidence };
  } catch (error) {
    console.error("Error identifying pill:", error);
    return null;
  }
};

const drugInfoSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    description: { type: Type.STRING, description: "A brief, easy to understand description of what the drug does." },
    sideEffects: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Top 3 common side effects." 
    },
    tips: { type: Type.STRING, description: "One important tip (e.g., take with food, avoid alcohol)." }
  },
  required: ["description", "sideEffects", "tips"]
};

export const getDrugInfo = async (medName: string): Promise<DrugInfo | null> => {
  if (!apiKey) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Provide a very brief summary for the medication: ${medName}. Keep it simple for a patient.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: drugInfoSchema
      }
    });
    
    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as DrugInfo;
  } catch (error) {
    console.error("Error fetching drug info:", error);
    return null;
  }
};

const interactionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    interactions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          medication1: { type: Type.STRING },
          medication2: { type: Type.STRING },
          severity: { type: Type.STRING, enum: ['HIGH', 'MODERATE', 'LOW'] },
          description: { type: Type.STRING, description: "Brief explanation of the interaction." }
        },
        required: ["medication1", "medication2", "severity", "description"]
      }
    },
    summary: { type: Type.STRING, description: "Overall safety summary." },
    safeToTake: { type: Type.BOOLEAN, description: "True if no high severity interactions exist." }
  },
  required: ["interactions", "summary", "safeToTake"]
};

export const checkInteractions = async (medNames: string[]): Promise<InteractionAnalysis | null> => {
  if (!apiKey || medNames.length < 2) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze the following list of medications for potential drug-drug interactions: ${medNames.join(', ')}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: interactionSchema
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as InteractionAnalysis;
  } catch (error) {
    console.error("Error checking interactions:", error);
    return null;
  }
};

export const createMedicalChat = (medications: string[]): Chat => {
  const medList = medications.length > 0 ? medications.join(', ') : "None recorded";
  
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: `You are MediMind, an intelligent and empathetic medical assistant.
      The user is currently managing the following medications: ${medList}.
      
      Your goal is to answer health-related questions, explain medication side effects, interactions, and provide general wellness tips.
      
      IMPORTANT:
      1. Always prioritize patient safety.
      2. If a user describes severe symptoms (chest pain, difficulty breathing, etc.), immediately advise them to seek emergency medical help.
      3. Do not diagnose conditions.
      4. Keep answers concise, easy to read, and friendly.
      5. Use Markdown for formatting.`,
    },
  });
};

export const generateHealthReport = async (
  medications: Medication[], 
  logs: LogEntry[], 
  vitals: VitalEntry[], 
  moods: MoodEntry[]
): Promise<string | null> => {
  if (!apiKey) return null;

  // Prepare data summary for the prompt
  const medSummary = medications.map(m => `${m.name} (${m.dosage}) - ${m.frequency}`).join(', ');
  
  // Calculate simplistic adherence for context
  const takenCount = logs.filter(l => l.status === 'TAKEN').length;
  const skippedCount = logs.filter(l => l.status === 'SKIPPED').length;
  const totalLogs = logs.length;
  const adherence = totalLogs > 0 ? Math.round((takenCount / totalLogs) * 100) : 0;

  // Recent vitals (last 10)
  const recentVitals = vitals.slice(-10).map(v => `${v.type}: ${v.value} ${v.unit} (${v.dateStr})`).join('; ');
  
  // Recent moods
  const recentMoods = moods.slice(-10).map(m => `${m.type} (${m.dateStr})`).join('; ');

  const prompt = `
    Act as a professional medical assistant generating a health status report for a doctor.
    
    Patient Data:
    - Current Medications: ${medSummary}
    - Adherence Rate: ${adherence}% (${takenCount} taken, ${skippedCount} skipped in recent logs)
    - Recent Vitals: ${recentVitals || 'None recorded'}
    - Recent Mood/Symptoms: ${recentMoods || 'None recorded'}

    Task:
    Write a structured, professional report in HTML format (NOT Markdown).
    The report should be clean, readable, and ready to print.
    
    Structure:
    1. <h2>Patient Summary</h2>: Brief overview of status and adherence.
    2. <h2>Medication Analysis</h2>: Comments on consistency and medication list.
    3. <h2>Vitals & Wellbeing</h2>: Analysis of recorded vitals/moods (if any).
    4. <h2>Recommendations</h2>: 2-3 General health tips or things to discuss with the doctor based on the data.
    
    Use <p> for paragraphs, <ul><li> for lists, and <strong> for emphasis.
    Do not use <html>, <head>, or <body> tags, just the content.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating report:", error);
    return "Unable to generate report at this time.";
  }
};

export const findNearbyPlaces = async (lat: number, lng: number, type: 'pharmacy' | 'hospital' = 'pharmacy'): Promise<PharmacySearchResponse | null> => {
  if (!apiKey) return null;

  const query = type === 'hospital' 
    ? "Find the nearest hospitals and clinics to my location." 
    : "Find the nearest pharmacies or medical stores to my location.";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${query} List them with their names and distance if available.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: lat,
              longitude: lng
            }
          }
        }
      }
    });

    const places: PlaceResult[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    // Extract grounding chunks which contain map data
    chunks.forEach((chunk: any) => {
      // Check for 'maps' specific key if the API returns it that way (standard for maps tool)
      if (chunk.maps && chunk.maps.uri) {
         places.push({
           title: chunk.maps.title || (type === 'hospital' ? 'Hospital Location' : 'Pharmacy Location'),
           uri: chunk.maps.uri
         });
      }
      // Fallback/Duplicate check for 'web' chunks that might contain map data
      else if (chunk.web && chunk.web.uri && !places.some(p => p.uri === chunk.web.uri)) {
        places.push({
          title: chunk.web.title || (type === 'hospital' ? 'Hospital' : 'Pharmacy'),
          uri: chunk.web.uri
        });
      }
    });

    return {
      text: response.text || "No details found.",
      places: places
    };

  } catch (error) {
    console.error("Error finding places:", error);
    return null;
  }
}

const conditionAdviceSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    condition: { type: Type.STRING, description: "The normalized name of the condition." },
    recommendedFoods: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "List of foods that are good for this condition." 
    },
    avoidFoods: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "List of foods to avoid." 
    },
    lifestyleTips: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "General lifestyle advice." 
    }
  },
  required: ["condition", "recommendedFoods", "avoidFoods", "lifestyleTips"]
};

export const getConditionAdvice = async (condition: string): Promise<ConditionAdvice | null> => {
  if (!apiKey) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Provide dietary and lifestyle advice for a patient with: ${condition}. 
      Return structured data with lists of recommended foods, foods to avoid, and general tips.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: conditionAdviceSchema
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as ConditionAdvice;
  } catch (error) {
    console.error("Error fetching advice:", error);
    return null;
  }
}