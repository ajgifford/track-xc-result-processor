/**
 * Relay Rankings Generator
 *
 * Generates rankings for relay events, grouped by team and athlete composition.
 * Different athlete combinations for the same team are treated as separate entries.
 */

import * as fs from 'fs';
import * as path from 'path';
import { RelayResult, RelayCategory, RelayRanking, RelayAthlete } from '../common/types';
import { ResultUtils } from '../common/result-utils';

export class RelayRankingsGenerator {
    /**
     * Generate a unique key for a relay team based on sorted athlete names
     * This ensures that different orderings of the same athletes are treated as the same team
     */
    static getRelayTeamKey(teamCode: string, athletes: RelayAthlete[]): string {
        const athleteNames = athletes
            .map(a => `${a.firstName} ${a.lastName}`)
            .sort()
            .join('|');
        return `${teamCode}___${athleteNames}`;
    }

    /**
     * Generate relay rankings from all relay results
     */
    static generateRelayRankings(allRelayResults: RelayResult[], season: string): RelayCategory[] {
        // Group by event, gender, and grade
        const categoryMap = new Map<string, RelayResult[]>();

        for (const relay of allRelayResults) {
            // Determine grade from athletes (use first athlete's grade, or most common grade)
            const grade = this.determineRelayGrade(relay.athletes);

            const categoryKey = `${relay.eventAbbr}___${relay.gender}___${grade}`;

            if (!categoryMap.has(categoryKey)) {
                categoryMap.set(categoryKey, []);
            }
            categoryMap.get(categoryKey)!.push(relay);
        }

        // Process each category
        const categories: RelayCategory[] = [];

        for (const [categoryKey, relays] of categoryMap.entries()) {
            const [eventAbbr, gender, grade] = categoryKey.split('___');

            // Group by team + athlete composition
            const teamMap = new Map<string, RelayResult[]>();

            for (const relay of relays) {
                const teamKey = this.getRelayTeamKey(relay.teamCode, relay.athletes);
                if (!teamMap.has(teamKey)) {
                    teamMap.set(teamKey, []);
                }
                teamMap.get(teamKey)!.push(relay);
            }

            // Create rankings for this category
            const rankings: RelayRanking[] = [];

            for (const [teamKey, teamRelays] of teamMap.entries()) {
                // Find best result
                const sortedRelays = [...teamRelays].sort((a, b) =>
                    ResultUtils.compareResults(a.result, b.result, eventAbbr)
                );

                const bestRelay = sortedRelays[0];
                const athleteNames = bestRelay.athletes.map(a => `${a.firstName} ${a.lastName}`).sort();

                rankings.push({
                    rank: 0, // Will be assigned later
                    teamName: bestRelay.teamName,
                    teamCode: bestRelay.teamCode,
                    athletes: athleteNames,
                    athleteDetails: bestRelay.athletes,
                    bestResult: bestRelay.result,
                    bestResultMeet: bestRelay.meetName,
                    bestResultDate: bestRelay.meetDate,
                    allResults: teamRelays.map(r => ({
                        result: r.result,
                        meet: r.meetName,
                        date: r.meetDate,
                        place: r.overallPlace,
                        athletes: r.athletes
                    }))
                });
            }

            // Sort by best result and assign ranks
            rankings.sort((a, b) =>
                ResultUtils.compareResults(a.bestResult, b.bestResult, eventAbbr)
            );

            rankings.forEach((ranking, index) => {
                ranking.rank = index + 1;
            });

            // Get event name from abbreviation
            const eventName = this.getRelayEventName(eventAbbr);

            categories.push({
                event: eventName,
                eventAbbr,
                gender,
                grade,
                relayTeams: rankings
            });
        }

        return categories;
    }

    /**
     * Determine the grade for a relay team based on participating athletes
     * Uses the most common grade among the athletes
     */
    static determineRelayGrade(athletes: RelayAthlete[]): string {
        if (athletes.length === 0) return '';

        const gradeCounts = new Map<string, number>();
        for (const athlete of athletes) {
            const grade = athlete.grade || '';
            gradeCounts.set(grade, (gradeCounts.get(grade) || 0) + 1);
        }

        // Find most common grade
        let mostCommonGrade = '';
        let maxCount = 0;
        for (const [grade, count] of gradeCounts.entries()) {
            if (count > maxCount) {
                maxCount = count;
                mostCommonGrade = grade;
            }
        }

        return mostCommonGrade;
    }

    /**
     * Get the full event name from abbreviation
     */
    static getRelayEventName(abbr: string): string {
        const relayNames: Record<string, string> = {
            '400S': '4x400m Relay',
            '800S': '4x800m Relay',
            'DMRS': 'Distance Medley Relay',
            'MRS': 'Medley Relay',
            '4x100': '4x100m Relay',
            '4x200': '4x200m Relay',
            '4x400': '4x400m Relay',
            '4x800': '4x800m Relay'
        };

        return relayNames[abbr] || `${abbr} Relay`;
    }

    /**
     * Save relay rankings to JSON files (one per event)
     */
    static saveToJSON(categories: RelayCategory[], outputDir: string, season: string): void {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Group categories by event
        const eventMap = new Map<string, RelayCategory[]>();
        for (const cat of categories) {
            if (!eventMap.has(cat.eventAbbr)) {
                eventMap.set(cat.eventAbbr, []);
            }
            eventMap.get(cat.eventAbbr)!.push(cat);
        }

        // Save each event to a separate file
        for (const [eventAbbr, eventCategories] of eventMap.entries()) {
            const filename = `relay_rankings_${season}_${eventAbbr}.json`;
            const filePath = path.join(outputDir, filename);

            const output = {
                season,
                event: eventCategories[0].event,
                eventAbbr,
                type: 'relay',
                generatedDate: new Date().toISOString(),
                categories: eventCategories.map(cat => ({
                    gender: cat.gender,
                    grade: cat.grade,
                    totalTeams: cat.relayTeams.length,
                    rankings: cat.relayTeams
                }))
            };

            fs.writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf-8');
        }

        const totalTeams = categories.reduce((sum, cat) => sum + cat.relayTeams.length, 0);
        console.log(`✓ Relay rankings saved to ${outputDir}`);
        console.log(`  - Total relay teams ranked: ${totalTeams}`);
        console.log(`  - Events: ${eventMap.size}`);
        console.log(`  - Files created: ${eventMap.size}`);
    }

    /**
     * Merge relay rankings with existing rankings
     */
    static mergeWithExisting(
        newCategories: RelayCategory[],
        outputDir: string,
        season: string
    ): RelayCategory[] {
        if (!fs.existsSync(outputDir)) {
            return newCategories;
        }

        const mergedMap = new Map<string, RelayCategory>();

        // Add new categories to map
        for (const cat of newCategories) {
            const key = `${cat.eventAbbr}___${cat.gender}___${cat.grade}`;
            mergedMap.set(key, cat);
        }

        // Read existing files and merge
        const files = fs.readdirSync(outputDir)
            .filter(f => f.startsWith(`relay_rankings_${season}_`) && f.endsWith('.json'));

        for (const file of files) {
            try {
                const filePath = path.join(outputDir, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

                for (const catData of data.categories) {
                    const key = `${data.eventAbbr}___${catData.gender}___${catData.grade}`;

                    if (mergedMap.has(key)) {
                        // Merge rankings
                        const existingCategory = mergedMap.get(key)!;
                        const existingTeams = existingCategory.relayTeams;

                        // Add existing teams that aren't in new data
                        for (const existingRanking of catData.rankings) {
                            const existingKey = `${existingRanking.teamCode}___${existingRanking.athletes.sort().join('|')}`;

                            const found = existingTeams.some(team => {
                                const teamKey = `${team.teamCode}___${team.athletes.sort().join('|')}`;
                                return teamKey === existingKey;
                            });

                            if (!found) {
                                existingTeams.push(existingRanking);
                            } else {
                                // Merge results for existing team
                                const matchingTeam = existingTeams.find(team => {
                                    const teamKey = `${team.teamCode}___${team.athletes.sort().join('|')}`;
                                    return teamKey === existingKey;
                                });

                                if (matchingTeam) {
                                    // Add any new results
                                    for (const result of existingRanking.allResults) {
                                        const resultExists = matchingTeam.allResults.some(r =>
                                            r.meet === result.meet && r.date === result.date
                                        );
                                        if (!resultExists) {
                                            matchingTeam.allResults.push(result);
                                        }
                                    }

                                    // Update best result if better
                                    const comparison = ResultUtils.compareResults(
                                        existingRanking.bestResult,
                                        matchingTeam.bestResult,
                                        data.eventAbbr
                                    );
                                    if (comparison < 0) {
                                        matchingTeam.bestResult = existingRanking.bestResult;
                                        matchingTeam.bestResultMeet = existingRanking.bestResultMeet;
                                        matchingTeam.bestResultDate = existingRanking.bestResultDate;
                                    }
                                }
                            }
                        }

                        // Re-sort and re-rank
                        existingTeams.sort((a, b) =>
                            ResultUtils.compareResults(a.bestResult, b.bestResult, data.eventAbbr)
                        );
                        existingTeams.forEach((team, index) => {
                            team.rank = index + 1;
                        });
                    } else {
                        // Add category from existing file
                        mergedMap.set(key, {
                            event: data.event,
                            eventAbbr: data.eventAbbr,
                            gender: catData.gender,
                            grade: catData.grade,
                            relayTeams: catData.rankings
                        });
                    }
                }
            } catch (error) {
                console.warn(`Warning: Could not merge relay rankings from ${file}`);
            }
        }

        return Array.from(mergedMap.values());
    }
}
