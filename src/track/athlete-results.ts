/**
 * Individual Athlete Results Generator
 */

import * as fs from 'fs';
import * as path from 'path';
import { RawResult, AthleteResults, EventResult, RelayResult } from '../common/types';

export class AthleteResultsGenerator {
    /**
     * Generate individual results for all athletes
     */
    static generateAthleteResults(allResults: RawResult[]): Map<string, AthleteResults> {
        const athleteMap = new Map<string, AthleteResults>();

        if (allResults.length === 0) {
            console.log('⚠ No results provided to generate athlete data');
            return athleteMap;
        }

        for (const result of allResults) {
            // Skip results with missing athlete names
            if (!result.firstName || !result.lastName) {
                continue;
            }

            const athleteKey = `${result.firstName}_${result.lastName}`;
            const fullName = `${result.firstName} ${result.lastName}`;

            // Initialize athlete if not exists
            if (!athleteMap.has(athleteKey)) {
                athleteMap.set(athleteKey, {
                    first_name: result.firstName,
                    last_name: result.lastName,
                    gender: result.athleteGender,
                    grade: result.grade,
                    school: result.teamName,
                    school_code: result.teamCode,
                    results: {}
                });
            }

            const athlete = athleteMap.get(athleteKey)!;

            // Initialize date if not exists
            if (!athlete.results[result.meetDate]) {
                athlete.results[result.meetDate] = {
                    results: []
                };
            }

            // Add event result
            const eventResult: EventResult = {
                id: result.eventId,
                event: result.eventAbbr,
                overall_place: result.overallPlace,
                heat: result.heat,
                place: result.place,
                result: result.result,
                meetName: result.meetName,
                meetDate: result.meetDate
            };

            athlete.results[result.meetDate].results.push(eventResult);
        }

        // Sort results within each date by event
        for (const athlete of athleteMap.values()) {
            for (const dateResults of Object.values(athlete.results)) {
                dateResults.results.sort((a, b) => a.event.localeCompare(b.event));
            }
        }

        if (athleteMap.size === 0) {
            console.log('⚠ No valid athlete records were generated from the results');
        }

        return athleteMap;
    }

    /**
     * Add relay participation to athlete results
     */
    static addRelayParticipation(
        athleteMap: Map<string, AthleteResults>,
        relayResults: RelayResult[]
    ): void {
        for (const relay of relayResults) {
            // Get teammates list for each athlete
            const teammates = relay.athletes.map(a => `${a.firstName} ${a.lastName}`);

            // Add relay result to each participating athlete
            for (const athlete of relay.athletes) {
                const athleteKey = `${athlete.firstName}_${athlete.lastName}`;

                // Initialize athlete if not exists
                if (!athleteMap.has(athleteKey)) {
                    athleteMap.set(athleteKey, {
                        first_name: athlete.firstName,
                        last_name: athlete.lastName,
                        gender: athlete.gender,
                        grade: athlete.grade,
                        school: relay.teamName,
                        school_code: relay.teamCode,
                        results: {}
                    });
                }

                const athleteData = athleteMap.get(athleteKey)!;

                // Initialize date if not exists
                if (!athleteData.results[relay.meetDate]) {
                    athleteData.results[relay.meetDate] = {
                        results: []
                    };
                }

                // Get other teammates (exclude current athlete)
                const otherTeammates = teammates.filter(name => name !== `${athlete.firstName} ${athlete.lastName}`);

                // Add relay event result
                const relayEventResult: EventResult = {
                    id: relay.eventId,
                    event: relay.eventAbbr,
                    overall_place: relay.overallPlace,
                    heat: relay.heat,
                    place: relay.place,
                    result: relay.result,
                    meetName: relay.meetName,
                    meetDate: relay.meetDate,
                    relay: {
                        teammates: otherTeammates
                    }
                };

                athleteData.results[relay.meetDate].results.push(relayEventResult);
            }
        }

        // Re-sort all results
        for (const athlete of athleteMap.values()) {
            for (const dateResults of Object.values(athlete.results)) {
                dateResults.results.sort((a, b) => a.event.localeCompare(b.event));
            }
        }
    }

    /**
     * Generate individual results including relay participation
     */
    static generateAthleteResultsWithRelays(
        allResults: RawResult[],
        relayResults: RelayResult[]
    ): Map<string, AthleteResults> {
        const athleteMap = this.generateAthleteResults(allResults);
        this.addRelayParticipation(athleteMap, relayResults);
        return athleteMap;
    }

    /**
     * Filter athletes by team (checks both team code and team name)
     */
    static filterByTeam(
        athleteMap: Map<string, AthleteResults>,
        teamIdentifier: string
    ): Map<string, AthleteResults> {
        const filtered = new Map<string, AthleteResults>();
        const uniqueSchools = new Map<string, string>(); // code -> name

        for (const [key, athlete] of athleteMap.entries()) {
            uniqueSchools.set(athlete.school_code, athlete.school);

            // Check if teamIdentifier matches either team code or team name
            const matchesCode = athlete.school_code.toLowerCase().includes(teamIdentifier.toLowerCase());
            const matchesName = athlete.school.toLowerCase().includes(teamIdentifier.toLowerCase());

            if (matchesCode || matchesName) {
                filtered.set(key, athlete);
            }
        }

        if (filtered.size === 0) {
            console.log(`\n⚠ No athletes found for team identifier: "${teamIdentifier}"`);
            console.log(`\nAvailable teams in the data:`);
            Array.from(uniqueSchools.entries())
                .sort((a, b) => a[1].localeCompare(b[1]))
                .forEach(([code, name]) => {
                    console.log(`  - ${code} - ${name}`);
                });
        }

        return filtered;
    }

    /**
     * Load existing athlete results from a single JSON file
     */
    static loadFromSingleFile(filePath: string): Map<string, AthleteResults> {
        const athleteMap = new Map<string, AthleteResults>();

        if (!fs.existsSync(filePath)) {
            return athleteMap;
        }

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content) as Record<string, AthleteResults>;

            for (const [key, athlete] of Object.entries(data)) {
                athleteMap.set(key, athlete);
            }

            console.log(`✓ Loaded ${athleteMap.size} existing athletes from ${filePath}`);
        } catch (error) {
            console.error(`Error loading existing athlete results: ${error}`);
        }

        return athleteMap;
    }

    /**
     * Load existing athlete results from individual files
     */
    static loadFromIndividualFiles(dirPath: string): Map<string, AthleteResults> {
        const athleteMap = new Map<string, AthleteResults>();

        if (!fs.existsSync(dirPath)) {
            return athleteMap;
        }

        try {
            const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));

            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const content = fs.readFileSync(filePath, 'utf-8');
                const athlete = JSON.parse(content) as AthleteResults;
                const key = file.replace('.json', '');
                athleteMap.set(key, athlete);
            }

            console.log(`✓ Loaded ${athleteMap.size} existing athletes from ${dirPath}`);
        } catch (error) {
            console.error(`Error loading existing athlete results: ${error}`);
        }

        return athleteMap;
    }

    /**
     * Merge two athlete maps (add new meets to existing athletes, add new athletes)
     */
    static mergeAthleteMaps(
        existing: Map<string, AthleteResults>,
        newResults: Map<string, AthleteResults>
    ): Map<string, AthleteResults> {
        const merged = new Map<string, AthleteResults>(existing);

        for (const [key, newAthlete] of newResults.entries()) {
            if (merged.has(key)) {
                // Athlete exists - merge their results by date
                const existingAthlete = merged.get(key)!;

                for (const [date, dateResults] of Object.entries(newAthlete.results)) {
                    if (existingAthlete.results[date]) {
                        // Date already exists - merge results arrays
                        existingAthlete.results[date].results.push(...dateResults.results);
                    } else {
                        // New date for this athlete
                        existingAthlete.results[date] = dateResults;
                    }
                }
            } else {
                // New athlete
                merged.set(key, newAthlete);
            }
        }

        return merged;
    }

    /**
     * Save all athletes to a single JSON file
     */
    static saveAllToSingleFile(
        athleteMap: Map<string, AthleteResults>,
        outputPath: string
    ): void {
        const output: Record<string, AthleteResults> = {};

        for (const [key, athlete] of athleteMap.entries()) {
            output[key] = athlete;
        }

        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
        console.log(`✓ Individual athlete results saved to ${outputPath}`);
        console.log(`  - Total athletes: ${athleteMap.size}`);
    }

    /**
     * Save each athlete to a separate JSON file
     */
    static saveToIndividualFiles(
        athleteMap: Map<string, AthleteResults>,
        outputDir: string
    ): void {
        if (athleteMap.size === 0) {
            console.log('⚠ No athletes to save - athleteMap is empty');
            return;
        }

        // Create output directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        let count = 0;
        for (const [key, athlete] of athleteMap.entries()) {
            const filename = `${key}.json`;
            const filepath = path.join(outputDir, filename);
            fs.writeFileSync(filepath, JSON.stringify(athlete, null, 2), 'utf-8');
            count++;
        }

        console.log(`✓ Individual athlete results saved to ${outputDir}`);
        console.log(`  - Total athletes: ${count}`);
        console.log(`  - Files created: ${count}`);
    }

    /**
     * Get statistics about athlete results
     */
    static getStats(athleteMap: Map<string, AthleteResults>): {
        totalAthletes: number;
        totalEvents: number;
        athletesByGrade: Record<string, number>;
        athletesByGender: Record<string, number>;
    } {
        const stats = {
            totalAthletes: athleteMap.size,
            totalEvents: 0,
            athletesByGrade: {} as Record<string, number>,
            athletesByGender: {} as Record<string, number>
        };

        for (const athlete of athleteMap.values()) {
            // Count events
            for (const dateResults of Object.values(athlete.results)) {
                stats.totalEvents += dateResults.results.length;
            }

            // Count by grade
            if (!stats.athletesByGrade[athlete.grade]) {
                stats.athletesByGrade[athlete.grade] = 0;
            }
            stats.athletesByGrade[athlete.grade]++;

            // Count by gender
            if (!stats.athletesByGender[athlete.gender]) {
                stats.athletesByGender[athlete.gender] = 0;
            }
            stats.athletesByGender[athlete.gender]++;
        }

        return stats;
    }

    /**
     * Print summary of athlete results
     */
    static printSummary(athleteMap: Map<string, AthleteResults>): void {
        const stats = this.getStats(athleteMap);

        console.log('\nAthlete Results Summary:');
        console.log(`  - Total Athletes: ${stats.totalAthletes}`);
        console.log(`  - Total Event Results: ${stats.totalEvents}`);
        console.log('\n  By Gender:');
        for (const [gender, count] of Object.entries(stats.athletesByGender)) {
            console.log(`    - ${gender}: ${count}`);
        }
        console.log('\n  By Grade:');
        for (const [grade, count] of Object.entries(stats.athletesByGrade)) {
            console.log(`    - ${grade}: ${count}`);
        }
    }
}
