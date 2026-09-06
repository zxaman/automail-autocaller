import type { ImportTargetField } from './import.types';

export interface FieldAliasDefinition {
  field: ImportTargetField;
  label: string;
  /** Normalized aliases that identify this field outright. */
  exact: string[];
  /** Normalized fragments that suggest the field when contained in a header. */
  contains: string[];
  /**
   * Headers so vague they must never auto-map on their own. `number` could be a
   * phone, an employee id, or a row counter; only value analysis can tell.
   */
  ambiguous?: boolean;
}

/**
 * Alias registry.
 *
 * Real spreadsheets never agree on column names, so matching is alias-driven
 * rather than exact. Everything here is normalized: lowercase, punctuation and
 * whitespace removed. `contains` entries are deliberately short so that
 * "Candidate Mobile No." still resolves.
 */
export const FIELD_ALIASES: readonly FieldAliasDefinition[] = [
  {
    field: 'phone',
    label: 'Phone',
    exact: [
      'phone', 'phoneno', 'phonenumber', 'mobile', 'mobileno', 'mobilenumber',
      'contactnumber', 'contactno', 'contact', 'telephone', 'tel', 'cell',
      'cellphone', 'cellno', 'whatsapp', 'whatsappnumber', 'primaryphone',
      'msisdn', 'phone1',
    ],
    contains: ['phone', 'mobile', 'telephone', 'whatsapp', 'contactnum', 'cellno'],
  },
  {
    field: 'email',
    label: 'Email',
    exact: [
      'email', 'emailid', 'emailaddress', 'mail', 'mailid', 'mailaddress',
      'emailadress', 'primaryemail', 'workemail', 'officialemail', 'personalemail',
      'eid',
    ],
    contains: ['email', 'mailid', 'mailaddress'],
  },
  {
    field: 'name',
    label: 'Full name',
    exact: [
      'name', 'fullname', 'candidate', 'candidatename', 'applicant',
      'applicantname', 'person', 'personname', 'client', 'clientname',
      'customer', 'customername', 'lead', 'leadname', 'contactname',
      'studentname', 'employeename', 'displayname',
    ],
    contains: ['fullname', 'candidatename', 'applicantname', 'contactperson'],
  },
  {
    field: 'firstName',
    label: 'First name',
    exact: ['firstname', 'fname', 'givenname', 'forename', 'first'],
    contains: ['firstname', 'givenname'],
  },
  {
    field: 'lastName',
    label: 'Last name',
    exact: ['lastname', 'lname', 'surname', 'familyname', 'last'],
    contains: ['lastname', 'surname', 'familyname'],
  },
  {
    field: 'company',
    label: 'Company',
    exact: [
      'company', 'companyname', 'organisation', 'organization', 'org',
      'employer', 'firm', 'business', 'businessname', 'accountname', 'currentcompany',
    ],
    contains: ['company', 'organis', 'organiz', 'employer'],
  },
  {
    field: 'designation',
    label: 'Designation',
    exact: [
      'designation', 'title', 'jobtitle', 'role', 'position', 'jobrole',
      'profile', 'currentrole',
    ],
    contains: ['designation', 'jobtitle', 'jobrole'],
  },
  {
    field: 'location',
    label: 'Location',
    exact: [
      'location', 'city', 'address', 'place', 'region', 'area', 'state',
      'country', 'currentlocation', 'basedin',
    ],
    contains: ['location', 'city', 'address'],
  },
  {
    field: 'tags',
    label: 'Tags',
    exact: ['tags', 'tag', 'labels', 'label', 'category', 'categories', 'segment', 'source'],
    contains: ['tag', 'label', 'category'],
  },
  {
    field: 'notes',
    label: 'Notes',
    exact: ['notes', 'note', 'remarks', 'remark', 'comment', 'comments', 'description', 'details'],
    contains: ['note', 'remark', 'comment', 'description'],
  },
];

/**
 * Headers that are too generic to trust on their own. The scorer gives these a
 * low ceiling so they always fall to value analysis or user confirmation.
 */
export const AMBIGUOUS_HEADERS: ReadonlySet<string> = new Set([
  'number', 'no', 'num', 'id', 'sno', 'srno', 'serialno', 'sl', 'slno',
  'user', 'users', 'details', 'detail', 'data', 'info', 'information',
  'value', 'field', 'column', 'other', 'others', 'misc', 'reference', 'ref',
]);

/**
 * Strips case, punctuation, and spacing so `Phone No.`, `phone_no`, and
 * `PHONE NO` all collapse to `phoneno`.
 */
export function normalizeHeaderLabel(rawLabel: string): string {
  return rawLabel
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '');
}
