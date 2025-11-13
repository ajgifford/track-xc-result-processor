import * as fs from 'fs';
import * as path from 'path';
import {
  XCResult,
  XCSeasonResult,
  XCSeasonRaceData,
  XCSeasonMeetResult,
  XCRaceResult,
  RACE_INFO
} from './xc-types';
import { XCCSVParser } from './xc-csv-parser';

/**
 * XC Season Results Generator
 *
 * Generates season-long team results showing performance over time
 */
export class XCSeasonResultsGenerator {
  /**
   * Load existing season results for a team
   */
  static loadExistingResults(filePath: string): XCSeasonResult | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as XCSeasonResult;
    } catch (error) {
      console.error(`Error loading existing season results from ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Create new season results for a team from a single meet
   */
  static createSeasonResults(
    teamName: string,
    season: string,
    meetResults: XCResult[],
    meetName: string,
    meetDate: string
  ): XCSeasonResult {
    const races: XCSeasonRaceData[] = [];

    // Group by race
    const raceGroups = XCCSVParser.groupByRace(meetResults);
    const raceOrder = ['34girls', '34boys', '56girls', '56boys', '78girls', '78boys'];

    for (const raceId of raceOrder) {
      const raceResults = raceGroups.get(raceId);
      if (!raceResults || raceResults.length === 0) {
        continue;
      }

      const raceInfo = RACE_INFO[raceId];

      // Convert to race results
      const results: XCRaceResult[] = raceResults
        .sort((a, b) => (a.place || 999) - (b.place || 999))
        .map(r => ({
          place: r.place,
          athlete: r.athlete,
          grade: r.grade,
          score: r.score,
          time: r.time,
          gap: r.gap,
          avgMile: r.avgMile
        }));

      const meetResult: XCSeasonMeetResult = {
        meetName,
        meetDate,
        results
      };

      races.push({
        race: raceInfo.displayName,
        ageGroup: raceInfo.ageGroup,
        gender: raceInfo.gender,
        distance: raceInfo.distance,
        meets: [meetResult]
      });
    }

    return {
      teamName,
      season,
      races
    };
  }

  /**
   * Merge new meet results into existing season results
   */
  static mergeSeasonResults(
    existing: XCSeasonResult,
    newMeetResults: XCResult[],
    meetName: string,
    meetDate: string
  ): XCSeasonResult {
    const raceGroups = XCCSVParser.groupByRace(newMeetResults);
    const updatedRaces: XCSeasonRaceData[] = [];

    // Process each race
    const raceOrder = ['34girls', '34boys', '56girls', '56boys', '78girls', '78boys'];

    for (const raceId of raceOrder) {
      const raceInfo = RACE_INFO[raceId];
      const raceResults = raceGroups.get(raceId);

      // Find existing race data
      const existingRace = existing.races.find(r =>
        r.ageGroup === raceInfo.ageGroup && r.gender === raceInfo.gender
      );

      if (existingRace) {
        // Add new meet to existing race
        const newMeet: XCSeasonMeetResult = {
          meetName,
          meetDate,
          results: raceResults ?
            raceResults
              .sort((a, b) => (a.place || 999) - (b.place || 999))
              .map(r => ({
                place: r.place,
                athlete: r.athlete,
                grade: r.grade,
                score: r.score,
                time: r.time,
                gap: r.gap,
                avgMile: r.avgMile
              })) :
            []
        };

        // Only add if there are results
        if (newMeet.results.length > 0) {
          const updatedMeets = [...existingRace.meets, newMeet];

          // Sort meets by date
          updatedMeets.sort((a, b) => a.meetDate.localeCompare(b.meetDate));

          updatedRaces.push({
            ...existingRace,
            meets: updatedMeets
          });
        } else {
          // Keep existing race as-is
          updatedRaces.push(existingRace);
        }
      } else if (raceResults && raceResults.length > 0) {
        // New race that didn't exist before
        const newMeet: XCSeasonMeetResult = {
          meetName,
          meetDate,
          results: raceResults
            .sort((a, b) => (a.place || 999) - (b.place || 999))
            .map(r => ({
              place: r.place,
              athlete: r.athlete,
              grade: r.grade,
              score: r.score,
              time: r.time,
              gap: r.gap,
              avgMile: r.avgMile
            }))
        };

        updatedRaces.push({
          race: raceInfo.displayName,
          ageGroup: raceInfo.ageGroup,
          gender: raceInfo.gender,
          distance: raceInfo.distance,
          meets: [newMeet]
        });
      }
    }

    // Add any races from existing that weren't in new results
    for (const existingRace of existing.races) {
      if (!updatedRaces.find(r =>
        r.ageGroup === existingRace.ageGroup && r.gender === existingRace.gender
      )) {
        updatedRaces.push(existingRace);
      }
    }

    // Sort races in standard order
    const raceOrderMap: Record<string, number> = {
      '34Female': 0,
      '34Male': 1,
      '56Female': 2,
      '56Male': 3,
      '78Female': 4,
      '78Male': 5
    };

    updatedRaces.sort((a, b) => {
      const keyA = `${a.ageGroup}${a.gender}`;
      const keyB = `${b.ageGroup}${b.gender}`;
      return raceOrderMap[keyA] - raceOrderMap[keyB];
    });

    return {
      teamName: existing.teamName,
      season: existing.season,
      races: updatedRaces
    };
  }

  /**
   * Save season results to JSON file
   */
  static saveToJSON(seasonResult: XCSeasonResult, outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(seasonResult, null, 2), 'utf-8');
  }

  /**
   * Update season results for all teams
   */
  static updateSeasonResults(
    allResults: XCResult[],
    meetName: string,
    meetDate: string,
    season: string,
    seasonResultsDir: string
  ): void {
    console.log('\nUpdating season results...');

    const teams = XCCSVParser.getUniqueTeams(allResults);

    for (const team of teams) {
      // Filter results for this team
      const teamResults = XCCSVParser.filterByTeam(allResults, team);

      if (teamResults.length === 0) continue;

      // Create safe filename
      const safeTeamName = team.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
      const outputPath = path.join(seasonResultsDir, `${safeTeamName}.json`);

      // Load existing or create new
      const existing = this.loadExistingResults(outputPath);

      let seasonResult: XCSeasonResult;

      if (existing) {
        // Merge with existing
        seasonResult = this.mergeSeasonResults(
          existing,
          teamResults,
          meetName,
          meetDate
        );
        console.log(`  ✓ Updated ${team}`);
      } else {
        // Create new
        seasonResult = this.createSeasonResults(
          team,
          season,
          teamResults,
          meetName,
          meetDate
        );
        console.log(`  ✓ Created ${team}`);
      }

      this.saveToJSON(seasonResult, outputPath);
    }

    console.log('✓ Season results updated for all teams');
  }
}
