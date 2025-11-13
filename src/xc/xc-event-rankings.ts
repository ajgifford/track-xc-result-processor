import * as fs from 'fs';
import * as path from 'path';
import {
  XCResult,
  XCEventRankings,
  XCRankingEntry,
  XCPerformance,
  RACE_INFO
} from './xc-types';
import { XCCSVParser } from './xc-csv-parser';

/**
 * XC Event Rankings Generator
 *
 * Generates season-long rankings by race (age group/gender)
 */
export class XCEventRankingsGenerator {
  /**
   * Generate rankings for a specific meet's results
   */
  static generateRankings(
    results: XCResult[],
    meetName: string,
    season: string
  ): Map<string, XCEventRankings> {
    const rankingsMap = new Map<string, XCEventRankings>();

    // Group by race
    const raceGroups = XCCSVParser.groupByRace(results);

    // Process each race
    raceGroups.forEach((raceResults, raceId) => {
      const raceInfo = RACE_INFO[raceId];

      // Group by athlete
      const athleteMap = new Map<string, XCResult[]>();

      raceResults.forEach(result => {
        const key = `${result.athlete}___${result.team}`;
        if (!athleteMap.has(key)) {
          athleteMap.set(key, []);
        }
        athleteMap.get(key)!.push(result);
      });

      // Create ranking entries
      const entries: XCRankingEntry[] = [];

      athleteMap.forEach((athleteResults, key) => {
        const firstResult = athleteResults[0];

        // Get all performances for this athlete
        const performances: XCPerformance[] = athleteResults.map(r => ({
          time: r.time,
          timeSeconds: XCCSVParser.timeToSeconds(r.time),
          avgMile: r.avgMile,
          place: r.place,
          meetName,
          meetDate: r.meetDate
        }));

        // Sort by time (best first)
        performances.sort((a, b) => a.timeSeconds - b.timeSeconds);

        const bestPerformance = performances[0];

        entries.push({
          rank: 0, // Will be set after sorting all entries
          athlete: firstResult.athlete,
          grade: firstResult.grade,
          team: firstResult.team,
          bestTime: bestPerformance.time,
          bestTimeSeconds: bestPerformance.timeSeconds,
          bestAvgMile: bestPerformance.avgMile,
          bestTimeMeet: bestPerformance.meetName,
          bestTimeMeetDate: bestPerformance.meetDate,
          performances
        });
      });

      // Sort by best time
      entries.sort((a, b) => a.bestTimeSeconds - b.bestTimeSeconds);

      // Assign ranks
      entries.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      // Create rankings object
      const rankings: XCEventRankings = {
        season,
        race: raceInfo.displayName,
        ageGroup: raceInfo.ageGroup,
        gender: raceInfo.gender,
        distance: raceInfo.distance,
        generatedDate: new Date().toISOString(),
        rankings: entries
      };

      rankingsMap.set(raceId, rankings);
    });

    return rankingsMap;
  }

  /**
   * Merge new rankings with existing rankings
   */
  static mergeRankings(
    existingRankings: XCEventRankings,
    newResults: XCResult[],
    meetName: string
  ): XCEventRankings {
    // Create a map of existing athletes
    const athleteMap = new Map<string, XCRankingEntry>();

    existingRankings.rankings.forEach(entry => {
      const key = `${entry.athlete}___${entry.team}`;
      athleteMap.set(key, { ...entry });
    });

    // Add new results
    newResults.forEach(result => {
      const key = `${result.athlete}___${result.team}`;

      const newPerformance: XCPerformance = {
        time: result.time,
        timeSeconds: XCCSVParser.timeToSeconds(result.time),
        avgMile: result.avgMile,
        place: result.place,
        meetName,
        meetDate: result.meetDate
      };

      if (athleteMap.has(key)) {
        // Add to existing athlete
        const entry = athleteMap.get(key)!;
        entry.performances.push(newPerformance);

        // Re-sort performances
        entry.performances.sort((a, b) => a.timeSeconds - b.timeSeconds);

        // Update best time if needed
        const bestPerf = entry.performances[0];
        entry.bestTime = bestPerf.time;
        entry.bestTimeSeconds = bestPerf.timeSeconds;
        entry.bestAvgMile = bestPerf.avgMile;
        entry.bestTimeMeet = bestPerf.meetName;
        entry.bestTimeMeetDate = bestPerf.meetDate;
      } else {
        // New athlete
        athleteMap.set(key, {
          rank: 0,
          athlete: result.athlete,
          grade: result.grade,
          team: result.team,
          bestTime: newPerformance.time,
          bestTimeSeconds: newPerformance.timeSeconds,
          bestAvgMile: newPerformance.avgMile,
          bestTimeMeet: newPerformance.meetName,
          bestTimeMeetDate: newPerformance.meetDate,
          performances: [newPerformance]
        });
      }
    });

    // Convert back to array and sort
    const entries = Array.from(athleteMap.values());
    entries.sort((a, b) => a.bestTimeSeconds - b.bestTimeSeconds);

    // Reassign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return {
      ...existingRankings,
      generatedDate: new Date().toISOString(),
      rankings: entries
    };
  }

  /**
   * Load existing rankings from file
   */
  static loadExistingRankings(filePath: string): XCEventRankings | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as XCEventRankings;
    } catch (error) {
      console.error(`Error loading existing rankings from ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Save rankings to JSON file
   */
  static saveToJSON(rankings: XCEventRankings, outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(rankings, null, 2), 'utf-8');
  }

  /**
   * Generate and save rankings for all races
   */
  static processRankings(
    results: XCResult[],
    meetName: string,
    season: string,
    rankingsDir: string,
    shouldMerge: boolean
  ): void {
    console.log('\nGenerating event rankings...');

    const newRankings = this.generateRankings(results, meetName, season);

    newRankings.forEach((rankings, raceId) => {
      const filename = `${raceId}.json`; // e.g., "56girls.json"
      const outputPath = path.join(rankingsDir, filename);

      let finalRankings = rankings;

      // Merge with existing if requested
      if (shouldMerge) {
        const existing = this.loadExistingRankings(outputPath);
        if (existing) {
          console.log(`  Merging with existing rankings for ${raceId}...`);
          const raceResults = XCCSVParser.filterByRace(results, raceId);
          finalRankings = this.mergeRankings(existing, raceResults, meetName);
        }
      }

      this.saveToJSON(finalRankings, outputPath);
      console.log(`  ✓ ${rankings.race}: ${finalRankings.rankings.length} athletes`);
    });

    console.log('✓ Event rankings generated');
  }
}
