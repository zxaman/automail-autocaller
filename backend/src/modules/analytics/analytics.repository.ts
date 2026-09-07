import type { Types } from 'mongoose';

import type { DateRange } from '../../shared/utils/date-range';
import { SUCCESSFUL_CALL_STATUSES, CallModel } from '../calls/call.model';
import { ContactModel } from '../contacts/contact.model';
import { EmailModel } from '../emails/email.model';
import { ImportBatchModel } from '../imports/import-batch.model';
import type {
  AnalyticsGranularity,
  AnalyticsStatusCount,
  RawBucket,
  RawCallAnalytics,
  RawEmailAnalytics,
  RawImportAnalytics,
  RawMostContacted,
} from './analytics.types';

export interface AnalyticsScope {
  workspaceId: Types.ObjectId;
}

/** Mongo `$dateToString` format per bucket size. */
const BUCKET_FORMATS: Readonly<Record<AnalyticsGranularity, string>> = {
  day: '%Y-%m-%d',
  // ISO week, so a bucket is stable regardless of locale week-start rules.
  week: '%G-W%V',
  month: '%Y-%m',
};

const MOST_CONTACTED_LIMIT = 10;

/**
 * Every figure is produced by MongoDB aggregation, never by loading documents
 * and counting them in Node: the dataset grows without bound, the payload
 * must not.
 *
 * All bucketing passes `timezone` to `$dateToString` so a "day" is the user's
 * local day. Doing this in the database keeps the boundary definition in one
 * place instead of splitting it between Mongo and Node.
 *
 * Every pipeline starts with a `$match` on workspaceId.
 */
export class AnalyticsRepository {
  public async callAnalytics(
    scope: AnalyticsScope,
    range: DateRange,
  ): Promise<RawCallAnalytics> {
    const [result] = await CallModel.aggregate<RawCallAnalytics>([
      {
        $match: {
          workspaceId: scope.workspaceId,
          startedAt: { $gte: range.from, $lt: range.to },
        },
      },
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          connectedCalls: {
            $sum: { $cond: [{ $in: ['$status', [...SUCCESSFUL_CALL_STATUSES]] }, 1, 0] },
          },
          missedCalls: {
            $sum: { $cond: [{ $in: ['$status', ['no_answer', 'busy']] }, 1, 0] },
          },
          failedCalls: {
            $sum: { $cond: [{ $in: ['$status', ['failed', 'canceled']] }, 1, 0] },
          },
          totalDurationSeconds: { $sum: '$durationSeconds' },
          longestCallSeconds: { $max: '$durationSeconds' },
        },
      },
      { $project: { _id: 0 } },
    ]).exec();

    return (
      result ?? {
        totalCalls: 0,
        connectedCalls: 0,
        missedCalls: 0,
        failedCalls: 0,
        totalDurationSeconds: 0,
        longestCallSeconds: 0,
      }
    );
  }

  public async callStatusBreakdown(
    scope: AnalyticsScope,
    range: DateRange,
  ): Promise<AnalyticsStatusCount[]> {
    const rows = await CallModel.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          workspaceId: scope.workspaceId,
          startedAt: { $gte: range.from, $lt: range.to },
        },
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).exec();

    return rows.map((row) => ({ status: row._id, count: row.count }));
  }

  public async emailAnalytics(
    scope: AnalyticsScope,
    range: DateRange,
  ): Promise<RawEmailAnalytics> {
    const [result] = await EmailModel.aggregate<RawEmailAnalytics>([
      {
        $match: {
          workspaceId: scope.workspaceId,
          createdAt: { $gte: range.from, $lt: range.to },
        },
      },
      {
        $group: {
          _id: null,
          totalEmails: { $sum: 1 },
          sentEmails: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
          failedEmails: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        },
      },
      { $project: { _id: 0 } },
    ]).exec();

    return result ?? { totalEmails: 0, sentEmails: 0, failedEmails: 0 };
  }

  public async emailStatusBreakdown(
    scope: AnalyticsScope,
    range: DateRange,
  ): Promise<AnalyticsStatusCount[]> {
    const rows = await EmailModel.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          workspaceId: scope.workspaceId,
          createdAt: { $gte: range.from, $lt: range.to },
        },
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).exec();

    return rows.map((row) => ({ status: row._id, count: row.count }));
  }

  public async importAnalytics(
    scope: AnalyticsScope,
    range: DateRange,
  ): Promise<RawImportAnalytics> {
    const [result] = await ImportBatchModel.aggregate<RawImportAnalytics>([
      {
        $match: {
          workspaceId: scope.workspaceId,
          createdAt: { $gte: range.from, $lt: range.to },
        },
      },
      {
        $group: {
          _id: null,
          totalBatches: { $sum: 1 },
          totalRows: { $sum: '$totalRows' },
          successfulRows: { $sum: '$successfulRows' },
          duplicateRows: { $sum: '$duplicateRows' },
          failedRows: { $sum: '$failedRows' },
        },
      },
      { $project: { _id: 0 } },
    ]).exec();

    return (
      result ?? {
        totalBatches: 0,
        totalRows: 0,
        successfulRows: 0,
        duplicateRows: 0,
        failedRows: 0,
      }
    );
  }

  /** Call buckets keyed by local period, with the connected subtotal. */
  public async callBuckets(
    scope: AnalyticsScope,
    range: DateRange,
    granularity: AnalyticsGranularity,
  ): Promise<RawBucket[]> {
    return CallModel.aggregate<RawBucket>([
      {
        $match: {
          workspaceId: scope.workspaceId,
          startedAt: { $gte: range.from, $lt: range.to },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: BUCKET_FORMATS[granularity],
              date: '$startedAt',
              timezone: range.timezone,
            },
          },
          total: { $sum: 1 },
          successful: {
            $sum: { $cond: [{ $in: ['$status', [...SUCCESSFUL_CALL_STATUSES]] }, 1, 0] },
          },
        },
      },
    ]).exec();
  }

  public async emailBuckets(
    scope: AnalyticsScope,
    range: DateRange,
    granularity: AnalyticsGranularity,
  ): Promise<RawBucket[]> {
    return EmailModel.aggregate<RawBucket>([
      {
        $match: {
          workspaceId: scope.workspaceId,
          createdAt: { $gte: range.from, $lt: range.to },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: BUCKET_FORMATS[granularity],
              date: '$createdAt',
              timezone: range.timezone,
            },
          },
          total: { $sum: 1 },
          successful: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
        },
      },
    ]).exec();
  }

  /**
   * Ranks contacts by interactions in the range.
   *
   * Calls and emails are unioned so a contact is ranked on total contact
   * rather than on whichever channel happens to be busier, and the ranking is
   * cut to a fixed limit inside the database.
   */
  public async mostContacted(
    scope: AnalyticsScope,
    range: DateRange,
    limit: number = MOST_CONTACTED_LIMIT,
  ): Promise<RawMostContacted[]> {
    return CallModel.aggregate<RawMostContacted>([
      {
        $match: {
          workspaceId: scope.workspaceId,
          contactId: { $ne: null },
          startedAt: { $gte: range.from, $lt: range.to },
        },
      },
      {
        $project: {
          contactId: '$contactId',
          occurredAt: '$startedAt',
          isCall: 1,
          kind: { $literal: 'call' },
        },
      },
      {
        $unionWith: {
          coll: EmailModel.collection.name,
          pipeline: [
            {
              $match: {
                workspaceId: scope.workspaceId,
                contactId: { $ne: null },
                createdAt: { $gte: range.from, $lt: range.to },
              },
            },
            {
              $project: {
                contactId: '$contactId',
                occurredAt: '$createdAt',
                kind: { $literal: 'email' },
              },
            },
          ],
        },
      },
      {
        $group: {
          _id: '$contactId',
          callCount: { $sum: { $cond: [{ $eq: ['$kind', 'call'] }, 1, 0] } },
          emailCount: { $sum: { $cond: [{ $eq: ['$kind', 'email'] }, 1, 0] } },
          lastInteractionAt: { $max: '$occurredAt' },
        },
      },
      { $addFields: { totalInteractions: { $add: ['$callCount', '$emailCount'] } } },
      { $sort: { totalInteractions: -1, lastInteractionAt: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          contactId: '$_id',
          callCount: 1,
          emailCount: 1,
          lastInteractionAt: 1,
        },
      },
    ]).exec();
  }

  /** Resolves display names for the ranked contacts, workspace-scoped. */
  public async findContactsByIds(
    scope: AnalyticsScope,
    contactIds: readonly Types.ObjectId[],
  ): Promise<{ _id: Types.ObjectId; name: string; company: string | null }[]> {
    if (contactIds.length === 0) {
      return [];
    }

    return ContactModel.find({
      _id: { $in: contactIds },
      workspaceId: scope.workspaceId,
    })
      .select('name company')
      .lean<{ _id: Types.ObjectId; name: string; company: string | null }[]>()
      .exec();
  }
}
