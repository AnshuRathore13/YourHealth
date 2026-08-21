import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export const generatePreVisitSummary = async (symptoms: string) => {
  if (!apiKey || apiKey === "placeholder") {
    // Graceful handling of LLM failure / Missing API key
    return {
      urgencyLevel: "Medium",
      preVisitSummary: "LLM API Key missing. Patient reported: " + symptoms
    };
  }
  
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
    const prompt = `Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Format as JSON with keys: urgencyLevel (string), summary (a single formatted string containing the chief complaint and the questions). Symptoms: ${symptoms}`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    try {
      // Basic extraction if it returns markdown json
      const jsonStr = text.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(jsonStr);
      return {
        urgencyLevel: parsed.urgencyLevel || "Medium",
        preVisitSummary: typeof parsed.summary === 'string' ? parsed.summary : (JSON.stringify(parsed.summary, null, 2) || text)
      };
    } catch (e) {
      return {
        urgencyLevel: "Medium",
        preVisitSummary: text
      };
    }
  } catch (error) {
    console.error("Gemini API error:", error);
    return {
      urgencyLevel: "Medium",
      preVisitSummary: "Failed to generate AI summary. Symptoms: " + symptoms
    };
  }
};

export const generatePostVisitSummary = async (notes: string) => {
  if (!apiKey || apiKey === "placeholder") {
    return "LLM API Key missing. Clinical notes: " + notes;
  }
  
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
    const prompt = `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: ${notes}`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini API error:", error);
    return "Failed to generate AI summary from notes: " + notes;
  }
};
