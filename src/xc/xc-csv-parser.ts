import * as fs from 'fs';
import * as path from 'path';
import { XCResult } from './xc-types';

/**
 * XC CSV Parser
 *
 * Parses cross country race results from CSV files
 */
export class XCCSVParser {
  /**
   * Convert time string (MM:SS.s) to seconds
   */
  static timeToSeconds(timeStr: string): number {
    if (!timeStr || timeStr === '---' || timeStr === '-') {
      return Infinity;
    }

    // Handle format like "06:06.7" or "6:06.7"
    const parts = timeStr.split(':');
    if (parts.length !== 2) {
      return Infinity;
    }

    const minutes = parseInt(parts[0], 10);
    const seconds = parseFloat(parts[1]);

    if (isNaN(minutes) || isNaN(seconds)) {
      return Infinity;
    }

    return minutes * 60 + seconds;
  }

  /**
   * Parse a single CSV file
   */
  static parseFile(filePath: string, meetDate: string): XCResult[] {
    const results: XCResult[] = [];

    if (!fs.existsSync(filePath)) {
      return results;
    }

    const filename = path.basename(filePath, '.csv');
    const raceIdentifier = filename; // e.g., "56girls"

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Skip header row (line 0)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line
      const fields = this.parseCSVLine(line);

      if (fields.length < 8) continue;

      // Extract fields
      const placeStr = fields[0];
      const athlete = fields[1];
      const grade = fields[2];
      const team = fields[3];
      const scoreStr = fields[4];
      const time = fields[5];
      const gap = fields[6];
      const avgMile = fields[7];

      // Skip if missing essential data
      if (!athlete || !team || !time) continue;

      const place = placeStr ? parseInt(placeStr, 10) : null;
      const score = (scoreStr && scoreStr !== '--') ? parseInt(scoreStr, 10) : null;

      results.push({
        place: isNaN(place as number) ? null : place,
        athlete,
        grade: grade || '',
        team,
        score: isNaN(score as number) ? null : score,
        time,
        gap: gap || '---',
        avgMile: avgMile || '',
        raceIdentifier,
        meetDate
      });
    }

    return results;
  }

  /**
   * Parse a CSV line handling quoted fields
   */
  private static parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }

    // Add last field
    fields.push(currentField.trim());

    return fields;
  }

  /**
   * Parse all CSV files in a meet directory
   */
  static parseMeetDirectory(dirPath: string, meetDate: string): XCResult[] {
    const allResults: XCResult[] = [];

    if (!fs.existsSync(dirPath)) {
      return allResults;
    }

    const expectedFiles = [
      '34girls.csv',
      '34boys.csv',
      '56girls.csv',
      '56boys.csv',
      '78girls.csv',
      '78boys.csv'
    ];

    for (const filename of expectedFiles) {
      const filePath = path.join(dirPath, filename);
      const results = this.parseFile(filePath, meetDate);
      allResults.push(...results);
    }

    return allResults;
  }

  /**
   * Get list of unique teams from results
   */
  static getUniqueTeams(results: XCResult[]): string[] {
    const teams = new Set<string>();
    results.forEach(r => teams.add(r.team));
    return Array.from(teams).sort();
  }

  /**
   * Get available meet folders in input directory
   */
  static getMeetFolders(inputDir: string): string[] {
    if (!fs.existsSync(inputDir)) {
      return [];
    }

    return fs.readdirSync(inputDir)
      .filter(item => {
        const itemPath = path.join(inputDir, item);
        return fs.statSync(itemPath).isDirectory();
      })
      .sort();
  }

  /**
   * Filter results by team
   */
  static filterByTeam(results: XCResult[], teamName: string): XCResult[] {
    const lowerTeamName = teamName.toLowerCase();
    return results.filter(r =>
      r.team.toLowerCase().includes(lowerTeamName)
    );
  }

  /**
   * Filter results by race identifier
   */
  static filterByRace(results: XCResult[], raceIdentifier: string): XCResult[] {
    return results.filter(r => r.raceIdentifier === raceIdentifier);
  }

  /**
   * Group results by race identifier
   */
  static groupByRace(results: XCResult[]): Map<string, XCResult[]> {
    const grouped = new Map<string, XCResult[]>();

    results.forEach(result => {
      if (!grouped.has(result.raceIdentifier)) {
        grouped.set(result.raceIdentifier, []);
      }
      grouped.get(result.raceIdentifier)!.push(result);
    });

    return grouped;
  }
}
