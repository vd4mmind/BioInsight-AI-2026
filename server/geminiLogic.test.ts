import { describe, it, expect } from 'vitest';
import { parseJSON, getTokenOverlapScore, parseDateFallback, mapToDiseaseTopic } from './geminiLogic';
import { DiseaseTopic } from '../types';

describe('parseJSON', () => {
    it('parses a fenced code block correctly', () => {
        const text = 'Some intro text\n```json\n[{"title": "Test"}]\n```\nSome outro text';
        expect(parseJSON(text)).toEqual([{ title: 'Test' }]);
    });

    it('parses fallback brackets with bracketed confidence interval in text', () => {
        const text = 'No code block here. Here is the data: [{"title": "Test", "highlight": "CI [1.2, 3.4]"}] and some end text.';
        expect(parseJSON(text)).toEqual([{ title: 'Test', highlight: 'CI [1.2, 3.4]' }]);
    });

    it('returns null on invalid JSON', () => {
        const text = 'This is just some text with no JSON.';
        expect(parseJSON(text)).toBeNull();
    });
});

describe('getTokenOverlapScore', () => {
    it('returns overlap score for paraphrased titles', () => {
        const aiTitle = "A novel approach to treating diabetes with GLP-1";
        const targetText = "Novel GLP-1 treatments for Type 2 Diabetes";
        const score = getTokenOverlapScore(aiTitle, targetText);
        expect(score).toBeGreaterThanOrEqual(0.5);
    });

    it('returns 0 for completely different titles', () => {
        const score = getTokenOverlapScore("Machine learning in oncology", "Cardiovascular outcomes of SGLT2 inhibitors");
        expect(score).toBe(0);
    });
});

describe('parseDateFallback', () => {
    it('parses a valid date', () => {
        const date = parseDateFallback('2025-05-15');
        expect(date.getFullYear()).toBe(2025);
        expect(date.getMonth()).toBe(4); // 0-indexed
        expect(date.getDate()).toBe(15);
    });

    it('falls back to current date for invalid date', () => {
        const invalidDateStr = 'Not a date';
        const date = parseDateFallback(invalidDateStr);
        const now = new Date();
        expect(date.getFullYear()).toBe(now.getFullYear());
        expect(date.getMonth()).toBe(now.getMonth());
    });

    it('falls back to current date for empty string', () => {
        const date = parseDateFallback('');
        const now = new Date();
        expect(date.getFullYear()).toBe(now.getFullYear());
        expect(date.getMonth()).toBe(now.getMonth());
    });
});

describe('mapToDiseaseTopic', () => {
    it('maps NASH/MASH/MASLD synonyms correctly', () => {
        expect(mapToDiseaseTopic('NASH', '')).toBe(DiseaseTopic.MASH);
        expect(mapToDiseaseTopic('masld', 'study')).toBe(DiseaseTopic.MASH);
        expect(mapToDiseaseTopic('', 'liver disease')).toBe(DiseaseTopic.MASH);
    });

    it('maps obesity/weight', () => {
        expect(mapToDiseaseTopic('weight loss', '')).toBe(DiseaseTopic.Obesity);
    });
});
