import type { HealthProvider, HealthStepBucket } from './types';

/**
 * Dev/test stand-in for HealthKit/Health Connect — generates a plausible walking pattern
 * since the last checkpoint instead of reading real sensor data. Useful for developing and
 * demoing the app on a simulator/emulator, where there's no real step sensor to read from.
 */
export class MockHealthProvider implements HealthProvider {
  readonly sourceName = 'mock';

  async requestPermissions(): Promise<boolean> {
    return true;
  }

  async getBucketsSince(since: Date): Promise<HealthStepBucket[]> {
    const now = new Date();
    if (now <= since) return [];

    const buckets: HealthStepBucket[] = [];
    let cursor = new Date(since);

    // One bucket per hour of elapsed time, each with a randomized walking cadence.
    while (cursor < now) {
      const bucketEnd = new Date(Math.min(cursor.getTime() + 60 * 60 * 1000, now.getTime()));
      const minutes = (bucketEnd.getTime() - cursor.getTime()) / 60_000;
      const isActiveHour = Math.random() > 0.4; // roughly simulates being active ~60% of hours
      const stepsPerMinute = isActiveHour ? Math.random() * 60 + 20 : Math.random() * 5;
      const steps = Math.round(minutes * stepsPerMinute);

      if (steps > 0) {
        buckets.push({
          bucketStart: cursor.toISOString(),
          bucketEnd: bucketEnd.toISOString(),
          steps,
          distanceMeters: Math.round(steps * 0.75),
          source: this.sourceName,
          isManual: false,
        });
      }

      cursor = bucketEnd;
    }

    return buckets;
  }
}
