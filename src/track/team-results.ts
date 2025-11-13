/**
 * Team Results Extraction
 */

import * as fs from 'fs';
import { RawResult, TeamResult, RelayResult } from '../common/types';

export class TeamResultsExtractor {
    /**
     * Extract results for a specific team (including relay results)
     */
    static extractTeamResultsWithRelays(
        allResults: RawResult[],
        relayResults: RelayResult[],
        teamIdentifier: string
    ): TeamResult[] {
        // Group by meet
        const resultsByMeet = new Map<string, {
            individuals: RawResult[],
            relays: RelayResult[]
        }>();

        // Filter individual results for the specified team
        const teamResults = allResults.filter(result => {
            const teamMatch =
                result.teamCode.toLowerCase().includes(teamIdentifier.toLowerCase()) ||
                result.teamName.toLowerCase().includes(teamIdentifier.toLowerCase());
            return teamMatch;
        });

        // Filter relay results for the specified team
        const teamRelays = relayResults.filter(relay => {
            const teamMatch =
                relay.teamCode.toLowerCase().includes(teamIdentifier.toLowerCase()) ||
                relay.teamName.toLowerCase().includes(teamIdentifier.toLowerCase());
            return teamMatch;
        });

        // Group individuals by meet
        for (const result of teamResults) {
            const meetKey = `${result.meetDate}_${result.meetName}`;
            if (!resultsByMeet.has(meetKey)) {
                resultsByMeet.set(meetKey, { individuals: [], relays: [] });
            }
            resultsByMeet.get(meetKey)!.individuals.push(result);
        }

        // Group relays by meet
        for (const relay of teamRelays) {
            const meetKey = `${relay.meetDate}_${relay.meetName}`;
            if (!resultsByMeet.has(meetKey)) {
                resultsByMeet.set(meetKey, { individuals: [], relays: [] });
            }
            resultsByMeet.get(meetKey)!.relays.push(relay);
        }

        // Create team result objects
        const teamResultsList: TeamResult[] = [];

        for (const [meetKey, data] of resultsByMeet.entries()) {
            if (data.individuals.length === 0 && data.relays.length === 0) continue;

            // Get team info from first available result
            const firstResult = data.individuals[0] || data.relays[0];

            const teamResult: TeamResult = {
                teamName: firstResult.teamName,
                teamCode: firstResult.teamCode,
                meetName: firstResult.meetName,
                meetDate: firstResult.meetDate,
                results: data.individuals.map(r => ({
                    athlete: `${r.firstName} ${r.lastName}`,
                    event: r.eventAbbr,
                    result: r.result,
                    place: r.overallPlace,
                    gender: r.athleteGender,
                    grade: r.grade
                })).sort((a, b) => {
                    // Sort by grade, then event
                    if (a.grade !== b.grade) return a.grade.localeCompare(b.grade);
                    if (a.event !== b.event) return a.event.localeCompare(b.event);
                    return 0;
                }),
                relayResults: data.relays.map(r => ({
                    event: r.eventAbbr,
                    result: r.result,
                    place: r.overallPlace,
                    gender: r.gender,
                    grade: r.athletes[0]?.grade || '',  // Use first athlete's grade
                    athletes: r.athletes.map(a => `${a.firstName} ${a.lastName}`)
                })).sort((a, b) => {
                    // Sort by grade, then event
                    if (a.grade !== b.grade) return a.grade.localeCompare(b.grade);
                    if (a.event !== b.event) return a.event.localeCompare(b.event);
                    return 0;
                })
            };

            teamResultsList.push(teamResult);
        }

        // Sort by date
        teamResultsList.sort((a, b) => a.meetDate.localeCompare(b.meetDate));

        return teamResultsList;
    }

    /**
     * Extract results for a specific team (individual results only - backward compatibility)
     */
    static extractTeamResults(
        allResults: RawResult[],
        teamIdentifier: string
    ): TeamResult[] {
        // Group by meet
        const resultsByMeet = new Map<string, RawResult[]>();

        // Filter results for the specified team (case-insensitive match on code or name)
        const teamResults = allResults.filter(result => {
            const teamMatch =
                result.teamCode.toLowerCase().includes(teamIdentifier.toLowerCase()) ||
                result.teamName.toLowerCase().includes(teamIdentifier.toLowerCase());
            return teamMatch;
        });

        // Group by meet
        for (const result of teamResults) {
            const meetKey = `${result.meetDate}_${result.meetName}`;
            if (!resultsByMeet.has(meetKey)) {
                resultsByMeet.set(meetKey, []);
            }
            resultsByMeet.get(meetKey)!.push(result);
        }

        // Create team result objects
        const teamResultsList: TeamResult[] = [];

        for (const [meetKey, results] of resultsByMeet.entries()) {
            if (results.length === 0) continue;

            const firstResult = results[0];
            const teamResult: TeamResult = {
                teamName: firstResult.teamName,
                teamCode: firstResult.teamCode,
                meetName: firstResult.meetName,
                meetDate: firstResult.meetDate,
                results: results.map(r => ({
                    athlete: `${r.firstName} ${r.lastName}`,
                    event: r.eventAbbr,
                    result: r.result,
                    place: r.overallPlace,
                    gender: r.athleteGender,
                    grade: r.grade
                })).sort((a, b) => {
                    // Sort by grade, then event, then result
                    if (a.grade !== b.grade) return a.grade.localeCompare(b.grade);
                    if (a.event !== b.event) return a.event.localeCompare(b.event);
                    return 0;
                })
            };

            teamResultsList.push(teamResult);
        }

        // Sort by date
        teamResultsList.sort((a, b) => a.meetDate.localeCompare(b.meetDate));

        return teamResultsList;
    }

    /**
     * Save team results to JSON file
     */
    static saveToJSON(teamResults: TeamResult[], outputPath: string): void {
        const output = {
            teamName: teamResults[0]?.teamName || 'Unknown Team',
            teamCode: teamResults[0]?.teamCode || '',
            meets: teamResults
        };

        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
        console.log(`✓ Team results saved to ${outputPath}`);
        console.log(`  - Total meets: ${teamResults.length}`);
        console.log(`  - Total individual results: ${teamResults.reduce((sum, meet) => sum + meet.results.length, 0)}`);

        const relayCount = teamResults.reduce((sum, meet) => sum + (meet.relayResults?.length || 0), 0);
        if (relayCount > 0) {
            console.log(`  - Total relay results: ${relayCount}`);
        }
    }

    /**
     * Get list of unique teams from results
     */
    static getUniqueTeams(allResults: RawResult[]): Array<{ code: string; name: string }> {
        const teamsMap = new Map<string, string>();

        for (const result of allResults) {
            if (!teamsMap.has(result.teamCode)) {
                teamsMap.set(result.teamCode, result.teamName);
            }
        }

        return Array.from(teamsMap.entries())
            .map(([code, name]) => ({ code, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }
}
