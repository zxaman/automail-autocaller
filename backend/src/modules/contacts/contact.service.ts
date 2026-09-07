import type { Types } from 'mongoose';

import { AppError } from '../../shared/errors/app-error';
import { normalizePhone } from '../../shared/utils/phone';
import { toContactDto } from './contact.mapper';
import type { ContactRepository, ContactScope, ContactWriteAttributes } from './contact.repository';
import type { ContactDto, ContactListQuery, PagedResult } from './contact.types';
import type { CreateContactInput, UpdateContactInput } from './contact.validation';

/**
 * Contact business rules: normalization, duplicate policy, and not-found
 * semantics. All persistence is delegated to the repository, which enforces
 * workspace scoping.
 */
export class ContactService {
  constructor(private readonly contactRepository: ContactRepository) {}

  public async list(
    scope: ContactScope,
    query: ContactListQuery,
  ): Promise<PagedResult<ContactDto>> {
    const result = await this.contactRepository.findPaged(scope, query);
    return {
      items: result.items.map(toContactDto),
      pagination: result.pagination,
    };
  }

  public async getById(scope: ContactScope, contactId: string): Promise<ContactDto> {
    const contact = await this.contactRepository.findById(scope, contactId);
    if (!contact) {
      // A contact in another workspace is reported as not found, never as
      // forbidden, so the API does not confirm that the id exists elsewhere.
      throw new AppError('Contact not found', 404, 'CONTACT_NOT_FOUND');
    }
    return toContactDto(contact);
  }

  public async create(
    scope: ContactScope,
    ownerId: Types.ObjectId,
    input: CreateContactInput,
  ): Promise<ContactDto> {
    const attributes = this.toWriteAttributes(input);
    await this.assertNoDuplicate(scope, attributes);

    try {
      const created = await this.contactRepository.create(scope, ownerId, attributes);
      return toContactDto(created);
    } catch (error) {
      throw this.translateWriteError(error, 'Unable to create contact', 'CONTACT_CREATE_FAILED');
    }
  }

  public async update(
    scope: ContactScope,
    contactId: string,
    input: UpdateContactInput,
  ): Promise<ContactDto> {
    const attributes = this.toWriteAttributes(input);
    await this.assertNoDuplicate(scope, attributes, contactId);

    try {
      const updated = await this.contactRepository.update(scope, contactId, attributes);
      if (!updated) {
        throw new AppError('Contact not found', 404, 'CONTACT_NOT_FOUND');
      }
      return toContactDto(updated);
    } catch (error) {
      throw this.translateWriteError(error, 'Unable to update contact', 'CONTACT_UPDATE_FAILED');
    }
  }

  public async delete(scope: ContactScope, contactId: string): Promise<void> {
    const deleted = await this.contactRepository.delete(scope, contactId);
    if (!deleted) {
      throw new AppError('Contact not found', 404, 'CONTACT_NOT_FOUND');
    }
  }

  public async listTags(scope: ContactScope): Promise<string[]> {
    return this.contactRepository.listTags(scope);
  }

  private toWriteAttributes(input: CreateContactInput | UpdateContactInput): ContactWriteAttributes {
    const normalized = normalizePhone(input.phone);

    if (input.phone && !normalized) {
      throw new AppError('The phone number could not be recognized', 400, 'CONTACT_PHONE_INVALID', {
        details: { fields: { phone: 'Enter a valid phone number' } },
      });
    }

    return {
      name: input.name,
      phone: input.phone,
      phoneNormalized: normalized ? normalized.e164 : null,
      email: input.email,
      company: input.company,
      designation: input.designation,
      location: input.location,
      tags: input.tags,
      notes: input.notes,
    };
  }

  private async assertNoDuplicate(
    scope: ContactScope,
    attributes: ContactWriteAttributes,
    excludeId?: string,
  ): Promise<void> {
    const duplicate = await this.contactRepository.findDuplicate(
      scope,
      { email: attributes.email, phoneNormalized: attributes.phoneNormalized },
      excludeId,
    );

    if (duplicate) {
      const field = duplicate.email && duplicate.email === attributes.email ? 'email' : 'phone';
      throw new AppError(
        `Another contact in this workspace already uses this ${field}`,
        409,
        'CONTACT_DUPLICATE',
        { details: { field, conflictingContactId: duplicate._id.toString() } },
      );
    }
  }

  /** Converts a race-condition unique-index violation into the same 409. */
  private translateWriteError(error: unknown, message: string, code: string): AppError {
    if (error instanceof AppError) {
      return error;
    }

    const mongoError = error as { code?: number; keyPattern?: Record<string, unknown> };
    if (mongoError.code === 11000) {
      const field = mongoError.keyPattern && 'email' in mongoError.keyPattern ? 'email' : 'phone';
      return new AppError(
        `Another contact in this workspace already uses this ${field}`,
        409,
        'CONTACT_DUPLICATE',
        { details: { field } },
      );
    }

    return new AppError(message, 400, code);
  }
}
