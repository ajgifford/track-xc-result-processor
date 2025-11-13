#!/usr/bin/env node
/**
 * Cross Country Result Processor
 *
 * Processes CSV files from cross country meets and generates:
 * 1. Per-meet team results (JSON + TXT)
 * 2. Event rankings by race (age group/gender)
 * 3. Season-long team results
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { XCCSVParser } from './xc-csv-parser';
import { XCTeamResultsExtractor } from './xc-team-results';
import { XCEventRankingsGenerator } from './xc-event-rankings';
import { XCSeasonResultsGenerator } from './xc-season-results';
import { ScoringConfig } from './xc-types';

// Configuration
const INPUT_DIR = path.join(__dirname, '..', '..', 'input', 'xc');
const OUTPUT_BASE_DIR = path.join(__dirname, '..', '..', 'output', 'xc');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline question
function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

/**
 * Main processing function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Cross Country Result Processor');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Get available meet folders
    const folders = XCCSVParser.getMeetFolders(INPUT_DIR);

    if (folders.length === 0) {
      console.error(`❌ No folders found in ${INPUT_DIR}`);
      process.exit(1);
    }

    console.log('Available meet folders:');
    folders.forEach((folder, index) => {
      console.log(`  ${index + 1}. ${folder}`);
    });

    const folderAnswer = await question('\nEnter folder name or number to process: ');
    const folderIndex = parseInt(folderAnswer) - 1;
    const selectedFolder = isNaN(folderIndex) ? folderAnswer : folders[folderIndex];

    if (!folders.includes(selectedFolder) && !fs.existsSync(path.join(INPUT_DIR, selectedFolder))) {
      console.error(`❌ Folder "${selectedFolder}" not found`);
      process.exit(1);
    }

    const meetDate = selectedFolder; // Folder name is the date

    // Step 2: Get meet name
    const meetNameAnswer = await question('\nEnter meet name (e.g., "CYO Meet 1", "Border War"): ');
    const meetName = meetNameAnswer.trim() || meetDate;

    // Step 3: Get season year
    const seasonAnswer = await question('\nEnter season year (4 digits, e.g., 2025): ');
    const season = seasonAnswer.match(/\d{4}/) ? seasonAnswer : new Date().getFullYear().toString();

    console.log(`\n📁 Processing folder: ${selectedFolder}`);
    console.log(`📅 Meet: ${meetName}`);
    console.log(`📅 Season: ${season}\n`);

    // Step 4: Parse all CSV files in the folder
    const folderPath = path.join(INPUT_DIR, selectedFolder);
    console.log('Parsing CSV files...');
    const allResults = XCCSVParser.parseMeetDirectory(folderPath, meetDate);

    if (allResults.length === 0) {
      console.error('❌ No results found in CSV files');
      process.exit(1);
    }

    console.log(`✓ Parsed ${allResults.length} results from ${XCCSVParser.getUniqueTeams(allResults).length} teams\n`);

    // Create output directories
    const seasonOutputDir = path.join(OUTPUT_BASE_DIR, season);
    const meetOutputDir = path.join(seasonOutputDir, meetDate);
    const rankingsDir = path.join(seasonOutputDir, 'rankings');
    const seasonResultsDir = path.join(seasonOutputDir, 'season_results');

    // Step 5: Team Scoring Configuration
    console.log('─────────────────────────────────────────────────────────');
    console.log('TEAM SCORING CONFIGURATION');
    console.log('─────────────────────────────────────────────────────────\n');

    const includeScoringAnswer = await question('Include team scoring in results? (y/n, default: y): ');
    const includeScoring = !includeScoringAnswer.trim() || includeScoringAnswer.toLowerCase().startsWith('y');

    let scoringConfig: ScoringConfig = {
      includeScoring: false,
      scoringPlaces: 5,
      displacementRunners: 2
    };

    if (includeScoring) {
      const scoringPlacesAnswer = await question('How many places score? (default: 5): ');
      const scoringPlaces = parseInt(scoringPlacesAnswer) || 5;

      const displacementAnswer = await question('How many displacement runners? (default: 2): ');
      const displacementRunners = parseInt(displacementAnswer) || 2;

      scoringConfig = {
        includeScoring: true,
        scoringPlaces,
        displacementRunners
      };

      console.log(`\n✓ Scoring: Top ${scoringPlaces} runners score, ${displacementRunners} displacement runners\n`);
    } else {
      console.log('\n✓ Team scoring disabled\n');
    }

    // Step 6: Team Results
    console.log('─────────────────────────────────────────────────────────');
    console.log('1. TEAM RESULTS EXTRACTION');
    console.log('─────────────────────────────────────────────────────────\n');

    XCTeamResultsExtractor.extractAllTeams(
      allResults,
      meetName,
      meetDate,
      season,
      scoringConfig,
      meetOutputDir
    );

    // Step 7: Event Rankings
    console.log('\n─────────────────────────────────────────────────────────');
    console.log('2. EVENT RANKINGS GENERATION');
    console.log('─────────────────────────────────────────────────────────\n');

    const includeInRankingsAnswer = await question(
      'Include this meet in event rankings? (y/n, default: y): '
    );
    const includeInRankings = !includeInRankingsAnswer.trim() ||
      includeInRankingsAnswer.toLowerCase().startsWith('y');

    if (includeInRankings) {
      const mergeAnswer = await question(
        'Merge with existing rankings if they exist? (y/n, default: y): '
      );
      const shouldMerge = !mergeAnswer.trim() || mergeAnswer.toLowerCase().startsWith('y');

      XCEventRankingsGenerator.processRankings(
        allResults,
        meetName,
        season,
        rankingsDir,
        shouldMerge
      );
    } else {
      console.log('✓ Skipped event rankings update');
    }

    // Step 8: Season Results
    console.log('\n─────────────────────────────────────────────────────────');
    console.log('3. SEASON RESULTS UPDATE');
    console.log('─────────────────────────────────────────────────────────');

    XCSeasonResultsGenerator.updateSeasonResults(
      allResults,
      meetName,
      meetDate,
      season,
      seasonResultsDir
    );

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  PROCESSING COMPLETE!');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('Output directories:');
    console.log(`  📁 Meet results: ${meetOutputDir}`);
    console.log(`  📊 Event rankings: ${rankingsDir}`);
    console.log(`  📈 Season results: ${seasonResultsDir}`);
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the main function
main();
