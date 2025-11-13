#!/usr/bin/env node
/**
 * Track & Field Result Processor
 *
 * Processes CSV files from track and field meets and generates:
 * 1. Team results recap
 * 2. Event rankings by gender and grade
 * 3. Individual athlete results
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { CSVParser } from '../common/csv-parser';
import { TeamResultsExtractor } from './team-results';
import { EventRankingsGenerator } from './event-rankings';
import { RelayRankingsGenerator } from './relay-rankings';
import { AthleteResultsGenerator } from './athlete-results';
import { RawResult, RelayResult } from '../common/types';

// Configuration
const INPUT_DIR = path.join(__dirname, '..', '..', 'input', 'track');
const OUTPUT_BASE_DIR = path.join(__dirname, '..', '..', 'output', 'track');
const DEFAULT_TEAM = 'SMA1'; // Saint Michael CYOKS

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
    console.log('  Track & Field Result Processor');
    console.log('═══════════════════════════════════════════════════════════\n');

    try {
        // Step 1: Get available input folders
        const folders = CSVParser.getInputFolders(INPUT_DIR);

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

        // Step 2: Get season year
        const seasonAnswer = await question('\nEnter season year (4 digits, e.g., 2025): ');
        const season = seasonAnswer.match(/\d{4}/) ? seasonAnswer : new Date().getFullYear().toString();

        console.log(`\n📁 Processing folder: ${selectedFolder}`);
        console.log(`📅 Season: ${season}\n`);

        // Step 3: Parse all CSV files in the folder (including relays)
        const folderPath = path.join(INPUT_DIR, selectedFolder);
        console.log('Parsing CSV files...');
        const { individuals, relays } = CSVParser.parseDirectoryWithRelays(folderPath);

        if (individuals.length === 0 && relays.length === 0) {
            console.error('❌ No results found in CSV files');
            process.exit(1);
        }

        // Create output directories
        const seasonOutputDir = path.join(OUTPUT_BASE_DIR, season);
        const meetOutputDir = path.join(seasonOutputDir, selectedFolder);
        const rankingsOutputDir = path.join(seasonOutputDir, 'rankings');

        if (!fs.existsSync(meetOutputDir)) {
            fs.mkdirSync(meetOutputDir, { recursive: true });
        }

        // Step 4: Team Results
        console.log('─────────────────────────────────────────────────────────');
        console.log('1. TEAM RESULTS EXTRACTION');
        console.log('─────────────────────────────────────────────────────────\n');

        const teams = TeamResultsExtractor.getUniqueTeams(individuals);
        console.log(`Found ${teams.length} teams in results:\n`);

        teams.forEach((team, index) => {
            console.log(`  ${index + 1}. ${team.code} - ${team.name}`);
        });

        const extractAllAnswer = await question('\nExtract results for (1) all teams or (2) specific team? Enter 1 or 2 (default: 2): ');
        const extractAll = extractAllAnswer.trim() === '1';

        if (extractAll) {
            console.log('\nExtracting results for all teams...');
            for (const team of teams) {
                const teamResults = TeamResultsExtractor.extractTeamResultsWithRelays(
                    individuals,
                    relays,
                    team.code
                );

                if (teamResults.length > 0) {
                    const teamOutputPath = path.join(meetOutputDir, `team_results_${team.code}.json`);
                    TeamResultsExtractor.saveToJSON(teamResults, teamOutputPath);
                }
            }
        } else {
            let teamResults: any[] = [];
            let attempts = 0;
            const maxAttempts = 3;

            while (teamResults.length === 0 && attempts < maxAttempts) {
                const teamAnswer = await question(`\nEnter team code or name (default: ${DEFAULT_TEAM}): `);
                const teamIdentifier = teamAnswer.trim() || DEFAULT_TEAM;

                console.log(`\nExtracting results for team: ${teamIdentifier}...`);
                teamResults = TeamResultsExtractor.extractTeamResultsWithRelays(
                    individuals,
                    relays,
                    teamIdentifier
                );

                if (teamResults.length > 0) {
                    const teamOutputPath = path.join(meetOutputDir, `team_results_${teamIdentifier}.json`);
                    TeamResultsExtractor.saveToJSON(teamResults, teamOutputPath);
                } else {
                    attempts++;
                    console.log(`\n⚠ No results found for team: "${teamIdentifier}"`);

                    if (attempts < maxAttempts) {
                        console.log(`\nAvailable teams:`);
                        teams.forEach((team, index) => {
                            console.log(`  ${index + 1}. ${team.code} - ${team.name}`);
                        });

                        const retryAnswer = await question('\nTry again? (y/n, default: y): ');
                        if (retryAnswer.trim().toLowerCase() === 'n') {
                            console.log('Skipping team results extraction.');
                            break;
                        }
                    } else {
                        console.log('Maximum attempts reached. Skipping team results extraction.');
                    }
                }
            }
        }

        // Step 5: Event Rankings
        console.log('\n─────────────────────────────────────────────────────────');
        console.log('2. EVENT RANKINGS GENERATION');
        console.log('─────────────────────────────────────────────────────────\n');

        console.log('Generating event rankings by gender and grade...');

        // Check if we should merge with existing rankings
        const mergeAnswer = await question(
            `Merge with existing rankings if they exist? (y/n, default: y): `
        );
        const shouldMerge = !mergeAnswer.trim() || mergeAnswer.toLowerCase().startsWith('y');

        let categories = EventRankingsGenerator.generateRankings(individuals, season);

        if (shouldMerge && fs.existsSync(rankingsOutputDir)) {
            console.log('\nMerging with existing individual rankings...');
            categories = EventRankingsGenerator.mergeWithExisting(categories, rankingsOutputDir, season);
        }

        EventRankingsGenerator.saveToJSON(categories, rankingsOutputDir, season);

        // Step 5b: Relay Rankings
        if (relays.length > 0) {
            console.log('\nGenerating relay rankings...');

            let relayCategories = RelayRankingsGenerator.generateRelayRankings(relays, season);

            if (shouldMerge && fs.existsSync(rankingsOutputDir)) {
                console.log('Merging with existing relay rankings...');
                relayCategories = RelayRankingsGenerator.mergeWithExisting(relayCategories, rankingsOutputDir, season);
            }

            RelayRankingsGenerator.saveToJSON(relayCategories, rankingsOutputDir, season);
        } else {
            console.log('\n⚠ No relay results to rank');
        }

        // Step 6: Individual Athlete Results
        console.log('\n─────────────────────────────────────────────────────────');
        console.log('3. INDIVIDUAL ATHLETE RESULTS');
        console.log('─────────────────────────────────────────────────────────\n');

        const scopeAnswer = await question(
            'Generate for (1) all athletes or (2) specific team? Enter 1 or 2: '
        );

        let athleteMap = AthleteResultsGenerator.generateAthleteResultsWithRelays(individuals, relays);

        if (scopeAnswer.trim() === '2') {
            let attempts = 0;
            const maxAttempts = 3;
            let filteredMap = new Map();

            while (filteredMap.size === 0 && attempts < maxAttempts) {
                const athleteTeamAnswer = await question(`Enter team code or name (default: ${DEFAULT_TEAM}): `);
                const athleteTeamIdentifier = athleteTeamAnswer.trim() || DEFAULT_TEAM;
                console.log(`\nFiltering athletes for team: ${athleteTeamIdentifier}...`);
                filteredMap = AthleteResultsGenerator.filterByTeam(athleteMap, athleteTeamIdentifier);

                if (filteredMap.size === 0) {
                    attempts++;
                    // Note: filterByTeam already prints available teams when no match found

                    if (attempts < maxAttempts) {
                        const retryAnswer = await question('\nTry again? (y/n, default: y): ');
                        if (retryAnswer.trim().toLowerCase() === 'n') {
                            console.log('Using all athletes instead.');
                            filteredMap = athleteMap;
                            break;
                        }
                    } else {
                        console.log('Maximum attempts reached. Using all athletes instead.');
                        filteredMap = athleteMap;
                    }
                }
            }

            athleteMap = filteredMap;
        }

        const formatAnswer = await question(
            '\nSave as (1) single file or (2) individual files? Enter 1 or 2 (default: 2): '
        );

        const saveIndividualFiles = !formatAnswer.trim() || formatAnswer.trim() === '2';

        // Check if we should merge with existing athlete results
        const mergeAthleteAnswer = await question(
            'Merge with existing athlete results if they exist? (y/n, default: y): '
        );
        const shouldMergeAthletes = !mergeAthleteAnswer.trim() || mergeAthleteAnswer.toLowerCase().startsWith('y');

        if (shouldMergeAthletes) {
            if (saveIndividualFiles) {
                const athleteOutputDir = path.join(seasonOutputDir, 'individual_athletes');
                if (fs.existsSync(athleteOutputDir)) {
                    console.log('\nMerging with existing athlete results from individual files...');
                    const existingMap = AthleteResultsGenerator.loadFromIndividualFiles(athleteOutputDir);
                    athleteMap = AthleteResultsGenerator.mergeAthleteMaps(existingMap, athleteMap);
                }
            } else {
                const athleteOutputPath = path.join(seasonOutputDir, 'individual_results.json');
                if (fs.existsSync(athleteOutputPath)) {
                    console.log('\nMerging with existing athlete results from single file...');
                    const existingMap = AthleteResultsGenerator.loadFromSingleFile(athleteOutputPath);
                    athleteMap = AthleteResultsGenerator.mergeAthleteMaps(existingMap, athleteMap);
                }
            }
        }

        // Save to season directory (not meet directory)
        if (saveIndividualFiles) {
            const athleteOutputDir = path.join(seasonOutputDir, 'individual_athletes');
            AthleteResultsGenerator.saveToIndividualFiles(athleteMap, athleteOutputDir);
        } else {
            const athleteOutputPath = path.join(seasonOutputDir, 'individual_results.json');
            AthleteResultsGenerator.saveAllToSingleFile(athleteMap, athleteOutputPath);
        }

        AthleteResultsGenerator.printSummary(athleteMap);

        // Summary
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('  PROCESSING COMPLETE!');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log('Output directories:');
        console.log(`  📁 Meet results: ${meetOutputDir}`);
        console.log(`  📊 Event rankings: ${rankingsOutputDir}`);
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
