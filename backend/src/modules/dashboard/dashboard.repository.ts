import type { Types } from 'mongoose';

import { CallModel } from '../calls/call.model';
import { ContactModel } from '../contacts/contact.model';
import { EmailModel } from '../emails/email.model';
import { ImportBatchModel } from '../imports/import-batch.model';
import type { DateRange } from '../../shared/utils/date-range';
import type {
  ActivityPoint,
  DashboardRecentCall,
  DashboardRecentEmail,
  DashboardRecentImport,
  RawCallStats,
  RawEmailStats,
} from './dashboard.types';

export interface DashboardScope {
  workspaceId: Types.ObjectId;
}

const RECENT_LIMIT = 5;

/**
 * All dashboard numbers are produced by MongoDB aggregation rather than by
 * fetching documents and counting them in Node. This keeps the payload small
 * and the work close to the indexes.
 *
 * Every pipeline begins with a `$match` on workspaceId so no cross-workspace
 * data can ever enter a result.
 */
export class DashboardRepository {
  public async countContacts(scope: DashboardScope): Promise<number> {
    return ContactModel.countDocuments({ workspaceId: scope.workspaceId }).exec();
  }

  public async callStats(scope: DashboardScope, range?: DateRange): Promise<RawCallStats> {
    const match: Record<string, unknown> = { workspaceId: scope.workspaceId };
    if (range) {
      match['startedAt'] = { $gte: range.from, $lt: range.to };
    }

    const [result] = await CallModel.aggregate<RawCallStats>([
      { $match: match },
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          completedCalls: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          // 'missed' is the provider's no_answer/busy outcome: the call was
          // placed but the person did not pick up. Renamed in Phase 10.
          missedCalls: {
            $sum: { $cond: [{ $in: ['$status', ['no_answer', 'busy']] }, 1, 0] },
          },
          failedCalls: {
            $sum: { $cond: [{ $in: ['$status', ['failed', 'canceled']] }, 1, 0] },
          },
          totalCallDurationSeconds: { $sum: '$durationSeconds' },
        },
      },
      { $project: { _id: 0 } },
    ]).exec();

    return (
      result ?? {
        totalCalls: 0,
        completedCalls: 0,
        missedCalls: 0,
        failedCalls: 0,
        totalCallDurationSeconds: 0,
      }
    );
  }

  public async emailStats(scope: DashboardScope, range?: DateRange): Promise<RawEmailStats> {
    const match: Record<string, unknown> = { workspaceId: scope.workspaceId };
    if (range) {
      match['createdAt'] = { $gte: range.from, $lt: range.to };
    }

    const [result] = await EmailModel.aggregate<RawEmailStats>([
      { $match: match },
      {
        $group: {
          _id: null,
          totalEmails: { $sum: 1 },
          successfulEmails: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
          failedEmails: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        },
      },
      { $project: { _id: 0 } },
    ]).exec();

    return result ?? { totalEmails: 0, successfulEmails: 0, failedEmails: 0 };
  }

  /**
   * Daily call and email counts bucketed in the caller's timezone.
   *
   * `$dateToString` with a timezone lets MongoDB do the local-day grouping, so
   * a call at 02:00 IST lands on the correct local date rather than the UTC one.
   */
  public async activitySeries(
    scope: DashboardScope,
    range: DateRange,
  ): Promise<Map<string, { calls: number; emails: number }>> {
    const [callBuckets, emailBuckets] = await Promise.all([
      CallModel.aggregate<{ _id: string; count: number }>([
        {
          $match: {
            workspaceId: scope.workspaceId,
            startedAt: { $gte: range.from, $lt: range.to },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$startedAt', timezone: range.timezone },
            },
            count: { $sum: 1 },
          },
        },
      ]).exec(),
      EmailModel.aggregate<{ _id: string; count: number }>([
        {
          $match: {
            workspaceId: scope.workspaceId,
            createdAt: { $gte: range.from, $lt: range.to },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: range.timezone },
            },
            count: { $sum: 1 },
          },
        },
      ]).exec(),
    ]);

    const series = new Map<string, { calls: number; emails: number }>();
    for (const bucket of callBuckets) {
      series.set(bucket._id, { calls: bucket.count, emails: 0 });
    }
    for (const bucket of emailBuckets) {
      const existing = series.get(bucket._id);
      series.set(bucket._id, { calls: existing?.calls ?? 0, emails: bucket.count });
    }
    return series;
  }

  public async recentCalls(scope: DashboardScope): Promise<DashboardRecentCall[]> {
    const calls = await CallModel.find({ workspaceId: scope.workspaceId })
      .sort({ startedAt: -1, _id: -1 })
      .limit(RECENT_LIMIT)
      .exec();

    return calls.map((call) => ({
      id: call._id.toString(),
      contactId: call.contactId ? call.contactId.toString() : null,
      contactName: call.contactName,
      phoneNumber: call.phoneNumber,
      direction: call.direction,
      status: call.status,
      durationSeconds: call.durationSeconds,
      occurredAt: call.startedAt.toISOString(),
    }));
  }

  public async recentEmails(scope: DashboardScope): Promise<DashboardRecentEmail[]> {
    const emails = await EmailModel.find({ workspaceId: scope.workspaceId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(RECENT_LIMIT)
      .exec();

    return emails.map((email) => ({
      id: email._id.toString(),
      contactId: email.contactId ? email.contactId.toString() : null,
      contactName: email.recipientName ?? email.recipientEmail,
      subject: email.subject,
      status: email.status,
      occurredAt: (email.sentAt ?? email.createdAt).toISOString(),
    }));
  }

  public async recentImports(scope: DashboardScope): Promise<DashboardRecentImport[]> {
    const batches = await ImportBatchModel.find({ workspaceId: scope.workspaceId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(RECENT_LIMIT)
      .exec();

    return batches.map((batch) => ({
      id: batch._id.toString(),
      fileName: batch.fileName,
      totalRows: batch.totalRows,
      successfulRows: batch.successfulRows,
      duplicateRows: batch.duplicateRows,
      failedRows: batch.failedRows,
      status: batch.status,
      importedAt: (batch.importedAt ?? batch.createdAt).toISOString(),
    }));
  }
}
