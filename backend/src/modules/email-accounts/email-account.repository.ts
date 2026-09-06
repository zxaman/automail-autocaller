import type { Types } from 'mongoose';

import {
  EmailAccountModel,
  type EmailAccountDocument,
  type EmailAccountStatus,
  type StoredCredential,
} from './email-account.model';

export interface EmailAccountScope {
  workspaceId: Types.ObjectId;
}

export interface UpsertAccountAttributes {
  email: string;
  displayName: string;
  credential: StoredCredential;
  isDefault: boolean;
}

/**
 * Data access for connected email accounts.
 *
 * Every method folds workspaceId into its filter, as with contacts. The
 * credential field is `select: false`, so it must be asked for by name — see
 * `findByIdWithCredential`, the only method that returns it.
 */
export class EmailAccountRepository {
  public async list(scope: EmailAccountScope): Promise<EmailAccountDocument[]> {
    return EmailAccountModel.find({ workspaceId: scope.workspaceId })
      .sort({ isDefault: -1, createdAt: -1 })
      .exec();
  }

  public async findById(
    scope: EmailAccountScope,
    accountId: string,
  ): Promise<EmailAccountDocument | null> {
    return EmailAccountModel.findOne({ _id: accountId, workspaceId: scope.workspaceId }).exec();
  }

  /**
   * The only read path that returns the ciphertext. Named explicitly so that
   * any use of it is obvious in review and in a call-site search.
   */
  public async findByIdWithCredential(
    scope: EmailAccountScope,
    accountId: string,
  ): Promise<EmailAccountDocument | null> {
    return EmailAccountModel.findOne({ _id: accountId, workspaceId: scope.workspaceId })
      .select('+credential')
      .exec();
  }

  public async findByEmail(
    scope: EmailAccountScope,
    email: string,
  ): Promise<EmailAccountDocument | null> {
    return EmailAccountModel.findOne({ workspaceId: scope.workspaceId, email }).exec();
  }

  public async findDefault(scope: EmailAccountScope): Promise<EmailAccountDocument | null> {
    return EmailAccountModel.findOne({ workspaceId: scope.workspaceId, isDefault: true }).exec();
  }

  public async countForWorkspace(scope: EmailAccountScope): Promise<number> {
    return EmailAccountModel.countDocuments({ workspaceId: scope.workspaceId }).exec();
  }

  /**
   * Connect or reconnect. Reconnecting an existing address replaces the stored
   * credential outright rather than keeping a history of past secrets.
   */
  public async upsert(
    scope: EmailAccountScope,
    ownerId: Types.ObjectId,
    attributes: UpsertAccountAttributes,
  ): Promise<EmailAccountDocument> {
    const account = await EmailAccountModel.findOneAndUpdate(
      { workspaceId: scope.workspaceId, email: attributes.email },
      {
        $set: {
          displayName: attributes.displayName,
          credential: attributes.credential,
          status: 'active' satisfies EmailAccountStatus,
          isDefault: attributes.isDefault,
          lastVerifiedAt: new Date(),
          lastFailureCode: null,
          lastFailureAt: null,
        },
        $setOnInsert: {
          workspaceId: scope.workspaceId,
          ownerId,
          email: attributes.email,
          provider: 'gmail',
        },
      },
      { new: true, upsert: true, runValidators: true },
    ).exec();

    return account;
  }

  /** Clears the flag everywhere else so the partial unique index is satisfied. */
  public async clearDefaultExcept(
    scope: EmailAccountScope,
    accountId: Types.ObjectId,
  ): Promise<void> {
    await EmailAccountModel.updateMany(
      { workspaceId: scope.workspaceId, _id: { $ne: accountId }, isDefault: true },
      { $set: { isDefault: false } },
    ).exec();
  }

  public async setDefault(
    scope: EmailAccountScope,
    accountId: Types.ObjectId,
  ): Promise<EmailAccountDocument | null> {
    return EmailAccountModel.findOneAndUpdate(
      { _id: accountId, workspaceId: scope.workspaceId },
      { $set: { isDefault: true } },
      { new: true },
    ).exec();
  }

  public async recordVerificationSuccess(
    scope: EmailAccountScope,
    accountId: Types.ObjectId,
  ): Promise<EmailAccountDocument | null> {
    return EmailAccountModel.findOneAndUpdate(
      { _id: accountId, workspaceId: scope.workspaceId },
      {
        $set: {
          status: 'active' satisfies EmailAccountStatus,
          lastVerifiedAt: new Date(),
          lastFailureCode: null,
          lastFailureAt: null,
        },
      },
      { new: true },
    ).exec();
  }

  /** Stores only the failure code, never the SMTP response text. */
  public async recordVerificationFailure(
    scope: EmailAccountScope,
    accountId: Types.ObjectId,
    failureCode: string,
  ): Promise<EmailAccountDocument | null> {
    return EmailAccountModel.findOneAndUpdate(
      { _id: accountId, workspaceId: scope.workspaceId },
      {
        $set: {
          status: 'verification_failed' satisfies EmailAccountStatus,
          lastFailureCode: failureCode,
          lastFailureAt: new Date(),
        },
      },
      { new: true },
    ).exec();
  }

  /**
   * Disconnect deletes the document outright, taking the encrypted credential
   * with it. A soft delete would leave recoverable secret material behind.
   */
  public async delete(scope: EmailAccountScope, accountId: string): Promise<boolean> {
    const result = await EmailAccountModel.deleteOne({
      _id: accountId,
      workspaceId: scope.workspaceId,
    }).exec();

    return result.deletedCount === 1;
  }

  public async findOldestRemaining(
    scope: EmailAccountScope,
  ): Promise<EmailAccountDocument | null> {
    return EmailAccountModel.findOne({ workspaceId: scope.workspaceId })
      .sort({ createdAt: 1 })
      .exec();
  }
}
