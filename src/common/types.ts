/**
 * Type definitions for Track & Field result processing
 */

export interface RawResult {
    recordType: string;          // 'H' for header, 'E' for event
    eventType: string;            // 'T' for track, 'F' for field
    eventId: string;              // Numeric event ID
    eventAbbr: string;            // Event abbreviation (e.g., '60', 'JT', 'LJ')
    gender: string;               // 'M' or 'F'
    category: string;             // Category number
    grade: string;                // e.g., '5th grade', '6th grade'
    resultMarker: string;         // 'M' for track, 'E' for field, or 'F'
    result: string;               // Time or distance/height
    overallPlace: number | null;  // Overall place in event
    place: number | null;         // Place in heat/flight
    heat: number | null;          // Heat or flight number
    lastName: string;
    firstName: string;
    athleteGender: string;        // 'M' or 'F'
    teamCode: string;             // Short team code
    teamName: string;             // Full team name
    athleteId: string;            // Unique athlete ID
    meetDate: string;             // Date of meet
    meetName: string;             // Name of meet
}

export interface Athlete {
    firstName: string;
    lastName: string;
    fullName: string;
    gender: string;
    grade: string;
    school: string;
    schoolCode: string;
    athleteId: string;
}

export interface EventResult {
    id: string;
    event: string;
    overall_place: number | null;
    heat: number | null;
    place: number | null;
    result: string;
    meetName?: string;
    meetDate?: string;
    relay?: {
        teammates: string[];  // Names of other relay members
    };
}

export interface AthleteResults {
    first_name: string;
    last_name: string;
    gender: string;
    grade: string;
    school: string;
    school_code: string;
    results: {
        [date: string]: {
            results: EventResult[];
        };
    };
}

export interface EventRanking {
    athlete: string;
    firstName: string;
    lastName: string;
    team: string;
    teamCode: string;
    bestResult: string;
    bestResultMeet: string;
    bestResultDate: string;
    allResults: Array<{
        result: string;
        meet: string;
        date: string;
        place: number | null;
    }>;
}

export interface EventCategory {
    event: string;
    gender: string;
    grade: string;
    rankings: EventRanking[];
}

export interface TeamResult {
    teamName: string;
    teamCode: string;
    meetName: string;
    meetDate: string;
    results: Array<{
        athlete: string;
        event: string;
        result: string;
        place: number | null;
        gender: string;
        grade: string;
    }>;
    relayResults?: Array<{
        event: string;
        result: string;
        place: number | null;
        gender: string;
        grade: string;
        athletes: string[];  // Names of relay members
    }>;
}

export interface MeetHeader {
    meetName: string;
    meetDate: string;
    software: string;
}

export interface RelayAthlete {
    lastName: string;
    firstName: string;
    gender: string;
    grade: string;
}

export interface RelayResult {
    recordType: 'R';
    teamName: string;
    teamCode: string;
    eventId: string;
    eventAbbr: string;
    gender: string;
    result: string;
    overallPlace: number | null;
    place: number | null;
    heat: number | null;
    athletes: RelayAthlete[];
    meetDate: string;
    meetName: string;
}

export interface RelayRanking {
    rank: number;
    teamName: string;
    teamCode: string;
    athletes: string[];  // Sorted list of athlete names
    athleteDetails: RelayAthlete[];  // Full athlete info
    bestResult: string;
    bestResultMeet: string;
    bestResultDate: string;
    allResults: Array<{
        result: string;
        meet: string;
        date: string;
        place: number | null;
        athletes: RelayAthlete[];
    }>;
}

export interface RelayCategory {
    event: string;
    eventAbbr: string;
    gender: string;
    grade: string;
    relayTeams: RelayRanking[];
}
