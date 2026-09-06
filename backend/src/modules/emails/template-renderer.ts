import sanitizeHtml from 'sanitize-html';

/**
 * Template variables available to a message. Deliberately a fixed, known set:
 * arbitrary property access would let a template reach into internal fields.
 */
export const TEMPLATE_VARIABLES = [
  'contact.name',
  'contact.firstName',
  'contact.email',
  'contact.phone',
  'contact.company',
  'contact.designation',
  'contact.location',
  'sender.name',
  'sender.email',
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

export interface RenderContext {
  contact: {
    name: string;
    firstName: string;
    email: string;
    phone: string;
    company: string;
    designation: string;
    location: string;
  };
  sender: { name: string; email: string };
}

/** `{{ contact.name }}` — whitespace tolerant, dotted path only. */
const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z]+\.[a-zA-Z]+)\s*\}\}/g;

/**
 * HTML allowed in signatures and email bodies.
 *
 * Scripts, event handlers, iframes, forms, and styles are all dropped. Links
 * are forced to http/https/mailto so `javascript:` cannot survive, and images
 * are limited to remote URLs and data URIs.
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's',
    'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'a', 'img', 'hr', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    '*': ['align'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  disallowedTagsMode: 'discard',
  transformTags: {
    // External links must not hand the opener window to the target page.
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
  },
};

/**
 * Renders templates and enforces content safety.
 *
 * Two separate concerns handled in one place because they must happen in a
 * specific order: substitute first, then sanitize. Sanitizing first would let
 * a contact whose name contains markup inject it into the final HTML.
 */
export class TemplateRenderer {
  /** Replaces placeholders in plain text. Unknown variables become empty. */
  public renderText(template: string, context: RenderContext): string {
    return template.replace(PLACEHOLDER_PATTERN, (_match, path: string) =>
      this.resolve(path, context),
    );
  }

  /**
   * Renders an HTML body. Substituted values are HTML-escaped before insertion
   * so contact data can never introduce markup, then the whole document is
   * sanitized to remove anything unsafe the author wrote.
   */
  public renderHtml(template: string, context: RenderContext): string {
    const substituted = template.replace(PLACEHOLDER_PATTERN, (_match, path: string) =>
      this.escapeHtml(this.resolve(path, context)),
    );

    return this.sanitize(substituted);
  }

  public sanitize(html: string): string {
    return sanitizeHtml(html, SANITIZE_OPTIONS);
  }

  /**
   * Subjects are a header, so a newline would allow injecting Bcc or extra
   * headers. Control characters are stripped rather than escaped.
   */
  public renderSubject(template: string, context: RenderContext): string {
    const rendered = this.renderText(template, context);
    return this.stripHeaderInjection(rendered).slice(0, 500);
  }

  public stripHeaderInjection(value: string): string {
    // eslint-disable-next-line no-control-regex
    return value.replace(/[\r\n\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** Lists which known variables a template actually uses. */
  public extractVariables(template: string): string[] {
    const found = new Set<string>();
    for (const match of template.matchAll(PLACEHOLDER_PATTERN)) {
      const path = match[1];
      if (path && (TEMPLATE_VARIABLES as readonly string[]).includes(path)) {
        found.add(path);
      }
    }
    return [...found];
  }

  /** Placeholders that will render empty for this contact. */
  public findUnresolved(template: string, context: RenderContext): string[] {
    const missing = new Set<string>();
    for (const match of template.matchAll(PLACEHOLDER_PATTERN)) {
      const path = match[1];
      if (path && this.resolve(path, context) === '') {
        missing.add(path);
      }
    }
    return [...missing];
  }

  /**
   * Whitelist lookup. An unknown or non-whitelisted path resolves to an empty
   * string rather than throwing, so one bad placeholder cannot fail a send.
   */
  private resolve(path: string, context: RenderContext): string {
    if (!(TEMPLATE_VARIABLES as readonly string[]).includes(path)) {
      return '';
    }

    const [group, key] = path.split('.') as [keyof RenderContext, string];
    const source = context[group] as Record<string, string> | undefined;

    return source?.[key] ?? '';
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

/** Builds a render context from a contact record and the sending identity. */
export function buildRenderContext(
  contact: {
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    designation: string | null;
    location: string | null;
  },
  sender: { name: string; email: string },
): RenderContext {
  const trimmedName = contact.name.trim();

  return {
    contact: {
      name: trimmedName,
      firstName: trimmedName.split(/\s+/)[0] ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      company: contact.company ?? '',
      designation: contact.designation ?? '',
      location: contact.location ?? '',
    },
    sender,
  };
}

/**
 * Derives the plain-text alternative from the rendered HTML.
 *
 * Every message carries both parts: a text/plain alternative improves
 * deliverability and serves clients that do not render HTML.
 */
/**
 * Shared stateless instance, plus function-style helpers so callers do not each
 * construct a renderer.
 */
export const templateRenderer = new TemplateRenderer();

export const renderText = (template: string, context: RenderContext): string =>
  templateRenderer.renderText(template, context);

export const renderHtml = (template: string, context: RenderContext): string =>
  templateRenderer.renderHtml(template, context);

export const renderSubject = (template: string, context: RenderContext): string =>
  templateRenderer.renderSubject(template, context);

export const sanitize = (html: string): string => templateRenderer.sanitize(html);

export const extractVariables = (template: string): string[] =>
  templateRenderer.extractVariables(template);

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}
