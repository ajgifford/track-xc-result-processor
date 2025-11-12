import * as XLSX from 'xlsx';
import * as fs from 'fs';

interface AthleteData {
    name: string;
    team: string;
    times: (string | null)[];
    timesSeconds: (number | null)[];
}

interface Ranking {
    rank: number;
    athlete: string;
    team: string;
    bestTimeSeconds: number;
    bestTime: string;
    bestTimeMeet: string;
    meet1: string;
    meet2: string;
    meet3: string;
    cyoFinal: string;
    borderWar: string;
}

// Helper function to convert Excel date/time to seconds
function excelTimeToSeconds(excelDate: any): number | null {
    if (!excelDate || excelDate === '---') return null;
    
    const date = new Date(excelDate);
    const minutes = date.getUTCMinutes();
    const seconds = date.getUTCSeconds();
    const milliseconds = date.getUTCMilliseconds();
    
    return minutes * 60 + seconds + milliseconds / 1000;
}

// Helper function to format seconds to MM:SS.s
function formatTime(seconds: number | null): string {
    if (seconds === null) return '-';
    
    const minutes = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${minutes}:${secs.padStart(4, '0')}`;
}

// Main processing function
function processRaceResults(filepath: string, outputPath: string): void {
    // Read the Excel file
    const fileBuffer = fs.readFileSync(filepath);
    const workbook = XLSX.read(fileBuffer, {
        cellStyles: true,
        cellFormula: true,
        cellDates: true,
        cellNF: true,
        sheetStubs: true
    });

    // Parse all the meets
    const meets = ['Meet 1', 'Meet 2', 'Meet 3', 'CYO Final', 'Border War'];
    const allData: Record<string, AthleteData> = {};

    meets.forEach((meetName, meetIndex) => {
        const sheet = workbook.Sheets[meetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
        
        // Start from row 2 (index 2) to skip title and header rows
        for (let i = 2; i < data.length; i++) {
            const row = data[i] as any[];
            if (!row || !row[1]) continue;
            
            const athlete = row[1] as string;
            const team = row[3] as string;
            const timeRaw = row[5];
            const timeSeconds = excelTimeToSeconds(timeRaw);
            const timeFormatted = formatTime(timeSeconds);
            
            if (!allData[athlete]) {
                allData[athlete] = {
                    name: athlete,
                    team: team,
                    times: [null, null, null],
                    timesSeconds: [null, null, null]
                };
            }
            
            allData[athlete].times[meetIndex] = timeFormatted;
            allData[athlete].timesSeconds[meetIndex] = timeSeconds;
        }
    });

    // Calculate best times and create rankings
    const rankings: Ranking[] = [];

    Object.values(allData).forEach(athlete => {
        // Check if athlete has any times in meets other than Border War (indices 0-3)
        const regularMeetTimes = athlete.timesSeconds.slice(0, 4).filter(t => t !== null);
        
        // Skip athletes who only ran in Border War
        if (regularMeetTimes.length === 0) return;
        
        const validTimes = athlete.timesSeconds.filter(t => t !== null) as number[];
        if (validTimes.length === 0) return;
        
        const bestTimeSeconds = Math.min(...validTimes);
        const bestTimeIndex = athlete.timesSeconds.indexOf(bestTimeSeconds);
        const bestTimeMeet = meets[bestTimeIndex]; //`Meet ${bestTimeIndex + 1}`;
        
        rankings.push({
            rank: 0, // Will be set after sorting
            athlete: athlete.name,
            team: athlete.team,
            bestTimeSeconds: bestTimeSeconds,
            bestTime: formatTime(bestTimeSeconds),
            bestTimeMeet: bestTimeMeet,
            meet1: athlete.times[0] || '-',
            meet2: athlete.times[1] || '-',
            meet3: athlete.times[2] || '-',
            cyoFinal: athlete.times[3] || '-',
            borderWar: athlete.times[4] || '-',
        });
    });

    // Sort by best time (ascending)
    rankings.sort((a, b) => a.bestTimeSeconds - b.bestTimeSeconds);

    // Add rank
    rankings.forEach((runner, index) => {
        runner.rank = index + 1;
    });

    // Create CSV content
    const csvRows: string[] = [];
    csvRows.push('Rank,Athlete,Team,Best Time,Best Time Meet,Meet 1,Meet 2,Meet 3,CYO Final,Border War');

    rankings.forEach(r => {
        csvRows.push(`${r.rank},"${r.athlete}","${r.team}",${r.bestTime},${r.bestTimeMeet},${r.meet1},${r.meet2},${r.meet3},${r.cyoFinal},${r.borderWar}`);
    });

    const csvContent = csvRows.join('\n');

    // Write to file
    fs.writeFileSync(outputPath, csvContent, 'utf-8');

    console.log(`✓ Rankings generated successfully!`);
    console.log(`✓ Total athletes ranked: ${rankings.length}`);
    console.log(`✓ Output file: ${outputPath}`);
}

// Parse command-line arguments
const args = process.argv.slice(2);
const inputFile = args[0] || './MeetResults.xlsx';
const outputFile = args[1] || './Rankings.csv';

console.log(`Input file: ${inputFile}`);
console.log(`Output file: ${outputFile}`);

processRaceResults(inputFile, outputFile);
