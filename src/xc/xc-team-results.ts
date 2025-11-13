import * as fs from 'fs';
import * as path from 'path';
import {
  XCResult,
  XCTeamResult,
  XCRaceData,
  XCRaceResult,
  ScoringConfig,
  RACE_INFO
} from './xc-types';
import { XCCSVParser } from './xc-csv-parser';

/**
 * XC Team Results Extractor
 *
 * Generates per-meet team result files (JSON + TXT)
 */
export class XCTeamResultsExtractor {
  /**
   * Extract team results for a specific meet
   */
  static extractTeamResults(
    allResults: XCResult[],
    teamName: string,
    meetName: string,
    meetDate: string,
    season: string,
    scoringConfig: ScoringConfig
  ): XCTeamResult {
    // Filter results for this team
    const teamResults = XCCSVParser.filterByTeam(allResults, teamName);

    // Group by race
    const raceGroups = XCCSVParser.groupByRace(teamResults);

    // Process each race
    const races: XCRaceData[] = [];
    const raceOrder = ['34girls', '34boys', '56girls', '56boys', '78girls', '78boys'];

    for (const raceId of raceOrder) {
      const raceResults = raceGroups.get(raceId);
      if (!raceResults || raceResults.length === 0) {
        continue; // Skip races with no results
      }

      const raceInfo = RACE_INFO[raceId];
      const raceData = this.processRace(
        raceResults,
        allResults.filter(r => r.raceIdentifier === raceId),
        raceInfo.displayName,
        raceInfo.ageGroup,
        raceInfo.gender,
        raceInfo.distance,
        scoringConfig
      );

      races.push(raceData);
    }

    return {
      teamName: teamResults[0]?.team || teamName,
      meetName,
      meetDate,
      season,
      teamScoreIncluded: scoringConfig.includeScoring,
      scoringPlaces: scoringConfig.includeScoring ? scoringConfig.scoringPlaces : undefined,
      displacementRunners: scoringConfig.includeScoring ? scoringConfig.displacementRunners : undefined,
      races
    };
  }

  /**
   * Process a single race and calculate team scores
   */
  private static processRace(
    teamResults: XCResult[],
    allRaceResults: XCResult[],
    raceName: string,
    ageGroup: string,
    gender: string,
    distance: string,
    scoringConfig: ScoringConfig
  ): XCRaceData {
    // Sort team results by place
    const sortedTeamResults = teamResults
      .sort((a, b) => (a.place || 999) - (b.place || 999));

    // Convert to race results
    const results: XCRaceResult[] = sortedTeamResults.map(r => ({
      place: r.place,
      athlete: r.athlete,
      grade: r.grade,
      score: r.score,
      time: r.time,
      gap: r.gap,
      avgMile: r.avgMile
    }));

    const raceData: XCRaceData = {
      race: raceName,
      ageGroup: ageGroup as any,
      gender: gender as any,
      distance,
      results
    };

    // Calculate team score if enabled
    if (scoringConfig.includeScoring) {
      this.calculateTeamScore(raceData, allRaceResults, scoringConfig);
    }

    return raceData;
  }

  /**
   * Calculate team score and mark scoring runners
   */
  private static calculateTeamScore(
    raceData: XCRaceData,
    allRaceResults: XCResult[],
    scoringConfig: ScoringConfig
  ): void {
    const { scoringPlaces } = scoringConfig;

    // Check if team has enough runners to score
    if (raceData.results.length < scoringPlaces) {
      // Incomplete team - don't calculate score
      return;
    }

    // Mark scoring runners (first N finishers from team)
    let scoringCount = 0;
    let teamScore = 0;

    for (const result of raceData.results) {
      if (scoringCount < scoringPlaces && result.score !== null) {
        result.scoring = true;
        teamScore += result.score;
        scoringCount++;
      } else {
        result.scoring = false;
      }
    }

    raceData.teamScore = teamScore;

    // Calculate team placement
    raceData.teamPlace = this.calculateTeamPlacement(
      raceData,
      allRaceResults,
      scoringConfig
    );
  }

  /**
   * Calculate team's placement in the race
   */
  private static calculateTeamPlacement(
    teamRaceData: XCRaceData,
    allRaceResults: XCResult[],
    scoringConfig: ScoringConfig
  ): number {
    // Group all results by team
    const teamScores: Array<{ team: string; score: number }> = [];
    const teamGroups = new Map<string, XCResult[]>();

    allRaceResults.forEach(result => {
      if (!teamGroups.has(result.team)) {
        teamGroups.set(result.team, []);
      }
      teamGroups.get(result.team)!.push(result);
    });

    // Calculate score for each team
    teamGroups.forEach((results, teamName) => {
      const sortedResults = results.sort((a, b) => (a.place || 999) - (b.place || 999));

      // Only score if team has enough runners with scores
      const scoringRunners = sortedResults.filter(r => r.score !== null);
      if (scoringRunners.length >= scoringConfig.scoringPlaces) {
        const score = scoringRunners
          .slice(0, scoringConfig.scoringPlaces)
          .reduce((sum, r) => sum + (r.score || 0), 0);

        teamScores.push({ team: teamName, score });
      }
    });

    // Sort by score (ascending - lower is better)
    teamScores.sort((a, b) => a.score - b.score);

    // Find this team's placement
    const teamName = teamRaceData.results[0]?.athlete ?
      allRaceResults.find(r => r.athlete === teamRaceData.results[0].athlete)?.team :
      '';

    const placement = teamScores.findIndex(ts => ts.team === teamName) + 1;
    return placement > 0 ? placement : 0;
  }

  /**
   * Save team results to JSON file
   */
  static saveToJSON(teamResult: XCTeamResult, outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(teamResult, null, 2), 'utf-8');
    console.log(`  ✓ JSON: ${outputPath}`);
  }

  /**
   * Save team results to human-readable TXT file
   */
  static saveToTXT(teamResult: XCTeamResult, outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const lines: string[] = [];

    // Header
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push(`  ${teamResult.teamName.toUpperCase()}`);
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push(`Meet: ${teamResult.meetName}`);
    lines.push(`Date: ${teamResult.meetDate}`);
    lines.push(`Season: ${teamResult.season}`);
    lines.push('');

    // Each race
    for (const race of teamResult.races) {
      lines.push('───────────────────────────────────────────────────────────');
      lines.push(`${race.race}`);
      lines.push('───────────────────────────────────────────────────────────');

      if (teamResult.teamScoreIncluded && race.teamScore !== undefined) {
        lines.push(`Team Score: ${race.teamScore} (Place: ${race.teamPlace || 'N/A'})`);
        lines.push('');
      }

      // Column headers
      lines.push(
        'Place'.padEnd(8) +
        'Athlete'.padEnd(30) +
        'Grade'.padEnd(8) +
        'Time'.padEnd(12) +
        'Avg Mile'.padEnd(12) +
        (teamResult.teamScoreIncluded ? 'Score'.padEnd(10) : '')
      );
      lines.push('─'.repeat(80));

      // Results
      for (const result of race.results) {
        const placeStr = result.place?.toString() || '--';
        const scoreStr = result.score?.toString() || '--';
        const scoringMark = (teamResult.teamScoreIncluded && result.scoring) ? '*' : ' ';

        lines.push(
          placeStr.padEnd(8) +
          result.athlete.padEnd(30) +
          result.grade.padEnd(8) +
          result.time.padEnd(12) +
          result.avgMile.padEnd(12) +
          (teamResult.teamScoreIncluded ? `${scoringMark}${scoreStr}`.padEnd(10) : '')
        );
      }

      lines.push('');

      if (teamResult.teamScoreIncluded) {
        lines.push(`* = Scoring runner (top ${teamResult.scoringPlaces})`);
        lines.push('');
      }
    }

    fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
    console.log(`  ✓ TXT:  ${outputPath}`);
  }

  /**
   * Extract and save results for all teams
   */
  static extractAllTeams(
    allResults: XCResult[],
    meetName: string,
    meetDate: string,
    season: string,
    scoringConfig: ScoringConfig,
    outputDir: string
  ): void {
    const teams = XCCSVParser.getUniqueTeams(allResults);

    console.log(`\nExtracting results for ${teams.length} teams...`);

    for (const team of teams) {
      const teamResult = this.extractTeamResults(
        allResults,
        team,
        meetName,
        meetDate,
        season,
        scoringConfig
      );

      // Create safe filename from team name
      const safeTeamName = team.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');

      const jsonPath = path.join(outputDir, `team_results_${safeTeamName}.json`);
      const txtPath = path.join(outputDir, `team_results_${safeTeamName}.txt`);

      this.saveToJSON(teamResult, jsonPath);
      this.saveToTXT(teamResult, txtPath);
    }

    console.log(`✓ Team results generated for all teams`);
  }
}
