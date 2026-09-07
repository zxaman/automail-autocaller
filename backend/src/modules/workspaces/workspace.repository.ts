import type { ClientSession, Types } from 'mongoose';

import { WorkspaceModel, type WorkspaceDocument } from './workspace.model';

/** Data access for workspaces. */
export class WorkspaceRepository {
  public async create(
    attributes: { name: string; ownerId: Types.ObjectId },
    session?: ClientSession,
  ): Promise<WorkspaceDocument> {
    const [created] = await WorkspaceModel.create([attributes], session ? { session } : {});
    if (!created) {
      throw new Error('Workspace creation returned no document');
    }
    return created;
  }

  public async findById(workspaceId: Types.ObjectId): Promise<WorkspaceDocument | null> {
    return WorkspaceModel.findById(workspaceId).exec();
  }

  public async setOwner(workspaceId: Types.ObjectId, ownerId: Types.ObjectId): Promise<void> {
    await WorkspaceModel.updateOne({ _id: workspaceId }, { $set: { ownerId } }).exec();
  }
}
