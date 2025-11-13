/**
 * Utility functions for comparing and formatting results
 */

export class ResultUtils {
    /**
     * Determine if an event is a track event (uses times)
     */
    static isTrackEvent(eventAbbr: string): boolean {
        const trackEvents = ['60', '100', '200', '400', '800', '1600', '3200', '4x100', '4x200', '4x400', '4x800'];
        return trackEvents.includes(eventAbbr);
    }

    /**
     * Determine if an event is a field event (uses distances/heights)
     */
    static isFieldEvent(eventAbbr: string): boolean {
        return !this.isTrackEvent(eventAbbr);
    }

    /**
     * Check if a result is valid (not DNS, DNF, NH, FOUL, etc.)
     */
    static isValidResult(result: string): boolean {
        const invalidResults = ['DNS', 'DNF', 'DQ', 'NH', 'FOUL', 'FS', 'SCR'];
        return !invalidResults.includes(result.toUpperCase().trim());
    }

    /**
     * Convert time string to seconds (for comparison)
     * Formats: "9.55", "29.55", "2:09.55", "6:29.55"
     */
    static timeToSeconds(timeStr: string): number {
        if (!this.isValidResult(timeStr)) {
            return Infinity;
        }

        const parts = timeStr.split(':');
        if (parts.length === 1) {
            // Just seconds: "9.55"
            return parseFloat(parts[0]);
        } else if (parts.length === 2) {
            // Minutes and seconds: "2:09.55"
            const minutes = parseInt(parts[0]);
            const seconds = parseFloat(parts[1]);
            return minutes * 60 + seconds;
        }

        return Infinity;
    }

    /**
     * Convert distance/height string to inches (for comparison)
     * Formats: "12-03.00", "81-06.00", "3-10.00"
     */
    static measureToInches(measureStr: string): number {
        if (!this.isValidResult(measureStr)) {
            return -Infinity;
        }

        const parts = measureStr.split('-');
        if (parts.length === 2) {
            const feet = parseInt(parts[0]);
            const inches = parseFloat(parts[1]);
            return feet * 12 + inches;
        }

        return -Infinity;
    }

    /**
     * Compare two results
     * Returns -1 if result1 is better, 1 if result2 is better, 0 if equal
     */
    static compareResults(result1: string, result2: string, eventAbbr: string): number {
        if (!this.isValidResult(result1) && !this.isValidResult(result2)) return 0;
        if (!this.isValidResult(result1)) return 1;
        if (!this.isValidResult(result2)) return -1;

        if (this.isTrackEvent(eventAbbr)) {
            // For track events, lower time is better
            const time1 = this.timeToSeconds(result1);
            const time2 = this.timeToSeconds(result2);
            return time1 < time2 ? -1 : time1 > time2 ? 1 : 0;
        } else {
            // For field events, higher distance/height is better
            const measure1 = this.measureToInches(result1);
            const measure2 = this.measureToInches(result2);
            return measure1 > measure2 ? -1 : measure1 < measure2 ? 1 : 0;
        }
    }

    /**
     * Get the better of two results
     */
    static getBestResult(result1: string, result2: string, eventAbbr: string): string {
        const comparison = this.compareResults(result1, result2, eventAbbr);
        return comparison <= 0 ? result1 : result2;
    }

    /**
     * Get full event name from abbreviation
     */
    static getEventName(eventAbbr: string): string {
        const eventNames: Record<string, string> = {
            '60': '60m',
            '100': '100m',
            '200': '200m',
            '400': '400m',
            '800': '800m',
            '1600': '1600m',
            '3200': '3200m',
            '4x100': '4x100m Relay',
            '4x200': '4x200m Relay',
            '4x400': '4x400m Relay',
            '4x800': '4x800m Relay',
            'LJ': 'Long Jump',
            'HJ': 'High Jump',
            'TJ': 'Triple Jump',
            'PV': 'Pole Vault',
            'SP': 'Shot Put',
            'DT': 'Discus Throw',
            'JT': 'Javelin Throw'
        };

        return eventNames[eventAbbr] || eventAbbr;
    }
}
