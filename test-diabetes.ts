import { fetchLiteratureAnalysisStream } from "./server/geminiLogic";
import fs from "fs";

try {
    const envFile = fs.readFileSync('.env', 'utf8');
    envFile.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
            process.env[key] = value;
        }
    });
} catch (e) {}

import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const parseJSON = (text: string): any[] | null => {
    if (!text) return null;
    try {
        const startList = text.indexOf('[');
        const endList = text.lastIndexOf(']');
        if (startList !== -1 && endList !== -1) {
            try {
                return JSON.parse(text.substring(startList, endList + 1));
            } catch (e) {
            }
        }
        return JSON.parse(text);
    } catch (e) {
        return null;
    }
};

const getDomain = (url: string) => {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return '';
    }
};

const getTokenOverlapScore = (aiTitle: string, targetText: string): number => {
    if (!aiTitle || !targetText) return 0;
    const tokenize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    const aiTokens = tokenize(aiTitle);
    if (aiTokens.length === 0) return 0;
    const targetTokens = tokenize(targetText);
    const matches = aiTokens.filter(token => targetTokens.some(tt => tt.includes(token)));
    return matches.length / aiTokens.length;
};

async function main() {
    console.log("=== Testing URL Domains ===");
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Role: Medical Researcher. Search Query: \`Diabetes\`. Instruction: Find the latest papers.
            REQUIRED JSON Structure: [{url, title, date, journal, authors, topic, pubType, studyType, methodology, modality, highlight, target, context}].
            Respond with ONLY a single \`\`\`json fenced code block containing the array — no other text before or after it.`,
            config: { temperature: 0.1, tools: [{ googleSearch: {} }] }
        });

        const text = response?.text || "";
        const groundingChunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const aiJson = parseJSON(text) || [];
        
        console.log(`[Diagnostic] aiJson.length: ${aiJson.length}`);
        console.log(`[Diagnostic] groundingChunks.length: ${groundingChunks.length}`);

        let matchedCount = 0;

        for (const item of aiJson) {
            console.log(`\nItem Title: ${item.title}`);
            console.log(`Item Domain: ${getDomain(item.url)}`);
            let matchedChunk = null;
            let itemDomain = getDomain(item.url);
            let bestChunk = null;
            let bestOverlap = -1;

            for (const c of groundingChunks) {
                if (!c.web?.uri) continue;
                const overlap = getTokenOverlapScore(item.title, c.web.title);
                if (overlap > bestOverlap) {
                    bestOverlap = overlap;
                    bestChunk = c;
                }
                if (overlap >= 0.25) {
                    matchedChunk = c;
                    break;
                }
                const chunkDomain = getDomain(c.web.uri);
                if (itemDomain && chunkDomain && itemDomain === chunkDomain && !chunkDomain.includes('google.com')) {
                    matchedChunk = c;
                    break;
                }
            }
            if (matchedChunk) {
                 console.log("MATCHED");
                 matchedCount++;
            } else {
                 console.log("DROPPED");
            }
            console.log(`  Best chunk: "${bestChunk?.web?.title}"`);
            console.log(`  Overlap score: ${bestOverlap.toFixed(2)}`);
        }
        console.log(`\nTotal matched: ${matchedCount}`);
    } catch(e: any) {
        console.log("Error:", e.message);
    }
}
main();
