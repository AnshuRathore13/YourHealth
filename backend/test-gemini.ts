import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();
const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
  try {
    const model = genAI.getGenerativeModel({ model: "antigravity-preview-05-2026" });
    const result = await model.generateContent("Say hello!");
    console.log("Success:", await result.response.text());
  } catch (e: any) {
    console.log("Error:", e.message);
  }
}

run();
