/**
 * Cross Country Result Types
 */

/**
 * Race categories based on age group and gender
 */
export type AgeGroup = '34' | '56' | '78';
export type Gender = 'Male' | 'Female';

/**
 * Race metadata
 */
export interface RaceInfo {
  ageGroup: AgeGroup;
  gender: Gender;
  distance: string;
  displayName: string;
}

/**
 * Map of race identifiers to metadata
 */
export const RACE_INFO: Record<string, RaceInfo> = {
  '34girls': {
    ageGroup: '34',
    gender: 'Female',
    distance: '1000m',
    displayName: '3rd & 4th Grade Girls (1000m)'
  },
  '34boys': {
    ageGroup: '34',
    gender: 'Male',
    distance: '1000m',
    displayName: '3rd & 4th Grade Boys (1000m)'
  },
  '56girls': {
    ageGroup: '56',
    gender: 'Female',
    distance: '1 mile',
    displayName: '5th & 6th Grade Girls (1 mile)'
  },
  '56boys': {
    ageGroup: '56',
    gender: 'Male',
    distance: '1 mile',
    displayName: '5th & 6th Grade Boys (1 mile)'
  },
  '78girls': {
    ageGroup: '78',
    gender: 'Female',
    distance: '1.5 mile',
    displayName: '7th & 8th Grade Girls (1.5 mile)'
  },
  '78boys': {
    ageGroup: '78',
    gender: 'Male',
    distance: '1.5 mile',
    displayName: '7th & 8th Grade Boys (1.5 mile)'
  }
};

/**
 * Raw result parsed from CSV file
 */
export interface XCResult {
  place: number | null;
  athlete: string;
  grade: string;
  team: string;
  score: number | null;  // null if "--" (non-scoring)
  time: string;
  gap: string;
  avgMile: string;
  raceIdentifier: string;  // e.g., "56girls"
  meetDate: string;
}

/**
 * Individual race result (for team results output)
 */
export interface XCRaceResult {
  place: number | null;
  athlete: string;
  grade: string;
  score: number | null;
  time: string;
  gap: string;
  avgMile: string;
  scoring?: boolean;  // true if runner contributed to team score
}

/**
 * Team scoring configuration
 */
export interface ScoringConfig {
  includeScoring: boolean;
  scoringPlaces: number;      // e.g., 5 (top 5 score)
  displacementRunners: number; // e.g., 2 (6th and 7th displace)
}

/**
 * Race data within team result
 */
export interface XCRaceData {
  race: string;           // Display name
  ageGroup: AgeGroup;
  gender: Gender;
  distance: string;
  teamScore?: number;     // Total score (sum of scoring places)
  teamPlace?: number;     // Team's placement in this race
  results: XCRaceResult[];
}

/**
 * Per-meet team result (one file per team per meet)
 */
export interface XCTeamResult {
  teamName: string;
  meetName: string;
  meetDate: string;
  season: string;
  teamScoreIncluded: boolean;
  scoringPlaces?: number;
  displacementRunners?: number;
  races: XCRaceData[];
}

/**
 * Single performance entry in rankings
 */
export interface XCPerformance {
  time: string;
  timeSeconds: number;
  avgMile: string;
  place: number | null;
  meetName: string;
  meetDate: string;
}

/**
 * Ranking entry for event rankings
 */
export interface XCRankingEntry {
  rank: number;
  athlete: string;
  grade: string;
  team: string;
  bestTime: string;
  bestTimeSeconds: number;
  bestAvgMile: string;
  bestTimeMeet: string;
  bestTimeMeetDate: string;
  performances: XCPerformance[];  // All performances, sorted by time
}

/**
 * Event rankings file (one per age group/gender)
 */
export interface XCEventRankings {
  season: string;
  race: string;           // Display name
  ageGroup: AgeGroup;
  gender: Gender;
  distance: string;
  generatedDate: string;
  rankings: XCRankingEntry[];
}

/**
 * Meet result for season results
 */
export interface XCSeasonMeetResult {
  meetName: string;
  meetDate: string;
  results: XCRaceResult[];  // Just the runners from this team
}

/**
 * Race data for season results
 */
export interface XCSeasonRaceData {
  race: string;
  ageGroup: AgeGroup;
  gender: Gender;
  distance: string;
  meets: XCSeasonMeetResult[];
}

/**
 * Season-long team results (one file per team)
 */
export interface XCSeasonResult {
  teamName: string;
  season: string;
  races: XCSeasonRaceData[];
}
