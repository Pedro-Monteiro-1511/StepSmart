import { MockHealthProvider } from './mock-provider';
import type { HealthProvider } from './types';
import { StepsApi } from '../lib/endpoints';
import { getItem, setItem } from '../lib/storage';
import type { StepSyncResult } from '@stepsmart/shared-types';

const CHECKPOINT_KEY = 'stepsmart_last_sync_checkpoint';

/**
 * Single place that decides which step data source backs the app. Today this always
 * returns the mock provider; swapping in real sensors later means adding
 * HealthKitProvider/HealthConnectProvider here (Platform.OS === 'ios' ? ... : ...) —
 * everything else (screens, sync logic, backend) is unaffected.
 */
export function getHealthProvider(): HealthProvider {
  return new MockHealthProvider();
}

async function getCheckpoint(): Promise<Date> {
  const stored = await getItem(CHECKPOINT_KEY);
  if (stored) return new Date(stored);
  // First run: only look back a few hours so we don't flood the mandatory "by 12:00" challenge
  // with a full day of backfilled mock steps.
  return new Date(Date.now() - 3 * 60 * 60 * 1000);
}

async function setCheckpoint(date: Date): Promise<void> {
  await setItem(CHECKPOINT_KEY, date.toISOString());
}

/** Reads new step buckets since the last checkpoint and posts them to /steps/sync. */
export async function syncSteps(): Promise<StepSyncResult | null> {
  const provider = getHealthProvider();
  const since = await getCheckpoint();
  const now = new Date();

  const buckets = await provider.getBucketsSince(since);
  if (buckets.length === 0) {
    return null;
  }

  const result = await StepsApi.sync({
    buckets,
    clientBatchId: `${provider.sourceName}-${since.getTime()}-${now.getTime()}`,
  });

  await setCheckpoint(now);
  return result;
}
