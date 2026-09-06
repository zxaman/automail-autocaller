import type { Types } from 'mongoose';

import { ContactModel, type ContactDocument } from '../contacts/contact.model';
import { CallModel, type CallDocument, type CallStatus } from './call.model';

export interface CallScope {
  workspaceId: Types.ObjectId;
}

export interface CreateCallAttributes {
  contactId: Types.ObjectId | null;
  contactName: string;
  phoneNumber: string;
  agentNumber: string;
  callerId: string;
  countryCode: string;
  provider: string;
  providerCallId: string;
  status: CallStatus;
}

/** Every query is workspace-scoped, as with every other module. */
export class CallRepository {
  public async create(
    scope: CallScope,
    ownerId: Types.ObjectId,
    attributes: CreateCallAttributes,
  ): Promise<CallDocument> {
    return CallModel.create({
      ...attributes,
      workspaceId: scope.workspaceId,
      ownerId,
      direction: 'outbound',
      startedAt: new Date(),
    });
  }

  public async findById(scope: CallScope, callId: string): Promise<CallDocument | null> {
    return CallModel.findOne({ _id: callId, workspaceId: scope.workspaceId }).exec();
  }

  /**
   * Looks up by provider id *without* a workspace filter, because a webhook
   * arrives from the provider and carries no session. The provider id is
   * unpredictable and uniquely indexed, so it is the only safe join key here.
   */
  public async findByProviderCallId(providerCallId: string): Promise<CallDocument | null> {
    return CallModel.findOne({ providerCallId }).exec();
  }

  public async listPaged(
    scope: CallScope,
    query: { page: number; pageSize: number; status?: string; contactId?: string },
  ): Promise<{ items: CallDocument[]; totalItems: number }> {
    const filter: Record<string, unknown> = { workspaceId: scope.workspaceId };

    if (query.status) {
      filter['status'] = query.status;
    }
    if (query.contactId) {
      filter['contactId'] = query.contactId;
    }

    const [items, totalItems] = await Promise.all([
      CallModel.find(filter)
        .sort({ startedAt: -1 })
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize)
        .exec(),
      CallModel.countDocuments(filter).exec(),
    ]);

    return { items, totalItems };
  }

  public async applyStatus(
    callId: Types.ObjectId | string,
    status: CallStatus,
    changes: {
      durationSeconds?: number;
      answeredAt?: Date;
      endedAt?: Date;
      failureReason?: string | null;
      failureCode?: string | null;
    } = {},
  ): Promise<CallDocument | null> {
    return CallModel.findByIdAndUpdate(
      callId,
      { $set: { status, ...changes } },
      { new: true },
    ).exec();
  }

  public async findContactById(
    scope: CallScope,
    contactId: string,
  ): Promise<ContactDocument | null> {
    return ContactModel.findOne({ _id: contactId, workspaceId: scope.workspaceId }).exec();
  }

  /** Records that a contact was reached, for the timeline and follow-up views. */
  public async touchContactLastContacted(
    scope: CallScope,
    contactId: Types.ObjectId,
    when: Date,
  ): Promise<void> {
    await ContactModel.updateOne(
      { _id: contactId, workspaceId: scope.workspaceId },
      { $set: { lastContactedAt: when } },
    ).exec();
  }
}
