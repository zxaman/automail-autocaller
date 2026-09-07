import { Types, type FilterQuery, type SortOrder } from 'mongoose';

import { ContactModel, type ContactAttributes, type ContactDocument } from './contact.model';
import type { ContactListQuery, PagedResult } from './contact.types';

export interface ContactScope {
  workspaceId: Types.ObjectId;
}

export interface ContactWriteAttributes {
  name: string;
  phone: string | null;
  phoneNormalized: string | null;
  email: string | null;
  company: string | null;
  designation: string | null;
  location: string | null;
  tags: string[];
  notes: string | null;
}

/**
 * Data access for contacts.
 *
 * Critical rule: every method takes a ContactScope and folds workspaceId into
 * the filter. There is no method that can read or write a contact without it,
 * so a tampered id in a request cannot reach another workspace's data.
 */
export class ContactRepository {
  public async findPaged(
    scope: ContactScope,
    query: ContactListQuery,
  ): Promise<PagedResult<ContactDocument>> {
    const filter = this.buildFilter(scope, query);
    const sort = this.buildSort(query);
    const skip = (query.page - 1) * query.pageSize;

    const [items, totalItems] = await Promise.all([
      ContactModel.find(filter).sort(sort).skip(skip).limit(query.pageSize).exec(),
      ContactModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / query.pageSize)),
      },
    };
  }

  public async findById(scope: ContactScope, contactId: string): Promise<ContactDocument | null> {
    return ContactModel.findOne({ _id: contactId, workspaceId: scope.workspaceId }).exec();
  }

  public async create(
    scope: ContactScope,
    ownerId: Types.ObjectId,
    attributes: ContactWriteAttributes,
    source: ContactAttributes['source'] = 'manual',
  ): Promise<ContactDocument> {
    return ContactModel.create({
      ...attributes,
      workspaceId: scope.workspaceId,
      ownerId,
      source,
    });
  }

  public async update(
    scope: ContactScope,
    contactId: string,
    attributes: ContactWriteAttributes,
  ): Promise<ContactDocument | null> {
    return ContactModel.findOneAndUpdate(
      { _id: contactId, workspaceId: scope.workspaceId },
      { $set: attributes },
      { new: true, runValidators: true },
    ).exec();
  }

  public async delete(scope: ContactScope, contactId: string): Promise<boolean> {
    const result = await ContactModel.deleteOne({
      _id: contactId,
      workspaceId: scope.workspaceId,
    }).exec();
    return result.deletedCount === 1;
  }

  /** Duplicate lookup used before create and update. */
  public async findDuplicate(
    scope: ContactScope,
    criteria: { email: string | null; phoneNormalized: string | null },
    excludeId?: string,
  ): Promise<ContactDocument | null> {
    const alternatives: FilterQuery<ContactAttributes>[] = [];
    if (criteria.email) {
      alternatives.push({ email: criteria.email });
    }
    if (criteria.phoneNormalized) {
      alternatives.push({ phoneNormalized: criteria.phoneNormalized });
    }
    if (alternatives.length === 0) {
      return null;
    }

    const filter: FilterQuery<ContactAttributes> = {
      workspaceId: scope.workspaceId,
      $or: alternatives,
    };
    if (excludeId) {
      filter._id = { $ne: new Types.ObjectId(excludeId) };
    }

    return ContactModel.findOne(filter).exec();
  }

  /** Distinct tags for the workspace, powering the filter UI. */
  public async listTags(scope: ContactScope): Promise<string[]> {
    const tags = await ContactModel.distinct('tags', { workspaceId: scope.workspaceId }).exec();
    return (tags as string[]).filter(Boolean).sort();
  }

  public async countForWorkspace(scope: ContactScope): Promise<number> {
    return ContactModel.countDocuments({ workspaceId: scope.workspaceId }).exec();
  }

  private buildFilter(
    scope: ContactScope,
    query: ContactListQuery,
  ): FilterQuery<ContactAttributes> {
    // workspaceId is always first and can never be overridden by user input.
    const filter: FilterQuery<ContactAttributes> = { workspaceId: scope.workspaceId };

    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(escaped, 'i');
      filter.$or = [
        { name: pattern },
        { email: pattern },
        { company: pattern },
        { designation: pattern },
        { phone: pattern },
        { phoneNormalized: pattern },
      ];
    }

    if (query.tag) {
      filter.tags = query.tag;
    }
    if (query.company) {
      filter.company = query.company;
    }
    if (query.source) {
      filter.source = query.source;
    }
    if (query.hasEmail !== undefined) {
      filter.email = query.hasEmail ? { $type: 'string' } : null;
    }
    if (query.hasPhone !== undefined) {
      filter.phoneNormalized = query.hasPhone ? { $type: 'string' } : null;
    }

    return filter;
  }

  private buildSort(query: ContactListQuery): Record<string, SortOrder> {
    const direction: SortOrder = query.sortDir === 'asc' ? 1 : -1;
    // _id breaks ties so pagination is stable across pages.
    return { [query.sortBy]: direction, _id: -1 };
  }
}
