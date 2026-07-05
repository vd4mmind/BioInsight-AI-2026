import { GoogleGenAI } from "@google/genai";
import { PaperData, DiseaseTopic, Methodology, StudyType, ResearchModality, PublicationType, CacheEntry, SwarmError, SwarmResult } from "../types";
import crypto from 'crypto';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// --- CACHE CONFIGURATION ---
const CACHE_KEY_PREFIX = 'bioinsight_cache_v3_';
const CACHE_TTL_LIVE = 15 * 60 * 1000; 
const CACHE_TTL_AI = 24 * 60 * 60 * 1000;
const CACHE_TTL_PATENT = 7 * 24 * 60 * 60 * 1000;

const memoryCache = new Map<string, string>();

const TOPIC_EXPANSION: Record<string, string> = {
    'MASH / NASH': '("MASH" OR "NASH" OR "MASLD" OR "Steatohepatitis" OR "FIB-4")',
    'Obesity': '("Obesity" OR "Weight Loss" OR "Semaglutide" OR "Tirzepatide" OR "GLP-1" OR "Incretin")',
    'Diabetes': '("Diabetes" OR "Type 2" OR "T2D" OR "HbA1c" OR "SGLT2")',
    'CVD': '("Cardiovascular" OR "Heart Failure" OR "Atherosclerosis" OR "MACE")',
    'CKD': '("Chronic Kidney Disease" OR "CKD" OR "Renal Failure" OR "eGFR")'
};

// Swarm Definitions
const SWARM_A_SITES = "site:nature.com OR site:nejm.org OR site:thelancet.com OR site:jamanetwork.com OR site:science.org OR site:cell.com OR site:diabetesjournals.org OR site:ahajournals.org";
const SWARM_B_SITES = "site:academic.oup.com OR site:onlinelibrary.wiley.com OR site:sciencedirect.com OR site:link.springer.com OR site:pubmed.ncbi.nlm.nih.gov";
const REGISTRY_SITES = "site:veradigm.com OR site:trinetx.com OR site:truveta.com OR site:optum.com OR site:cprd.com";

const getCacheKey = (type: string, topics: string[]): string => {
    const sorted = [...topics].sort().join('_');
    return `${CACHE_KEY_PREFIX}${type}_${sorted}`;
};

const checkCache = (type: 'live' | 'ai' | 'patent', topics: string[]): PaperData[] | null => {
    try {
        const key = getCacheKey(type, topics);
        const stored = memoryCache.get(key);
        if (!stored) return null;
        const entry: CacheEntry = JSON.parse(stored);
        const now = Date.now();
        let ttl = type === 'live' ? CACHE_TTL_LIVE : (type === 'ai' ? CACHE_TTL_AI : CACHE_TTL_PATENT);
        if (now - entry.timestamp < ttl) return entry.papers;
        memoryCache.delete(key);
        return null;
    } catch (e) { return null; }
};

const saveCache = (type: 'live' | 'ai' | 'patent', topics: string[], papers: PaperData[]) => {
    try {
        const key = getCacheKey(type, topics);
        const entry: CacheEntry = { timestamp: Date.now(), papers: papers };
        memoryCache.set(key, JSON.stringify(entry));
    } catch (e) {}
};

export const parseDateFallback = (dateInput: string | undefined | null): Date => {
    if (!dateInput) return new Date();
    let parsedDate = new Date(dateInput);
    if (isNaN(parsedDate.getTime())) {
        parsedDate = new Date();
    }
    return parsedDate;
};

export const parseJSON = (text: string): any[] | null => {
    try {
        const jsonBlockRegex = /```(?:json)?\n([\s\S]*?)\n```/;
        const match = text.match(jsonBlockRegex);
        if (match) return JSON.parse(match[1]);
        
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        if (start !== -1 && end !== -1) {
            try {
                return JSON.parse(text.substring(start, end + 1));
            } catch (e) {
                const startObj = text.indexOf('[{');
                const endObj = text.lastIndexOf('}]');
                if (startObj !== -1 && endObj !== -1) {
                    try {
                        return JSON.parse(text.substring(startObj, endObj + 2));
                    } catch (e2) {}
                }
            }
        }
        return JSON.parse(text);
    } catch (e) {
        return null;
    }
};

const DEBUG = false;

export const getTokenOverlapScore = (aiTitle: string, targetText: string): number => {
    if (!aiTitle || !targetText) return 0;
    const tokenize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    const aiTokens = tokenize(aiTitle);
    if (aiTokens.length === 0) return 0;
    const targetTokens = tokenize(targetText);
    const matches = aiTokens.filter(token => targetTokens.some(tt => tt.includes(token)));
    return matches.length / aiTokens.length;
};

const getDomain = (url: string) => {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return '';
    }
};

export const mapToDiseaseTopic = (input: string, title: string): DiseaseTopic => {
    const combined = (input + " " + title).toUpperCase();
    if (combined.includes('NASH') || combined.includes('MASH') || combined.includes('MASLD') || combined.includes('LIVER') || combined.includes('STEATO')) return DiseaseTopic.MASH;
    if (combined.includes('OBESITY') || combined.includes('WEIGHT')) return DiseaseTopic.Obesity;
    if (combined.includes('DIABETES') || combined.includes('T2D') || combined.includes('GLYCAEMIC')) return DiseaseTopic.Diabetes;
    if (combined.includes('CKD') || combined.includes('KIDNEY') || combined.includes('RENAL') || combined.includes('EGFR')) return DiseaseTopic.CKD;
    return DiseaseTopic.CVD;
};

const runSwarmPulse = async (swarmName: string, query: string, instruction: string, feedType: string): Promise<SwarmResult> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Role: ${swarmName}. Search Query: \`${query}\`. Instruction: ${instruction}. 
            REQUIRED JSON Structure: [{url, title, date, journal, authors, topic, pubType, studyType, methodology, modality, highlight, target, context}]. 
            ANCHORS: Ensure items have scientific evidence (p-values, HR, OR, or CI).
            Respond with ONLY a single \`\`\`json fenced code block containing the array — no other text before or after it.`,
            config: { temperature: 0.1, tools: [{ googleSearch: {} }] }
        });

        const aiJson = parseJSON(response?.text || "");
        if (aiJson === null) return { papers: [], error: 'parse' };
        // @ts-ignore
        const groundingChunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        if (aiJson.length === 0) return { papers: [], error: null };

        const pulseResults: PaperData[] = [];
        for (const item of aiJson) {
            let matchedChunk = null;
            let matchedViaUrl = false;
            let bestChunk = null;
            let bestOverlap = -1;
            const itemDomain = getDomain(item.url || "");

            for (const c of groundingChunks) {
                if (!c.web?.uri) continue;
                if (item.url === c.web.uri) {
                    matchedChunk = c;
                    matchedViaUrl = true;
                    break;
                }
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
                if (itemDomain && chunkDomain && itemDomain === chunkDomain && overlap >= 0.15) {
                    matchedChunk = c;
                    break;
                }
            }

            if (!matchedChunk) {
                if (DEBUG) {
                    console.debug(`Dropped item: "${item.title}"`);
                    if (bestChunk) {
                        console.debug(`  Closest chunk: "${bestChunk.web?.title}" (overlap: ${bestOverlap.toFixed(2)})`);
                    } else {
                        console.debug(`  No chunks available.`);
                    }
                }
                continue;
            }

            let parsedDate = parseDateFallback(item.date);

            const pubType = item.pubType as PublicationType || PublicationType.PeerReviewed;
            let computedScore = 70;
            if (pubType === PublicationType.PeerReviewed || pubType === PublicationType.MetaAnalysis) computedScore = 90;
            else if (pubType === PublicationType.ReviewArticle) computedScore = 80;
            else if (pubType === PublicationType.Preprint) computedScore = 70;
            else if (pubType === PublicationType.ConferenceAbstract || pubType === PublicationType.Poster || pubType === PublicationType.Patent) computedScore = 60;
            
            if (matchedViaUrl) computedScore += 10;
            
            const prestigeDomains = ['nature.com', 'science.org', 'nejm.org', 'thelancet.com', 'jamanetwork.com', 'cell.com', 'ahajournals.org', 'diabetesjournals.org'];
            if (prestigeDomains.some(d => matchedChunk.web.uri.includes(d))) {
                computedScore += 5;
            }
            if (computedScore > 100) computedScore = 100;

            const urlForId = matchedChunk.web.uri;
            const stableId = `${feedType}-${crypto.createHash('md5').update(urlForId).digest('hex').substring(0, 12)}`;

            pulseResults.push({
                id: stableId,
                title: item.title,
                url: matchedChunk.web.uri,
                journalOrConference: item.journal || new URL(matchedChunk.web.uri).hostname.replace('www.', ''),
                date: parsedDate.toISOString().split('T')[0],
                authors: Array.isArray(item.authors) ? item.authors : [item.authors || "Staff Research"],
                topic: mapToDiseaseTopic(item.topic || "", item.title),
                publicationType: pubType,
                studyType: item.studyType as StudyType || StudyType.HumanCohort,
                methodology: item.methodology as Methodology || Methodology.Statistical,
                modality: item.modality as ResearchModality || ResearchModality.ClinicalData,
                abstractHighlight: item.highlight || "Summary not available.",
                drugAndTarget: item.target || "N/A",
                context: item.context || "Swarm Intelligence Retrieval",
                validationScore: computedScore,
                isLive: true
            });
        }
        return { papers: pulseResults, error: null };
    } catch (e: any) {
        console.error("runSwarmPulse Error:", e);
        let errorType: SwarmError = 'network';
        const status = e?.status || e?.response?.status;
        const msg = e?.message || "";
        if (status === 401 || status === 403 || msg.includes('API key not valid') || msg.includes('API_KEY_INVALID') || msg.includes('403')) {
            errorType = 'auth';
        } else if (status === 429 || msg.includes('429') || msg.includes('Quota exceeded')) {
            errorType = 'rate_limit';
        }
        return { papers: [], error: errorType };
    }
};

export async function* fetchLiteratureAnalysisStream(activeTopics: string[]): AsyncGenerator<SwarmResult, void, unknown> {
    const cachedData = checkCache('live', activeTopics);
    if (cachedData) { yield { papers: cachedData, error: null }; return; }

    const SITE_GROUPS = [
        "site:nature.com OR site:nejm.org OR site:thelancet.com",
        "site:jamanetwork.com OR site:science.org OR site:cell.com",
        "site:diabetesjournals.org OR site:ahajournals.org",
        "site:academic.oup.com OR site:onlinelibrary.wiley.com OR site:sciencedirect.com",
        "site:link.springer.com OR site:pubmed.ncbi.nlm.nih.gov"
    ];

    const promises: Promise<SwarmResult>[] = [];

    for (const topic of activeTopics) {
        const topicExpansion = TOPIC_EXPANSION[topic] || `"${topic}"`;
        
        for (const siteGroup of SITE_GROUPS) {
            const query = `(${siteGroup}) (${topicExpansion}) after:2025-11-01`;
            promises.push(runSwarmPulse(
                "Literature Swarm", 
                query, 
                `Find recent scientific breakthroughs for ${topic}. Extract structured JSON.`, 
                'live'
            ));
        }
    }

    let anyError: SwarmError = null;
    const seenUrls = new Set<string>();
    let allCombined: PaperData[] = [];

    const pending = new Set(promises.map(p => p.catch(error => ({ papers: [], error }) as SwarmResult).then(res => ({ p, res }))));

    while (pending.size > 0) {
        const winner = await Promise.race(Array.from(pending));
        pending.delete(winner.p);

        const res = winner.res;
        if (res.error) anyError = res.error as SwarmError;
        
        let batch: PaperData[] = [];
        for (const paper of res.papers) {
            if (!seenUrls.has(paper.url)) {
                seenUrls.add(paper.url);
                batch.push(paper);
                allCombined.push(paper);
            }
        }
        
        if (batch.length > 0) {
            batch.sort((a, b) => (b.validationScore || 0) - (a.validationScore || 0));
            yield { papers: batch, error: null };
        }
    }

    if (allCombined.length > 0) {
        allCombined.sort((a, b) => (b.validationScore || 0) - (a.validationScore || 0));
        saveCache('live', activeTopics, allCombined);
    } else if (anyError) {
        yield { papers: [], error: anyError };
    } else {
        yield { papers: [], error: null };
    }
}

export async function* fetchAiAnalysisStream(activeTopics: string[]): AsyncGenerator<SwarmResult, void, unknown> {
    const topicStr = activeTopics.map(t => TOPIC_EXPANSION[t] || `"${t}"`).join(' OR ');
    
    // AI Pulse: Combined Scientific AI + Registry Insights
    const aiQuery = `(${topicStr}) AND ("Machine Learning" OR "Real-World Evidence" OR "Registry Analysis") AND (${SWARM_B_SITES} OR ${REGISTRY_SITES}) after:2025-10-01`;
    const aiResults = await runSwarmPulse(
        "AI/RWE Specialist", 
        aiQuery, 
        "Focus on AI/ML models in CVD/Metabolic and RWE from registries like Veradigm/Truveta. EXCLUDE company news without data.", 
        'ai'
    );
    yield aiResults;
}

export async function* fetchPatentStream(activeTopics: string[]): AsyncGenerator<SwarmResult, void, unknown> {
    const topicStr = activeTopics.map(t => TOPIC_EXPANSION[t] || `"${t}"`).join(' OR ');
    const query = `(site:patents.google.com) ${topicStr} after:2025-01-01`;
    const patentResults = await runSwarmPulse(
        "Patent Scout", 
        query, 
        "Find the latest IP filings for metabolic and cardiovascular therapies. Include historical synonyms for MASH/NASH.", 
        'patent'
    );
    yield patentResults;
}

export const runLinkPolisher = async (paper: PaperData) => null;
