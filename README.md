# Track & Field and Cross Country Result Processor

Utilities to process Track & Field and Cross Country (XC) results from CSV files and generate structured JSON reports.

## Features

### Track & Field Processing

Processes CSV files from track and field meets and generates:

1. **Team Results Recap** - Extract all results for a specific team
2. **Event Rankings** - Event-by-event rankings categorized by gender and age group (grade)
3. **Individual Athlete Results** - Performance records across the season for each athlete
4. **Relay Results** - Team relay results with athlete rosters
5. **Team Entry Optimization** - Maximize team scoring with two optimization methods

### Cross Country Processing

Processes CSV files from cross country meets and generates:

1. **Per-Meet Team Results** - Team results for each meet (JSON + TXT) with configurable scoring
2. **Event Rankings** - Season-long rankings by race (age group/gender) with best times
3. **Season Results** - Season-long team results showing progress over time across all meets

### Team Entry Optimization (Track Only)

Two optimization methods to maximize team scoring:

1. **Simple Optimizer** (`optimize-simple`) - Uses team's current rankings to recommend entries
2. **Advanced Optimizer** (`optimize-advanced`) - Predicts competition from other teams for more realistic projections

Both optimizers:
- Respect 4-event limit per athlete
- Enforce 1600m+800m rule (max 1 additional running event, 4th must be field)
- Maximize projected points (1st=8, 2nd=6, 3rd=4, 4th=2, 5th=1)
- Generate both JSON and human-readable reports

## Installation

```bash
# Install dependencies
yarn install
# or
npm install
```

## Usage

### Track & Field Processing

```bash
# Run the interactive processor
npm run process-track
```

The script will prompt you for:
1. **Meet folder**: Select which folder in `input/track/` to process
2. **Season year**: Enter a 4-digit year (e.g., 2025)
3. **Team extraction**: Extract all teams or specific team
4. **Team identifier**: Enter team code or name for team results (default: SMA1)
5. **Merge rankings**: Whether to merge with existing season rankings
6. **Athlete scope**: Generate for all athletes or specific team
7. **Output format**: Single file or individual files per athlete

### Cross Country Processing

```bash
# Run the interactive processor
npm run process-xc
```

The script will prompt you for:
1. **Meet folder**: Select which folder in `input/xc/` to process
2. **Meet name**: Enter meet name (e.g., "CYO Meet 1", "Border War")
3. **Season year**: Enter a 4-digit year (e.g., 2025)
4. **Team scoring**: Include team scoring in results? (y/n)
5. **Scoring places**: How many places score? (default: 5)
6. **Displacement runners**: How many displacement runners? (default: 2)
7. **Include in rankings**: Include this meet in event rankings? (y/n)
8. **Merge rankings**: Whether to merge with existing rankings

### Team Entry Optimization (Track)

```bash
# Simple optimizer (uses current rankings only)
npm run optimize-simple

# Advanced optimizer (predicts competition)
npm run optimize-advanced
```

Both optimizers will prompt you for:
1. **Season**: Select which season's rankings to use
2. **School/Team name**: Enter the team name
3. **Scope**: Single gender/grade or all gender/grades for the school
4. **Gender** (if single): Male or Female
5. **Grade** (if single): 5th, 6th, 7th, or 8th grade

Output includes:
- JSON file with detailed optimization results
- Human-readable text report with projected points
- Event-by-event breakdown of recommended entries

### Testing

```bash
# Test track processing (non-interactive)
npm run test-track

# Test XC processing (non-interactive)
npm run test-xc
```

## Input File Structure

Place your CSV files in organized folders:

```
input/
├── track/                     # Track & Field meets
│   ├── 04-26-2025/
│   │   ├── CYO3_Morning_Track.csv
│   │   ├── CYO3_Morning_Field.csv
│   │   ├── CYO3_Afternoon_Track.csv
│   │   └── CYO3_Afternoon_Field.csv
│   └── 05-03-2025/
│       └── ...
└── xc/                        # Cross Country meets
    ├── 09-27-2025/
    │   ├── 34girls.csv        # 3rd & 4th Grade Girls (1000m)
    │   ├── 34boys.csv         # 3rd & 4th Grade Boys (1000m)
    │   ├── 56girls.csv        # 5th & 6th Grade Girls (1 mile)
    │   ├── 56boys.csv         # 5th & 6th Grade Boys (1 mile)
    │   ├── 78girls.csv        # 7th & 8th Grade Girls (1.5 mile)
    │   └── 78boys.csv         # 7th & 8th Grade Boys (1.5 mile)
    └── 10-04-2025/
        └── ...
```

**Track CSV files** should be exported from MeetPro by DirectAthletics.

**XC CSV files** should contain columns: Place, Athlete, Yr., Team, Score, Time, Gap, Avg. Mile

## Output File Structure

### Track & Field Outputs

```
output/
└── track/
    └── 2025/                                       # Season
        ├── 04-26-2025/                             # Per-meet results
        │   └── team_results_SMA1.json              # Team-specific results
        ├── individual_results.json                 # Season-wide athlete results (or)
        ├── individual_athletes/                    # Season-wide individual files per athlete
        │   ├── John_Doe.json
        │   └── Jane_Smith.json
        ├── rankings/                               # Season-wide event rankings
        │   ├── event_rankings_2025_60.json         # Individual event rankings
        │   ├── event_rankings_2025_100.json
        │   ├── relay_rankings_2025_DMR.json        # Relay rankings
        │   └── ...
        └── optimized_entries/                      # Team entry optimizations
            └── Saint_Michael_CYOKS/
                ├── Saint_Michael_CYOKS_Male_5th_grade_simple.json
                ├── Saint_Michael_CYOKS_Male_5th_grade_simple.txt
                └── ...
```

### Cross Country Outputs

```
output/
└── xc/
    └── 2025/                                      # Season
        ├── 09-27-2025/                            # Per-meet results
        │   ├── team_results_Prince_of_Peace.json  # Team results (JSON)
        │   ├── team_results_Prince_of_Peace.txt   # Team results (TXT)
        │   ├── team_results_Ascension.json
        │   └── ...
        ├── rankings/                              # Season event rankings
        │   ├── 34girls.json                       # 3rd & 4th Grade Girls
        │   ├── 34boys.json                        # 3rd & 4th Grade Boys
        │   ├── 56girls.json                       # 5th & 6th Grade Girls
        │   ├── 56boys.json                        # 5th & 6th Grade Boys
        │   ├── 78girls.json                       # 7th & 8th Grade Girls
        │   └── 78boys.json                        # 7th & 8th Grade Boys
        └── season_results/                        # Season-long team results
            ├── Prince_of_Peace.json
            ├── Ascension.json
            └── ...
```

## Output Formats

### Track Team Results

```json
{
  "teamName": "Saint Michael CYOKS",
  "teamCode": "SMA1",
  "meets": [
    {
      "teamName": "Saint Michael CYOKS",
      "teamCode": "SMA1",
      "meetName": "CYO #3 2025",
      "meetDate": "4/26/2025",
      "results": [
        {
          "athlete": "John Doe",
          "event": "60",
          "result": "9.55",
          "place": 1,
          "gender": "M",
          "grade": "5th grade"
        }
      ]
    }
  ]
}
```

### Track Event Rankings

Event rankings are saved as separate files per event (e.g., `event_rankings_2025_60.json`), with each file containing all gender and grade categories for that specific event:

```json
{
  "season": "2025",
  "event": "60m",
  "eventAbbr": "60",
  "generatedDate": "2025-11-12T22:49:06.343Z",
  "categories": [
    {
      "gender": "Female",
      "grade": "5th grade",
      "totalAthletes": 38,
      "rankings": [
        {
          "rank": 1,
          "athlete": "Jane Smith",
          "team": "Saint Michael CYOKS",
          "bestResult": "9.43",
          "bestResultMeet": "CYO #3 2025",
          "bestResultDate": "4/26/2025",
          "allResults": [
            {
              "result": "9.43",
              "meet": "CYO #3 2025",
              "date": "4/26/2025",
              "place": 1
            }
          ]
        }
      ]
    }
  ]
}
```

### XC Team Results (Per-Meet)

```json
{
  "teamName": "Prince of Peace",
  "meetName": "CYO Meet 1",
  "meetDate": "09-27-2025",
  "season": "2025",
  "teamScoreIncluded": true,
  "scoringPlaces": 5,
  "displacementRunners": 2,
  "races": [
    {
      "race": "5th & 6th Grade Girls (1 mile)",
      "ageGroup": "56",
      "gender": "Female",
      "distance": "1 mile",
      "teamScore": 6,
      "teamPlace": 1,
      "results": [
        {
          "place": 1,
          "athlete": "LUNDE, Lulu",
          "grade": "6",
          "score": 1,
          "time": "06:06.7",
          "gap": "---",
          "avgMile": "06:06.6",
          "scoring": true
        }
      ]
    }
  ]
}
```

### XC Event Rankings

```json
{
  "season": "2025",
  "race": "5th & 6th Grade Girls (1 mile)",
  "ageGroup": "56",
  "gender": "Female",
  "distance": "1 mile",
  "generatedDate": "2025-11-13T15:30:58.323Z",
  "rankings": [
    {
      "rank": 1,
      "athlete": "LUNDE, Lulu",
      "grade": "6",
      "team": "Prince of Peace",
      "bestTime": "06:06.7",
      "bestTimeSeconds": 366.7,
      "bestAvgMile": "06:06.6",
      "bestTimeMeet": "CYO Meet 1",
      "bestTimeMeetDate": "09-27-2025",
      "performances": [
        {
          "time": "06:06.7",
          "timeSeconds": 366.7,
          "avgMile": "06:06.6",
          "place": 1,
          "meetName": "CYO Meet 1",
          "meetDate": "09-27-2025"
        }
      ]
    }
  ]
}
```

### XC Season Results (Team)

```json
{
  "teamName": "Prince of Peace",
  "season": "2025",
  "races": [
    {
      "race": "5th & 6th Grade Girls (1 mile)",
      "ageGroup": "56",
      "gender": "Female",
      "distance": "1 mile",
      "meets": [
        {
          "meetName": "CYO Meet 1",
          "meetDate": "09-27-2025",
          "results": [
            {
              "place": 1,
              "athlete": "LUNDE, Lulu",
              "grade": "6",
              "score": 1,
              "time": "06:06.7",
              "gap": "---",
              "avgMile": "06:06.6"
            }
          ]
        }
      ]
    }
  ]
}
```

## Development

```bash
# Build TypeScript
npm run build

# Run with ts-node (development)
npm run process-track
npm run process-xc

# Test scripts (non-interactive)
npm run test-track
npm run test-xc
```

## File Structure

```
src/
├── common/                     # Shared utilities
│   ├── types.ts                # Track type definitions
│   ├── csv-parser.ts           # Track CSV parsing
│   └── result-utils.ts         # Result comparison utilities
├── track/                      # Track & Field processing
│   ├── process-track-field.ts  # Main interactive script
│   ├── team-results.ts         # Team result extraction
│   ├── event-rankings.ts       # Event rankings generation
│   ├── relay-rankings.ts       # Relay rankings generation
│   ├── athlete-results.ts      # Individual athlete results
│   ├── optimizer-types.ts      # Optimization type definitions
│   ├── team-entry-optimizer-simple.ts      # Simple optimizer
│   ├── team-entry-optimizer-advanced.ts    # Advanced optimizer
│   ├── optimize-team-entry-simple.ts       # Simple optimizer script
│   ├── optimize-team-entry-advanced.ts     # Advanced optimizer script
│   └── test-run.ts             # Test script
└── xc/                         # Cross Country processing
    ├── process-xc-results.ts   # Main interactive script
    ├── xc-types.ts             # XC type definitions
    ├── xc-csv-parser.ts        # XC CSV parsing
    ├── xc-team-results.ts      # Per-meet team results
    ├── xc-event-rankings.ts    # Season event rankings
    ├── xc-season-results.ts    # Season-long team results
    └── test-xc.ts              # Test script
```

## Notes

### Track & Field
- The script supports merging multiple meets into season-wide event rankings
- Results marked as DNS, DNF, DQ, NH, or FOUL are filtered out of rankings
- Track events (times) are ranked lowest-to-highest
- Field events (distances/heights) are ranked highest-to-lowest
- Relay results track team composition (same athletes in different order = same relay)
- Event rankings accumulate across meets when merging is enabled

### Cross Country
- Processes 6 races per meet: 34/56/78 boys/girls (1000m, 1 mile, 1.5 mile)
- Team scoring is configurable (typical: top 5 score, 2 displacement runners)
- Team scores calculated using CSV score field (adjusted for XC scoring rules)
- Season results automatically merge across all processed meets
- Rankings track best time and all performances for each athlete
- Incomplete teams (< 5 scoring runners) don't receive team scores
