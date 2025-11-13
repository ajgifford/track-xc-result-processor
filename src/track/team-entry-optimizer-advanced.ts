/**
 * Advanced Team Entry Optimizer
 *
 * Considers all competitors to predict realistic placements.
 * Accounts for what other teams will likely enter.
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

interface AthleteEventScore {
    athlete: string;
    team: string;
    event: string;
    rank: number;
    projectedPlace: number;
    points: number;
}

export class AdvancedTeamEntryOptimizer {
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

        if (!fs.existsSync(rankingsDir)) {
            throw new Error(`Rankings directory not found: ${rankingsDir}`);
        }

        const files = fs.readdirSync(rankingsDir)
            .filter(f => f.startsWith(`event_rankings_${season}_`) && f.endsWith('.json'));

        for (const file of files) {
            const filePath = path.join(rankingsDir, file);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

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
     * Check if event combination is valid
     */
    static isValidCombination(events: string[]): boolean {
        if (events.length > 4) return false;

        const has1600 = events.includes('1600');
        const has800 = events.includes('800');

        if (has1600 && has800) {
            const runningEvents = events.filter(e => ResultUtils.isTrackEvent(e));
            const otherRunning = runningEvents.filter(e => e !== '1600' && e !== '800');

            if (otherRunning.length > 1) return false;

            if (events.length === 4) {
                const fieldEvents = events.filter(e => ResultUtils.isFieldEvent(e));
                if (fieldEvents.length === 0) return false;
            }
        }

        return true;
    }

    /**
     * Predict likely entries for all teams
     *
     * Assumes teams will enter their top 2-3 athletes per event
     */
    static predictCompetition(
        allRankings: EventRankingData[]
    ): Map<string, Set<string>> {
        // Map of athlete -> set of events they'll likely compete in
        const likelyEntries = new Map<string, Set<string>>();

        for (const eventData of allRankings) {
            // For each team, assume they'll enter top 2-3 ranked athletes
            const teamAthletes = new Map<string, string[]>();

            for (const ranking of eventData.rankings) {
                if (!teamAthletes.has(ranking.team)) {
                    teamAthletes.set(ranking.team, []);
                }
                teamAthletes.get(ranking.team)!.push(ranking.athlete);
            }

            // Assume each team enters their top 2-3 athletes in each event
            for (const [team, athletes] of teamAthletes.entries()) {
                const topAthletes = athletes.slice(0, Math.min(3, athletes.length));

                for (const athlete of topAthletes) {
                    if (!likelyEntries.has(athlete)) {
                        likelyEntries.set(athlete, new Set());
                    }
                    likelyEntries.get(athlete)!.add(eventData.eventAbbr);
                }
            }
        }

        return likelyEntries;
    }

    /**
     * Calculate projected placement accounting for competition
     */
    static calculateProjectedPlace(
        athlete: string,
        event: string,
        currentRank: number,
        likelyEntries: Map<string, Set<string>>,
        eventRankings: EventRankingData
    ): number {
        // Count how many athletes ranked higher will likely compete
        let competitorsAhead = 0;

        for (const ranking of eventRankings.rankings) {
            if (ranking.rank < currentRank) {
                // Check if this athlete will likely compete
                const athleteEvents = likelyEntries.get(ranking.athlete);
                if (athleteEvents && athleteEvents.has(event)) {
                    competitorsAhead++;
                }
            }
        }

        // Projected place is 1 + number of competitors likely ahead
        return competitorsAhead + 1;
    }

    /**
     * Optimize entries with competition prediction
     */
    static optimize(
        rankingsDir: string,
        season: string,
        teamName: string,
        gender: string,
        grade: string
    ): OptimizationResult {
        const allRankings = this.loadRankings(rankingsDir, season, gender, grade);

        // Predict what other teams will enter
        const likelyEntries = this.predictCompetition(allRankings);

        // Get team athletes and calculate their projected scores
        const athleteOptions = new Map<string, AthleteEventScore[]>();

        for (const eventData of allRankings) {
            for (const ranking of eventData.rankings) {
                if (ranking.team === teamName) {
                    const projectedPlace = this.calculateProjectedPlace(
                        ranking.athlete,
                        eventData.eventAbbr,
                        ranking.rank,
                        likelyEntries,
                        eventData
                    );

                    const points = POINTS_TABLE[projectedPlace] || 0;

                    if (!athleteOptions.has(ranking.athlete)) {
                        athleteOptions.set(ranking.athlete, []);
                    }

                    athleteOptions.get(ranking.athlete)!.push({
                        athlete: ranking.athlete,
                        team: teamName,
                        event: eventData.eventAbbr,
                        rank: ranking.rank,
                        projectedPlace,
                        points
                    });
                }
            }
        }

        // Optimize each athlete's event selection
        const athleteEntries: AthleteEntry[] = [];
        const eventEntries = new Map<string, EventEntry>();

        for (const [athlete, options] of athleteOptions.entries()) {
            // Sort by projected points (desc), then by projected place (asc)
            const sortedOptions = options.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                return a.projectedPlace - b.projectedPlace;
            });

            // Greedy selection
            const selectedEvents: string[] = [];
            const selectedScores: AthleteEventScore[] = [];

            for (const option of sortedOptions) {
                if (selectedEvents.length >= 4) break;

                const testEvents = [...selectedEvents, option.event];
                if (this.isValidCombination(testEvents)) {
                    selectedEvents.push(option.event);
                    selectedScores.push(option);
                }
            }

            const totalPoints = selectedScores.reduce((sum, s) => sum + s.points, 0);

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
                for (const score of selectedScores) {
                    const eventData = allRankings.find(e => e.eventAbbr === score.event)!;

                    if (!eventEntries.has(score.event)) {
                        eventEntries.set(score.event, {
                            event: score.event,
                            eventName: eventData.eventName,
                            athletes: []
                        });
                    }

                    eventEntries.get(score.event)!.athletes.push({
                        athlete,
                        projectedPlace: score.projectedPlace,
                        projectedPoints: score.points,
                        currentRank: score.rank
                    });
                }
            }
        }

        // Sort results
        athleteEntries.sort((a, b) => b.projectedPoints - a.projectedPoints);

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
        lines.push('  OPTIMIZED TEAM ENTRY (ADVANCED METHOD)');
        lines.push('═══════════════════════════════════════════════════════════');
        lines.push('');
        lines.push(`School: ${result.school}`);
        lines.push(`Gender: ${result.gender}`);
        lines.push(`Grade: ${result.grade}`);
        lines.push(`Projected Total Points: ${result.totalProjectedPoints}`);
        lines.push('');
        lines.push('Note: Projected placements account for likely competition');
        lines.push('      from other teams based on current rankings.');
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
                    lines.push(`  - ${eventData!.eventName}: Rank ${athleteData.currentRank} → Proj. ${athleteData.projectedPlace}th → ${athleteData.projectedPoints} pts`);
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
                lines.push(`  Proj. ${athlete.projectedPlace}. ${athlete.athlete} (Rank ${athlete.currentRank}) - ${athlete.projectedPoints} pts`);
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
