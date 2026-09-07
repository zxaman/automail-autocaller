/**
 * Minimal in-process counters exposed for scraping.
 *
 * Deliberately not a Prometheus client dependency: the deployment target is a
 * small number of instances and the operational need is "did sends start
 * failing", which a handful of counters answers. The output format is
 * Prometheus text so a real scraper can be pointed at it later without
 * changing callers.
 *
 * Counters are per-process, so a scraper must aggregate across instances.
 */

export type MetricLabels = Record<string, string>;

interface Counter {
  readonly name: string;
  readonly help: string;
  readonly values: Map<string, { labels: MetricLabels; value: number }>;
}

const counters = new Map<string, Counter>();

function labelKey(labels: MetricLabels): string {
  return Object.keys(labels)
    .sort()
    .map((key) => `${key}=${labels[key]}`)
    .join(',');
}

export function incrementCounter(
  name: string,
  help: string,
  labels: MetricLabels = {},
  amount = 1,
): void {
  let counter = counters.get(name);

  if (!counter) {
    counter = { name, help, values: new Map() };
    counters.set(name, counter);
  }

  const key = labelKey(labels);
  const existing = counter.values.get(key);

  counter.values.set(key, { labels, value: (existing?.value ?? 0) + amount });
}

export function getCounterValue(name: string, labels: MetricLabels = {}): number {
  return counters.get(name)?.values.get(labelKey(labels))?.value ?? 0;
}

export function resetMetrics(): void {
  counters.clear();
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/** Renders every counter in Prometheus text exposition format. */
export function renderMetrics(): string {
  const lines: string[] = [];

  for (const counter of counters.values()) {
    lines.push(`# HELP ${counter.name} ${counter.help}`);
    lines.push(`# TYPE ${counter.name} counter`);

    for (const { labels, value } of counter.values.values()) {
      const rendered = Object.keys(labels)
        .sort()
        .map((key) => `${key}="${escapeLabelValue(labels[key] ?? '')}"`)
        .join(',');

      lines.push(rendered ? `${counter.name}{${rendered}} ${value}` : `${counter.name} ${value}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

/** Names kept in one place so a dashboard and the code cannot drift apart. */
export const METRICS = {
  emailSendAttempts: 'automail_email_send_attempts_total',
  emailSendFailures: 'automail_email_send_failures_total',
  callsPlaced: 'automail_calls_placed_total',
  webhooksRejected: 'automail_webhooks_rejected_total',
} as const;
