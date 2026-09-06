import { describe, expect, it } from 'vitest';

import { TemplateRenderer, buildRenderContext } from './template-renderer';

const renderer = new TemplateRenderer();

const context = buildRenderContext(
  {
    name: 'Asha Menon',
    email: 'asha@example.com',
    phone: '+919812345678',
    company: 'Acme Ltd',
    designation: 'Head of Ops',
    location: 'Pune',
  },
  { name: 'Sender', email: 'sender@gmail.com' },
);

describe('TemplateRenderer', () => {
  describe('variable substitution', () => {
    it('renders contact and sender variables', () => {
      const result = renderer.renderText(
        'Hi {{contact.firstName}}, this is {{sender.name}} about {{contact.company}}.',
        context,
      );

      expect(result).toBe('Hi Asha, this is Sender about Acme Ltd.');
    });

    it('tolerates whitespace inside the braces', () => {
      expect(renderer.renderText('Hi {{  contact.firstName  }}', context)).toBe('Hi Asha');
    });

    it('derives a first name from the full name', () => {
      expect(renderer.renderText('{{contact.firstName}}', context)).toBe('Asha');
    });

    it('renders an unknown variable as empty rather than failing the send', () => {
      expect(renderer.renderText('Hi {{contact.nickname}}!', context)).toBe('Hi !');
    });

    it('does not allow reaching outside the whitelist', () => {
      // A path that exists on the object but is not whitelisted must not resolve.
      expect(renderer.renderText('{{constructor.name}}', context)).toBe('');
      expect(renderer.renderText('{{contact.constructor}}', context)).toBe('');
    });

    it('renders a missing optional field as empty', () => {
      const sparse = buildRenderContext(
        { name: 'Ravi', email: null, phone: null, company: null, designation: null, location: null },
        { name: 'Sender', email: 'sender@gmail.com' },
      );

      expect(renderer.renderText('Company: {{contact.company}}.', sparse)).toBe('Company: .');
    });

    it('lists the known variables a template uses', () => {
      const found = renderer.extractVariables('{{contact.name}} at {{contact.company}} {{bogus.x}}');
      expect(found.sort()).toEqual(['contact.company', 'contact.name']);
    });

    it('reports which placeholders will render empty', () => {
      const sparse = buildRenderContext(
        { name: 'Ravi', email: null, phone: null, company: null, designation: null, location: null },
        { name: 'Sender', email: 'sender@gmail.com' },
      );

      expect(renderer.findUnresolved('{{contact.name}} {{contact.company}}', sparse)).toEqual([
        'contact.company',
      ]);
    });
  });

  describe('HTML safety', () => {
    it('strips script tags from author content', () => {
      const result = renderer.renderHtml('<p>Hello</p><script>alert(1)</script>', context);

      expect(result).not.toContain('script');
      expect(result).toContain('<p>Hello</p>');
    });

    it('strips event handler attributes', () => {
      const result = renderer.renderHtml('<p onclick="steal()">Hi</p>', context);
      expect(result).not.toContain('onclick');
    });

    it('removes javascript: links', () => {
      const result = renderer.renderHtml('<a href="javascript:alert(1)">click</a>', context);
      expect(result).not.toContain('javascript:');
    });

    it('adds noopener to links so the opener cannot be hijacked', () => {
      const result = renderer.renderHtml('<a href="https://example.com">link</a>', context);
      expect(result).toContain('noopener');
    });

    it('escapes markup that arrives through contact data', () => {
      const hostile = buildRenderContext(
        {
          name: '<script>alert("xss")</script>',
          email: null, phone: null, company: null, designation: null, location: null,
        },
        { name: 'Sender', email: 'sender@gmail.com' },
      );

      const result = renderer.renderHtml('<p>Hi {{contact.name}}</p>', hostile);

      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('keeps ordinary formatting intact', () => {
      const result = renderer.renderHtml(
        '<p><strong>Bold</strong> and <em>italic</em></p><ul><li>One</li></ul>',
        context,
      );

      expect(result).toContain('<strong>Bold</strong>');
      expect(result).toContain('<li>One</li>');
    });

    it('drops iframes and forms', () => {
      const result = renderer.renderHtml(
        '<iframe src="https://evil.test"></iframe><form action="/x"><input /></form>',
        context,
      );

      expect(result).not.toContain('iframe');
      expect(result).not.toContain('<form');
    });
  });

  describe('header injection', () => {
    it('strips newlines from a subject so extra headers cannot be added', () => {
      const result = renderer.renderSubject(
        'Hello\r\nBcc: victim@example.com\nX-Evil: yes',
        context,
      );

      expect(result).not.toContain('\n');
      expect(result).not.toContain('\r');
      expect(result).toBe('Hello Bcc: victim@example.com X-Evil: yes');
    });

    it('strips injection attempts arriving through contact data', () => {
      const hostile = buildRenderContext(
        {
          name: 'Asha\r\nBcc: attacker@example.com',
          email: null, phone: null, company: null, designation: null, location: null,
        },
        { name: 'Sender', email: 'sender@gmail.com' },
      );

      const result = renderer.renderSubject('Hi {{contact.name}}', hostile);
      expect(result).not.toMatch(/[\r\n]/);
    });

    it('strips control characters', () => {
      expect(renderer.stripHeaderInjection('a\u0000b\u001fc')).toBe('a b c');
    });

    it('caps an absurdly long subject', () => {
      const result = renderer.renderSubject('x'.repeat(900), context);
      expect(result.length).toBeLessThanOrEqual(500);
    });
  });
});
