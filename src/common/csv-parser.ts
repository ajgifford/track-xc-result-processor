/**
 * CSV Parser for Track & Field results
 */

import * as fs from 'fs';
import * as path from 'path';
import { RawResult, MeetHeader, RelayResult, RelayAthlete } from './types';

export class CSVParser {
    /**
     * Parse a single CSV line into a RawResult object
     */
    static parseLine(line: string, meetInfo: MeetHeader): RawResult | null {
        const fields = line.split(',');

        // Skip header lines
        if (fields[0] === 'H') {
            return null;
        }

        // Only process event lines
        if (fields[0] !== 'E') {
            return null;
        }

        const eventType = fields[1]; // 'T' or 'F'
        const eventId = fields[2];
        const eventAbbr = fields[4];
        const gender = fields[5];
        const category = fields[7];
        const grade = fields[8];
        const resultMarker = fields[9];
        const result = fields[10];
        const overallPlace = fields[13] ? parseInt(fields[13]) : null;
        const place = fields[14] ? parseInt(fields[14]) : null;
        const heat = fields[15] ? parseInt(fields[15]) : null;
        const lastName = fields[22];
        const firstName = fields[23];
        const athleteGender = fields[25];
        const teamCode = fields[27];
        const teamName = fields[28];
        const athleteId = fields[31];

        return {
            recordType: fields[0],
            eventType,
            eventId,
            eventAbbr,
            gender,
            category,
            grade,
            resultMarker,
            result,
            overallPlace,
            place,
            heat,
            lastName,
            firstName,
            athleteGender,
            teamCode,
            teamName,
            athleteId,
            meetDate: meetInfo.meetDate,
            meetName: meetInfo.meetName
        };
    }

    /**
     * Parse a relay line into a RelayResult object
     */
    static parseRelayLine(line: string, meetInfo: MeetHeader): RelayResult | null {
        const fields = line.split(',');

        // Only process relay lines
        if (fields[0] !== 'R') {
            return null;
        }

        const teamName = fields[1];
        const eventId = fields[2];
        const eventAbbr = fields[4];
        const gender = fields[5];
        const result = fields[10];
        const teamCode = fields[12];
        const overallPlace = fields[13] ? parseInt(fields[13]) : null;
        const place = fields[14] ? parseInt(fields[14]) : null;
        const heat = fields[15] ? parseInt(fields[15]) : null;

        // Parse athletes - starting at field 18, each athlete takes 7 fields
        const athletes: RelayAthlete[] = [];
        let athleteStartIndex = 18;

        // Determine number of relay legs based on event
        // Distance Medley (100-100-200-400) = 4 legs
        // Medley (100-50-50-200) = 4 legs
        // 400m relay (100-100-100-100) = 4 legs
        // All relays have 4 athletes
        const relaySize = 4;

        for (let i = 0; i < relaySize; i++) {
            const baseIndex = athleteStartIndex + (i * 7);
            const lastName = fields[baseIndex];
            const firstName = fields[baseIndex + 1];
            const athleteGender = fields[baseIndex + 2];
            const grade = fields[baseIndex + 4];

            // Only add if we have valid data
            if (lastName && firstName) {
                athletes.push({
                    lastName,
                    firstName,
                    gender: athleteGender,
                    grade: grade || ''
                });
            }
        }

        return {
            recordType: 'R',
            teamName,
            teamCode,
            eventId,
            eventAbbr,
            gender,
            result,
            overallPlace,
            place,
            heat,
            athletes,
            meetDate: meetInfo.meetDate,
            meetName: meetInfo.meetName
        };
    }

    /**
     * Parse meet header from CSV
     */
    static parseMeetHeader(headerLine: string): MeetHeader {
        const fields = headerLine.split(',');
        return {
            meetName: fields[1] || 'Unknown Meet',
            meetDate: fields[2] || '',
            software: fields[4] || ''
        };
    }

    /**
     * Parse a single CSV file
     */
    static parseFile(filePath: string): RawResult[] {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());

        if (lines.length === 0) {
            return [];
        }

        // Parse header
        const meetInfo = this.parseMeetHeader(lines[0]);

        // Parse all data lines
        const results: RawResult[] = [];
        for (let i = 1; i < lines.length; i++) {
            const result = this.parseLine(lines[i], meetInfo);
            if (result) {
                results.push(result);
            }
        }

        return results;
    }

    /**
     * Parse a single CSV file for both individual and relay results
     */
    static parseFileWithRelays(filePath: string): {
        individuals: RawResult[],
        relays: RelayResult[]
    } {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());

        if (lines.length === 0) {
            return { individuals: [], relays: [] };
        }

        // Parse header
        const meetInfo = this.parseMeetHeader(lines[0]);

        // Parse all data lines
        const individuals: RawResult[] = [];
        const relays: RelayResult[] = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];

            if (line.startsWith('E,')) {
                const result = this.parseLine(line, meetInfo);
                if (result) {
                    individuals.push(result);
                }
            } else if (line.startsWith('R,')) {
                const relay = this.parseRelayLine(line, meetInfo);
                if (relay) {
                    relays.push(relay);
                }
            }
        }

        return { individuals, relays };
    }

    /**
     * Parse all CSV files in a directory
     */
    static parseDirectory(dirPath: string): RawResult[] {
        const files = fs.readdirSync(dirPath)
            .filter(file => file.endsWith('.csv'))
            .sort(); // Ensure consistent ordering

        const allResults: RawResult[] = [];

        for (const file of files) {
            const filePath = path.join(dirPath, file);
            console.log(`  - Parsing ${file}...`);
            const results = this.parseFile(filePath);
            allResults.push(...results);
        }

        return allResults;
    }

    /**
     * Parse all CSV files in a directory for both individual and relay results
     */
    static parseDirectoryWithRelays(dirPath: string): {
        individuals: RawResult[],
        relays: RelayResult[]
    } {
        const files = fs.readdirSync(dirPath)
            .filter(file => file.endsWith('.csv'))
            .sort(); // Ensure consistent ordering

        const allIndividuals: RawResult[] = [];
        const allRelays: RelayResult[] = [];

        for (const file of files) {
            const filePath = path.join(dirPath, file);
            console.log(`  - Parsing ${file}...`);
            const { individuals, relays } = this.parseFileWithRelays(filePath);
            allIndividuals.push(...individuals);
            allRelays.push(...relays);
        }

        console.log(`✓ Parsed ${allIndividuals.length} individual results and ${allRelays.length} relay results`);

        return { individuals: allIndividuals, relays: allRelays };
    }

    /**
     * Get all subdirectories in the input folder
     */
    static getInputFolders(inputDir: string): string[] {
        return fs.readdirSync(inputDir)
            .filter(item => {
                const itemPath = path.join(inputDir, item);
                return fs.statSync(itemPath).isDirectory();
            })
            .sort();
    }
}
