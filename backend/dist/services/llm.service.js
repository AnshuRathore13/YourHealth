"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePostVisitSummary = exports.generatePreVisitSummary = void 0;
const generative_ai_1 = require("@google/generative-ai");
const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
const generatePreVisitSummary = async (symptoms) => {
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
        }
        catch (e) {
            return {
                urgencyLevel: "Medium",
                preVisitSummary: text
            };
        }
    }
    catch (error) {
        console.error("Gemini API error:", error);
        return {
            urgencyLevel: "Medium",
            preVisitSummary: "Failed to generate AI summary. Symptoms: " + symptoms
        };
    }
};
exports.generatePreVisitSummary = generatePreVisitSummary;
const generatePostVisitSummary = async (notes) => {
    if (!apiKey || apiKey === "placeholder") {
        return JSON.stringify({
            summary: "LLM API Key missing. Clinical notes: " + notes,
            medication: null
        });
    }
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
        const prompt = `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps. You must return the output as a valid JSON object with two keys:
    - "summary": A formatted string containing the patient-friendly summary.
    - "medication": An object with "name" (tablet/medicine name), "dosage" (e.g. 500mg), "frequency" (e.g. Daily, Once daily), and "durationDays" (number, e.g. 1 if "one day", 5 if "for 5 days"). If no medication is prescribed, set it to null.
    
    Notes: ${notes}`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        try {
            const jsonStr = text.replace(/```json\n?|\n?```/g, "").trim();
            JSON.parse(jsonStr); // validate
            return jsonStr;
        }
        catch (e) {
            return JSON.stringify({ summary: text, medication: null });
        }
    }
    catch (error) {
        console.error("Gemini API error:", error);
        return JSON.stringify({
            summary: "Failed to generate AI summary from notes: " + notes,
            medication: null
        });
    }
};
exports.generatePostVisitSummary = generatePostVisitSummary;
