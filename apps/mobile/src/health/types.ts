export interface HealthStepBucket {
  bucketStart: string; // ISO datetime
  bucketEnd: string; // ISO datetime
  steps: number;
  distanceMeters?: number;
  source: string;
  isManual?: boolean;
}

/**
 * Every step data source (HealthKit, Health Connect, or this mock) implements the same
 * shape, so StepsSync in the app never needs to know which one is behind it. Swapping the
 * mock for real HealthKit/Health Connect later is a matter of writing a new provider here
 * and changing `getHealthProvider()` — nothing else in the app changes.
 */
export interface HealthProvider {
  readonly sourceName: string;
  requestPermissions(): Promise<boolean>;
  /** Returns step buckets accumulated since `since` (exclusive), ready to POST to /steps/sync. */
  getBucketsSince(since: Date): Promise<HealthStepBucket[]>;
}
