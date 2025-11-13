/**
 * Event Rankings Generator
 */

import * as fs from 'fs';
import { RawResult, EventCategory, EventRanking } from '../common/types';
import { ResultUtils } from '../common/result-utils';

export class EventRankingsGenerator {
    /**
     * Generate rankings for all events, grouped by gender and grade
     */
    static generateRankings(allResults: RawResult[], season: string): EventCategory[] {
        // Group results by event, gender, and grade
        const categoryMap = new Map<string, RawResult[]>();

        for (const result of allResults) {
            if (!ResultUtils.isValidResult(result.result)) {
                continue; // Skip DNS, DNF, etc.
            }

            const categoryKey = `${result.eventAbbr}|${result.athleteGender}|${result.grade}`;
            if (!categoryMap.has(categoryKey)) {
                categoryMap.set(categoryKey, []);
            }
            categoryMap.get(categoryKey)!.push(result);
        }

        // Process each category
        const categories: EventCategory[] = [];

        for (const [categoryKey, results] of categoryMap.entries()) {
            const [eventAbbr, gender, grade] = categoryKey.split('|');

            // Group by athlete
            const athleteMap = new Map<string, RawResult[]>();

            for (const result of results) {
                const athleteKey = `${result.firstName}|${result.lastName}|${result.athleteId}`;
                if (!athleteMap.has(athleteKey)) {
                    athleteMap.set(athleteKey, []);
                }
                athleteMap.get(athleteKey)!.push(result);
            }

            // Create rankings for each athlete
            const rankings: EventRanking[] = [];

            for (const [athleteKey, athleteResults] of athleteMap.entries()) {
                const [firstName, lastName] = athleteKey.split('|');
                const fullName = `${firstName} ${lastName}`;

                // Sort results to find best
                const sortedResults = athleteResults.sort((a, b) =>
                    ResultUtils.compareResults(a.result, b.result, eventAbbr)
                );

                const bestResult = sortedResults[0];

                const ranking: EventRanking = {
                    athlete: fullName,
                    firstName,
                    lastName,
                    team: bestResult.teamName,
                    teamCode: bestResult.teamCode,
                    bestResult: bestResult.result,
                    bestResultMeet: bestResult.meetName,
                    bestResultDate: bestResult.meetDate,
                    allResults: sortedResults.map(r => ({
                        result: r.result,
                        meet: r.meetName,
                        date: r.meetDate,
                        place: r.overallPlace
                    }))
                };

                rankings.push(ranking);
            }

            // Sort rankings by best result
            rankings.sort((a, b) =>
                ResultUtils.compareResults(a.bestResult, b.bestResult, eventAbbr)
            );

            categories.push({
                event: eventAbbr,
                gender,
                grade,
                rankings
            });
        }

        // Sort categories by event, gender, grade
        categories.sort((a, b) => {
            if (a.event !== b.event) return a.event.localeCompare(b.event);
            if (a.gender !== b.gender) return a.gender.localeCompare(b.gender);
            return a.grade.localeCompare(b.grade);
        });

        return categories;
    }

    /**
     * Save rankings to separate JSON files per event
     */
    static saveToJSON(categories: EventCategory[], outputDir: string, season: string): void {
        // Group categories by event
        const eventMap = new Map<string, EventCategory[]>();

        for (const cat of categories) {
            if (!eventMap.has(cat.event)) {
                eventMap.set(cat.event, []);
            }
            eventMap.get(cat.event)!.push(cat);
        }

        // Create output directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Save each event to a separate file
        let totalFiles = 0;
        let totalAthletes = 0;

        for (const [eventAbbr, eventCategories] of eventMap.entries()) {
            const output = {
                season,
                event: ResultUtils.getEventName(eventAbbr),
                eventAbbr,
                generatedDate: new Date().toISOString(),
                categories: eventCategories.map(cat => ({
                    gender: cat.gender === 'M' ? 'Male' : 'Female',
                    grade: cat.grade,
                    totalAthletes: cat.rankings.length,
                    rankings: cat.rankings.map((ranking, index) => ({
                        rank: index + 1,
                        athlete: ranking.athlete,
                        team: ranking.team,
                        bestResult: ranking.bestResult,
                        bestResultMeet: ranking.bestResultMeet,
                        bestResultDate: ranking.bestResultDate,
                        allResults: ranking.allResults
                    }))
                }))
            };

            const filename = `event_rankings_${season}_${eventAbbr}.json`;
            const filepath = `${outputDir}/${filename}`;

            fs.writeFileSync(filepath, JSON.stringify(output, null, 2), 'utf-8');
            totalFiles++;
            totalAthletes += eventCategories.reduce((sum, cat) => sum + cat.rankings.length, 0);
        }

        console.log(`✓ Event rankings saved to ${outputDir}`);
        console.log(`  - Total event files: ${totalFiles}`);
        console.log(`  - Total categories: ${categories.length}`);
        console.log(`  - Total athletes: ${totalAthletes}`);
    }

    /**
     * Load existing rankings from directory (if exists) and merge with new data
     */
    static mergeWithExisting(
        newCategories: EventCategory[],
        outputDir: string,
        season: string
    ): EventCategory[] {
        if (!fs.existsSync(outputDir)) {
            return newCategories;
        }

        // Group new categories by event
        const eventMap = new Map<string, EventCategory[]>();
        for (const cat of newCategories) {
            if (!eventMap.has(cat.event)) {
                eventMap.set(cat.event, []);
            }
            eventMap.get(cat.event)!.push(cat);
        }

        const mergedCategories: EventCategory[] = [];

        // Process each event
        for (const [eventAbbr, newEventCategories] of eventMap.entries()) {
            const filename = `event_rankings_${season}_${eventAbbr}.json`;
            const filepath = `${outputDir}/${filename}`;

            if (!fs.existsSync(filepath)) {
                // No existing file, just add new categories
                mergedCategories.push(...newEventCategories);
                continue;
            }

            try {
                const existingData = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
                const existingCategories: EventCategory[] = existingData.categories.map((cat: any) => ({
                    event: existingData.eventAbbr,
                    gender: cat.gender === 'Male' ? 'M' : 'F',
                    grade: cat.grade,
                    rankings: cat.rankings.map((rank: any) => ({
                        athlete: rank.athlete,
                        firstName: rank.athlete.split(' ')[0],
                        lastName: rank.athlete.split(' ').slice(1).join(' '),
                        team: rank.team,
                        teamCode: '',
                        bestResult: rank.bestResult,
                        bestResultMeet: rank.bestResultMeet,
                        bestResultDate: rank.bestResultDate,
                        allResults: rank.allResults
                    }))
                }));

                // Merge categories for this event
                const categoryMap = new Map<string, EventCategory>();

                // Add existing categories
                for (const cat of existingCategories) {
                    const key = `${cat.event}|${cat.gender}|${cat.grade}`;
                    categoryMap.set(key, cat);
                }

                // Merge new categories
                for (const newCat of newEventCategories) {
                    const key = `${newCat.event}|${newCat.gender}|${newCat.grade}`;
                    const existing = categoryMap.get(key);

                    if (!existing) {
                        categoryMap.set(key, newCat);
                    } else {
                        // Merge athletes
                        const athleteMap = new Map<string, EventRanking>();

                        // Add existing athletes
                        for (const ranking of existing.rankings) {
                            athleteMap.set(ranking.athlete, ranking);
                        }

                        // Merge new athletes
                        for (const newRanking of newCat.rankings) {
                            const existingRanking = athleteMap.get(newRanking.athlete);

                            if (!existingRanking) {
                                athleteMap.set(newRanking.athlete, newRanking);
                            } else {
                                // Merge results
                                const allResults = [...existingRanking.allResults, ...newRanking.allResults];

                                // Remove duplicates based on date and meet
                                const uniqueResults = Array.from(
                                    new Map(
                                        allResults.map(r => [`${r.date}|${r.meet}`, r])
                                    ).values()
                                );

                                // Sort by result quality
                                uniqueResults.sort((a, b) =>
                                    ResultUtils.compareResults(a.result, b.result, newCat.event)
                                );

                                const bestResult = uniqueResults[0];

                                athleteMap.set(newRanking.athlete, {
                                    ...existingRanking,
                                    bestResult: bestResult.result,
                                    bestResultMeet: bestResult.meet,
                                    bestResultDate: bestResult.date,
                                    allResults: uniqueResults
                                });
                            }
                        }

                        // Update category with merged athletes
                        const mergedRankings = Array.from(athleteMap.values());
                        mergedRankings.sort((a, b) =>
                            ResultUtils.compareResults(a.bestResult, b.bestResult, newCat.event)
                        );

                        categoryMap.set(key, {
                            ...newCat,
                            rankings: mergedRankings
                        });
                    }
                }

                mergedCategories.push(...Array.from(categoryMap.values()));
            } catch (error) {
                console.warn(`Warning: Could not merge with existing rankings for ${eventAbbr}: ${error}`);
                mergedCategories.push(...newEventCategories);
            }
        }

        // Sort all merged categories
        return mergedCategories.sort((a, b) => {
            if (a.event !== b.event) return a.event.localeCompare(b.event);
            if (a.gender !== b.gender) return a.gender.localeCompare(b.gender);
            return a.grade.localeCompare(b.grade);
        });
    }
}
