/**
 * Types for Team Entry Optimization
 */

export interface AthleteEntry {
    athlete: string;
    firstName: string;
    lastName: string;
    events: string[];  // Event abbreviations
    projectedPoints: number;
}

export interface EventEntry {
    event: string;
    eventName: string;
    athletes: Array<{
        athlete: string;
        projectedPlace: number;
        projectedPoints: number;
        currentRank: number;
    }>;
}

export interface OptimizationResult {
    school: string;
    gender: string;
    grade: string;
    totalProjectedPoints: number;
    athleteEntries: AthleteEntry[];
    eventBreakdown: EventEntry[];
}

export interface EventRankingData {
    eventAbbr: string;
    eventName: string;
    gender: string;
    grade: string;
    rankings: Array<{
        rank: number;
        athlete: string;
        team: string;
    }>;
}
