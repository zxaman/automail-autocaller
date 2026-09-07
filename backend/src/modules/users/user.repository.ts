import type { ClientSession, Types } from 'mongoose';

import { UserModel, type UserDocument } from './user.model';

/** Data access for users. Contains no business rules. */
export class UserRepository {
  public async findByUsername(username: string): Promise<UserDocument | null> {
    return UserModel.findOne({ username }).exec();
  }

  public async findByEmail(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email: email.toLowerCase() }).exec();
  }

  public async findById(userId: string | Types.ObjectId): Promise<UserDocument | null> {
    return UserModel.findById(userId).exec();
  }

  public async create(
    attributes: Pick<
      UserDocument,
      | 'username'
      | 'name'
      | 'email'
      | 'passwordHash'
      | 'dateOfBirth'
      | 'phoneNumber'
      | 'appCode'
      | 'userType'
      | 'role'
      | 'workspaceId'
    > & { profileImageUrl?: string | null },
    session?: ClientSession,
  ): Promise<UserDocument> {
    const [created] = await UserModel.create([attributes], session ? { session } : {});
    if (!created) {
      throw new Error('User creation returned no document');
    }
    return created;
  }

  public async touchLogin(userId: Types.ObjectId, at: Date): Promise<void> {
    await UserModel.updateOne({ _id: userId }, { $set: { lastLoginAt: at } }).exec();
  }
}
