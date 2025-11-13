#!/usr/bin/env node
/**
 * Test script to verify processing without interactive prompts
 */

import * as fs from 'fs';
import * as path from 'path';
import { CSVParser } from '../common/csv-parser';
import { TeamResultsExtractor } from './team-results';
import { EventRankingsGenerator } from './event-rankings';
import { AthleteResultsGenerator } from './athlete-results';

const INPUT_DIR = path.join(__dirname, '..', '..', 'input', 'track');
const OUTPUT_BASE_DIR = path.join(__dirname, '..', '..', 'output', 'track');

async function test() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Track & Field Result Processor - TEST RUN');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Test configuration
    const testFolder = '04-26-2025';
    const season = '2025';
    const teamIdentifier = 'POP1';

    console.log(`📁 Processing folder: ${testFolder}`);
    console.log(`📅 Season: ${season}`);
    console.log(`🏫 Team: ${teamIdentifier}\n`);

    // Parse CSV files
    const folderPath = path.join(INPUT_DIR, testFolder);
    console.log('Parsing CSV files...');
    const allResults = CSVParser.parseDirectory(folderPath);
    console.log(`✓ Parsed ${allResults.length} results\n`);

    // Create output directories
    const seasonOutputDir = path.join(OUTPUT_BASE_DIR, season);
    const meetOutputDir = path.join(seasonOutputDir, testFolder);
    const rankingsOutputDir = path.join(seasonOutputDir, 'rankings');

    if (!fs.existsSync(meetOutputDir)) {
        fs.mkdirSync(meetOutputDir, { recursive: true });
    }

    // 1. Team Results
    console.log('─────────────────────────────────────────────────────────');
    console.log('1. TEAM RESULTS EXTRACTION');
    console.log('─────────────────────────────────────────────────────────\n');

    const teamResults = TeamResultsExtractor.extractTeamResults(allResults, teamIdentifier);
    const teamOutputPath = path.join(meetOutputDir, `team_results_${teamIdentifier}.json`);
    TeamResultsExtractor.saveToJSON(teamResults, teamOutputPath);

    // 2. Event Rankings
    console.log('\n─────────────────────────────────────────────────────────');
    console.log('2. EVENT RANKINGS GENERATION');
    console.log('─────────────────────────────────────────────────────────\n');

    const categories = EventRankingsGenerator.generateRankings(allResults, season);
    EventRankingsGenerator.saveToJSON(categories, rankingsOutputDir, season);

    // 3. Individual Athletes - All athletes, single file (season-wide)
    console.log('\n─────────────────────────────────────────────────────────');
    console.log('3. INDIVIDUAL ATHLETE RESULTS');
    console.log('─────────────────────────────────────────────────────────\n');

    const athleteMap = AthleteResultsGenerator.generateAthleteResults(allResults);
    const athleteOutputPath = path.join(seasonOutputDir, 'individual_results.json');
    AthleteResultsGenerator.saveAllToSingleFile(athleteMap, athleteOutputPath);
    AthleteResultsGenerator.printSummary(athleteMap);

    // 4. Individual Athletes - Specific team, individual files (season-wide)
    console.log('\n─────────────────────────────────────────────────────────');
    console.log('4. TEAM-SPECIFIC ATHLETE RESULTS');
    console.log('─────────────────────────────────────────────────────────\n');

    const teamAthleteMap = AthleteResultsGenerator.filterByTeam(athleteMap, teamIdentifier);
    const athleteOutputDir = path.join(seasonOutputDir, 'individual_athletes');
    AthleteResultsGenerator.saveToIndividualFiles(teamAthleteMap, athleteOutputDir);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  TEST COMPLETE!');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('Output directories:');
    console.log(`  📁 Meet results: ${meetOutputDir}`);
    console.log(`  📊 Event rankings: ${rankingsOutputDir}`);
    console.log('\n');
}

test().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});
