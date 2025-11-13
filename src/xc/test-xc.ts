#!/usr/bin/env node
/**
 * Test script for XC processing (non-interactive)
 */

import * as path from 'path';
import { XCCSVParser } from './xc-csv-parser';
import { XCTeamResultsExtractor } from './xc-team-results';
import { XCEventRankingsGenerator } from './xc-event-rankings';
import { XCSeasonResultsGenerator } from './xc-season-results';
import { ScoringConfig } from './xc-types';

const INPUT_DIR = path.join(__dirname, '..', '..', 'input', 'xc');
const OUTPUT_BASE_DIR = path.join(__dirname, '..', '..', 'output', 'xc');

async function test() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Cross Country Result Processor - TEST');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Test configuration
  const meetDate = '09-27-2025';
  const meetName = 'CYO Meet 1';
  const season = '2025';

  console.log(`📁 Processing: ${meetDate}`);
  console.log(`📅 Meet: ${meetName}`);
  console.log(`📅 Season: ${season}\n`);

  // Parse CSV files
  const folderPath = path.join(INPUT_DIR, meetDate);
  console.log('Parsing CSV files...');
  const allResults = XCCSVParser.parseMeetDirectory(folderPath, meetDate);

  console.log(`✓ Parsed ${allResults.length} results from ${XCCSVParser.getUniqueTeams(allResults).length} teams\n`);

  // Create output directories
  const seasonOutputDir = path.join(OUTPUT_BASE_DIR, season);
  const meetOutputDir = path.join(seasonOutputDir, meetDate);
  const rankingsDir = path.join(seasonOutputDir, 'rankings');
  const seasonResultsDir = path.join(seasonOutputDir, 'season_results');

  // Scoring config
  const scoringConfig: ScoringConfig = {
    includeScoring: true,
    scoringPlaces: 5,
    displacementRunners: 2
  };

  // 1. Team Results
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

  // 2. Event Rankings
  console.log('\n─────────────────────────────────────────────────────────');
  console.log('2. EVENT RANKINGS GENERATION');
  console.log('─────────────────────────────────────────────────────────\n');

  XCEventRankingsGenerator.processRankings(
    allResults,
    meetName,
    season,
    rankingsDir,
    false // Don't merge for this test
  );

  // 3. Season Results
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

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  TEST COMPLETE!');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('Output directories:');
  console.log(`  📁 Meet results: ${meetOutputDir}`);
  console.log(`  📊 Event rankings: ${rankingsDir}`);
  console.log(`  📈 Season results: ${seasonResultsDir}`);
  console.log('\n');
}

test().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
