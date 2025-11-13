#!/usr/bin/env node
/**
 * Advanced Team Entry Optimizer
 *
 * Generates optimized meet entries accounting for likely competition.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { AdvancedTeamEntryOptimizer } from './team-entry-optimizer-advanced';

const OUTPUT_BASE_DIR = path.join(__dirname, '..', '..', 'output', 'track');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Team Entry Optimizer - ADVANCED METHOD');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('This optimizer predicts competition from other teams to');
    console.log('provide more realistic projected placements and points.\n');

    try {
        // Check for available seasons
        if (!fs.existsSync(OUTPUT_BASE_DIR)) {
            console.error(`❌ Output directory not found: ${OUTPUT_BASE_DIR}`);
            console.error('Please run the result processor first to generate rankings.');
            process.exit(1);
        }

        const seasons = fs.readdirSync(OUTPUT_BASE_DIR)
            .filter(item => {
                const itemPath = path.join(OUTPUT_BASE_DIR, item);
                return fs.statSync(itemPath).isDirectory();
            })
            .sort();

        if (seasons.length === 0) {
            console.error('❌ No season data found.');
            process.exit(1);
        }

        console.log('Available seasons:');
        seasons.forEach((season, index) => {
            console.log(`  ${index + 1}. ${season}`);
        });

        const seasonAnswer = await question('\nEnter season year (or number): ');
        const seasonIndex = parseInt(seasonAnswer) - 1;
        let season: string;

        // Check if it's a valid index selection
        if (!isNaN(seasonIndex) && seasonIndex >= 0 && seasonIndex < seasons.length) {
            season = seasons[seasonIndex];
        } else {
            // Assume it's a season year entered directly
            season = seasonAnswer.trim();
        }

        const rankingsDir = path.join(OUTPUT_BASE_DIR, season, 'rankings');

        if (!fs.existsSync(rankingsDir)) {
            console.error(`❌ Season ${season} not found.`);
            process.exit(1);
        }

        // Get team name
        const teamName = await question('\nEnter school/team name: ');

        // Get gender/grade scope
        console.log('\nOptimization scope:');
        console.log('  1. Single gender/grade');
        console.log('  2. All gender/grades for this school');

        const scopeAnswer = await question('\nEnter 1 or 2: ');

        const results: Array<{ result: any; outputPrefix: string }> = [];

        if (scopeAnswer.trim() === '1') {
            // Single gender/grade
            const genderAnswer = await question('\nEnter gender (Male/Female or M/F): ');
            const gender = genderAnswer.toLowerCase().startsWith('m') ? 'Male' : 'Female';

            const gradeAnswer = await question('Enter grade (5th grade, 6th grade, 7th grade, 8th grade): ');
            const grade = gradeAnswer.includes('grade') ? gradeAnswer : `${gradeAnswer} grade`;

            console.log(`\nOptimizing for ${teamName} - ${gender} ${grade}...\n`);

            const result = AdvancedTeamEntryOptimizer.optimize(
                rankingsDir,
                season,
                teamName,
                gender,
                grade
            );

            results.push({
                result,
                outputPrefix: `${teamName.replace(/\s+/g, '_')}_${gender}_${grade.replace(/\s+/g, '_')}`
            });
        } else {
            // All gender/grades
            const genders = ['Male', 'Female'];
            const grades = ['5th grade', '6th grade', '7th grade', '8th grade'];

            console.log(`\nOptimizing for ${teamName} - All gender/grades...\n`);

            for (const gender of genders) {
                for (const grade of grades) {
                    try {
                        console.log(`  Processing ${gender} ${grade}...`);
                        const result = AdvancedTeamEntryOptimizer.optimize(
                            rankingsDir,
                            season,
                            teamName,
                            gender,
                            grade
                        );

                        results.push({
                            result,
                            outputPrefix: `${teamName.replace(/\s+/g, '_')}_${gender}_${grade.replace(/\s+/g, '_')}`
                        });
                    } catch (error) {
                        console.log(`    ⚠ No data for ${gender} ${grade}`);
                    }
                }
            }
        }

        // Create output directory
        const outputDir = path.join(OUTPUT_BASE_DIR, season, 'optimized_entries', teamName.replace(/\s+/g, '_'));
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Save all results
        console.log('\n─────────────────────────────────────────────────────────');
        console.log('SAVING RESULTS');
        console.log('─────────────────────────────────────────────────────────\n');

        for (const { result, outputPrefix } of results) {
            const jsonPath = path.join(outputDir, `${outputPrefix}_advanced.json`);
            const txtPath = path.join(outputDir, `${outputPrefix}_advanced.txt`);

            AdvancedTeamEntryOptimizer.saveJSON(result, jsonPath);
            AdvancedTeamEntryOptimizer.saveReport(result, txtPath);

            console.log(`✓ ${result.gender} ${result.grade}: ${result.totalProjectedPoints} points`);
            console.log(`  JSON: ${jsonPath}`);
            console.log(`  Report: ${txtPath}\n`);
        }

        // Print summary
        const totalPoints = results.reduce((sum, r) => sum + r.result.totalProjectedPoints, 0);

        console.log('═══════════════════════════════════════════════════════════');
        console.log('  OPTIMIZATION COMPLETE!');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log(`Total Projected Points (all categories): ${totalPoints}`);
        console.log(`Output directory: ${outputDir}\n`);

    } catch (error) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    } finally {
        rl.close();
    }
}

main();
