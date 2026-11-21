import * as HealthKit from "@appeeky/expo-healthkit";

export type StepReadResult =
  | { available: false; steps: null }
  | { available: true; steps: number };

export function isStepCountAvailable(): boolean {
  return HealthKit.isAvailable();
}

export async function requestAndReadTodaySteps(): Promise<StepReadResult> {
  if (!HealthKit.isAvailable()) return { available: false, steps: null };

  // Request read access to step count only. No health data is written.
  await HealthKit.requestAuthorization({
    toRead: [HealthKit.QuantityType.stepCount],
  });

  return readTodaySteps();
}

export async function readTodaySteps(): Promise<StepReadResult> {
  if (!HealthKit.isAvailable()) return { available: false, steps: null };

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const result = await HealthKit.queryStatistics({
    type: HealthKit.QuantityType.stepCount,
    unit: HealthKit.Unit.count,
    from: start,
    to: now,
    options: HealthKit.StatisticsOption.cumulativeSum,
  });

  return {
    available: true,
    steps: Math.max(0, Math.round(result.sum ?? 0)),
  };
}
