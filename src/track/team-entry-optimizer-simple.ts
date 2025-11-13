/**
 * Simple Team Entry Optimizer
 *
 * Uses only team athletes' current rankings to optimize entries.
 * Assumes athletes will place at their current rank.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ResultUtils } from '../common/result-utils';
import { AthleteEntry, EventEntry, OptimizationResult, EventRankingData } from './optimizer-types';

const POINTS_TABLE: Record<number, number> = {
    1: 8,
    2: 6,
    3: 4,
    4: 2,
    5: 1
};

export class SimpleTeamEntryOptimizer {
    /**
     * Load event rankings for a specific gender and grade
     */
    static loadRankings(
        rankingsDir: string,
        season: string,
        gender: string,
        grade: string
    ): EventRankingData[] {
        const rankings: EventRankingData[] = [];

        // Get all event ranking files
        if (!fs.existsSync(rankingsDir)) {
            throw new Error(`Rankings directory not found: ${rankingsDir}`);
        }

        const files = fs.readdirSync(rankingsDir)
            .filter(f => f.startsWith(`event_rankings_${season}_`) && f.endsWith('.json'));

        for (const file of files) {
            const filePath = path.join(rankingsDir, file);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

            // Find the matching category
            const category = data.categories.find((cat: any) =>
                cat.gender === gender && cat.grade === grade
            );

            if (category) {
                rankings.push({
                    eventAbbr: data.eventAbbr,
                    eventName: data.event,
                    gender,
                    grade,
                    rankings: category.rankings
                });
            }
        }

        return rankings;
    }

    /**
     * Check if event combination is valid for an athlete
     */
    static isValidCombination(events: string[]): boolean {
        if (events.length > 4) return false;

        const has1600 = events.includes('1600');
        const has800 = events.includes('800');

        if (has1600 && has800) {
            // Count other running events
            const runningEvents = events.filter(e => ResultUtils.isTrackEvent(e));
            const otherRunning = runningEvents.filter(e => e !== '1600' && e !== '800');

            // Can only have 1 other running event
            if (otherRunning.length > 1) return false;

            // Must have exactly 4 events, and the 4th must be field
            if (events.length === 4) {
                const fieldEvents = events.filter(e => ResultUtils.isFieldEvent(e));
                if (fieldEvents.length === 0) return false;
            }
        }

        return true;
    }

    /**
     * Get track events (excluding 1600 and 800 if specified)
     */
    static getTrackEvents(events: EventRankingData[], exclude1600800: boolean = false): EventRankingData[] {
        return events.filter(e => {
            if (!ResultUtils.isTrackEvent(e.eventAbbr)) return false;
            if (exclude1600800 && (e.eventAbbr === '1600' || e.eventAbbr === '800')) return false;
            return true;
        });
    }

    /**
     * Get field events
     */
    static getFieldEvents(events: EventRankingData[]): EventRankingData[] {
        return events.filter(e => ResultUtils.isFieldEvent(e.eventAbbr));
    }

    /**
     * Optimize entries for a team
     */
    static optimize(
        rankingsDir: string,
        season: string,
        teamName: string,
        gender: string,
        grade: string
    ): OptimizationResult {
        // Load all rankings for this gender/grade
        const allRankings = this.loadRankings(rankingsDir, season, gender, grade);

        // Get team athletes and their rankings
        const athleteScores = new Map<string, Map<string, { rank: number; points: number }>>();

        for (const eventData of allRankings) {
            for (const ranking of eventData.rankings) {
                if (ranking.team === teamName) {
                    const points = POINTS_TABLE[ranking.rank] || 0;

                    if (!athleteScores.has(ranking.athlete)) {
                        athleteScores.set(ranking.athlete, new Map());
                    }

                    athleteScores.get(ranking.athlete)!.set(eventData.eventAbbr, {
                        rank: ranking.rank,
                        points
                    });
                }
            }
        }

        // Build list of athletes with their best events
        const athletes = Array.from(athleteScores.keys());
        const athleteEntries: AthleteEntry[] = [];
        const eventEntries = new Map<string, EventEntry>();

        for (const athlete of athletes) {
            const eventScores = athleteScores.get(athlete)!;

            // Get all events sorted by points (descending), then by rank (ascending)
            const sortedEvents = Array.from(eventScores.entries())
                .sort((a, b) => {
                    if (b[1].points !== a[1].points) return b[1].points - a[1].points;
                    return a[1].rank - b[1].rank;
                });

            // Greedy selection: pick best scoring events that form valid combination
            const selectedEvents: string[] = [];

            for (const [event, score] of sortedEvents) {
                if (selectedEvents.length >= 4) break;

                const testEvents = [...selectedEvents, event];
                if (this.isValidCombination(testEvents)) {
                    selectedEvents.push(event);
                }
            }

            // Calculate total points for this athlete
            const totalPoints = selectedEvents.reduce((sum, event) => {
                return sum + eventScores.get(event)!.points;
            }, 0);

            // Include all athletes who have at least one event
            if (selectedEvents.length > 0) {
                const [firstName, ...lastNameParts] = athlete.split(' ');
                athleteEntries.push({
                    athlete,
                    firstName,
                    lastName: lastNameParts.join(' '),
                    events: selectedEvents,
                    projectedPoints: totalPoints
                });

                // Add to event breakdown
                for (const event of selectedEvents) {
                    const score = eventScores.get(event)!;
                    const eventData = allRankings.find(e => e.eventAbbr === event)!;

                    if (!eventEntries.has(event)) {
                        eventEntries.set(event, {
                            event,
                            eventName: eventData.eventName,
                            athletes: []
                        });
                    }

                    eventEntries.get(event)!.athletes.push({
                        athlete,
                        projectedPlace: score.rank,
                        projectedPoints: score.points,
                        currentRank: score.rank
                    });
                }
            }
        }

        // Sort athletes by projected points (descending)
        athleteEntries.sort((a, b) => b.projectedPoints - a.projectedPoints);

        // Sort event breakdowns
        const eventBreakdown: EventEntry[] = Array.from(eventEntries.values())
            .sort((a, b) => a.event.localeCompare(b.event));

        for (const event of eventBreakdown) {
            event.athletes.sort((a, b) => a.projectedPlace - b.projectedPlace);
        }

        const totalPoints = athleteEntries.reduce((sum, a) => sum + a.projectedPoints, 0);

        return {
            school: teamName,
            gender,
            grade,
            totalProjectedPoints: totalPoints,
            athleteEntries,
            eventBreakdown
        };
    }

    /**
     * Save results to JSON
     */
    static saveJSON(result: OptimizationResult, outputPath: string): void {
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
    }

    /**
     * Generate human-readable report
     */
    static generateReport(result: OptimizationResult): string {
        const lines: string[] = [];

        lines.push('═══════════════════════════════════════════════════════════');
        lines.push('  OPTIMIZED TEAM ENTRY (SIMPLE METHOD)');
        lines.push('═══════════════════════════════════════════════════════════');
        lines.push('');
        lines.push(`School: ${result.school}`);
        lines.push(`Gender: ${result.gender}`);
        lines.push(`Grade: ${result.grade}`);
        lines.push(`Projected Total Points: ${result.totalProjectedPoints}`);
        lines.push('');

        lines.push('─────────────────────────────────────────────────────────');
        lines.push('ATHLETE ENTRIES');
        lines.push('─────────────────────────────────────────────────────────');
        lines.push('');

        for (const athlete of result.athleteEntries) {
            lines.push(`${athlete.athlete} - ${athlete.projectedPoints} points`);
            for (const event of athlete.events) {
                const eventData = result.eventBreakdown.find(e => e.event === event);
                const athleteData = eventData?.athletes.find(a => a.athlete === athlete.athlete);
                if (athleteData) {
                    lines.push(`  - ${eventData!.eventName}: Rank ${athleteData.currentRank} → ${athleteData.projectedPoints} pts`);
                }
            }
            lines.push('');
        }

        lines.push('─────────────────────────────────────────────────────────');
        lines.push('EVENT BREAKDOWN');
        lines.push('─────────────────────────────────────────────────────────');
        lines.push('');

        for (const event of result.eventBreakdown) {
            lines.push(`${event.eventName} (${event.event})`);
            for (const athlete of event.athletes) {
                lines.push(`  ${athlete.projectedPlace}. ${athlete.athlete} - ${athlete.projectedPoints} pts`);
            }
            lines.push('');
        }

        return lines.join('\n');
    }

    /**
     * Save report to text file
     */
    static saveReport(result: OptimizationResult, outputPath: string): void {
        const report = this.generateReport(result);
        fs.writeFileSync(outputPath, report, 'utf-8');
    }
}
