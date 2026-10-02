import type { LearningError } from '../types';
import { findLineIndex, makeError, type AnalyzerContext } from './ruleHelpers';
import type { RuleResult } from './pythonRules';

/**
 * Local HTML checks. These describe structure and accessibility issues in words;
 * they never output corrected markup, patches or replacements.
 */

const CONCEPT_TESTS: Array<{ concept: string; test: (source: string) => boolean }> = [
  { concept: 'Document Structure', test: (s) => /<(!doctype|html|head|body)\b/i.test(s) },
  { concept: 'Semantic Elements', test: (s) => /<(header|main|footer|nav|section|article)\b/i.test(s) },
  { concept: 'Images', test: (s) => /<img\b/i.test(s) },
  { concept: 'Links', test: (s) => /<a\b/i.test(s) },
  { concept: 'Forms', test: (s) => /<form\b|<input\b|<button\b|<label\b/i.test(s) },
  { concept: 'Lists', test: (s) => /<(ul|ol|li)\b/i.test(s) },
  { concept: 'Styles', test: (s) => /<style\b|rel=["']stylesheet["']/i.test(s) },
  { concept: 'Scripts', test: (s) => /<script\b/i.test(s) },
  { concept: 'Accessibility', test: (s) => /\balt=|\baria-|\brole=/i.test(s) },
];

export function detectHtmlConcepts(source: string): string[] {
  return CONCEPT_TESTS.filter(({ test }) => test(source)).map(({ concept }) => concept);
}

const BALANCED_TAGS = ['html', 'head', 'body', 'div', 'section', 'main', 'header', 'footer', 'ul', 'ol', 'li', 'form', 'button', 'p'];

export function analyzeHtml(context: AnalyzerContext): RuleResult {
  const { source, lines } = context;
  const errors: LearningError[] = [];
  const warnings: string[] = [];

  // 1. Images without alternative text.
  lines.forEach((line, index) => {
    if (/<img\b/i.test(line) && !/\balt\s*=/i.test(line)) {
      errors.push(
        makeError({
          line: index + 1,
          lineConfidence: 'exact',
          severity: 'warning',
          category: 'Accessibility',
          type: 'missing-alt',
          title: 'Image without alternative text',
          technicalMessage: 'An <img> element is missing an alt attribute.',
          whatHappened: 'This image was found without a text description.',
          whyItHappened: 'The alt attribute was not provided, so assistive technology cannot describe the image.',
          gentleHint: 'Think about what a screen reader should say in place of this picture.',
          guidedHint: 'Add a short description as the image’s alternative text. What is the image communicating?',
          learningHint: 'Alternative text is how non-visual users receive the meaning of an image. Decorative images still need an empty alt so they are skipped.',
          conceptReminder: 'Every meaningful image should carry alternative text.',
          selfCheckQuestion: 'If someone cannot see this image, what one sentence tells them what it shows?',
          confidence: 'high',
        }),
      );
    }
  });

  // 2. Duplicate id attributes.
  const ids = new Map<string, number>();
  lines.forEach((line, index) => {
    const matches = line.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi);
    for (const match of matches) {
      const value = match[1];
      if (ids.has(value)) {
        errors.push(
          makeError({
            line: index + 1,
            lineConfidence: 'exact',
            severity: 'warning',
            category: 'Structure',
            type: 'duplicate-id',
            title: 'Duplicate id value',
            technicalMessage: `The id “${value}” is used more than once.`,
            whatHappened: 'Two elements share the same id.',
            whyItHappened: 'An id must be unique within a document, so references to it become ambiguous.',
            gentleHint: 'Which of these two elements should own this identifier?',
            guidedHint: 'Give each element its own identifier, or switch repeated styling to a class.',
            learningHint: 'ids are unique; classes can repeat. Styles and scripts that target an id expect exactly one match.',
            conceptReminder: 'An id identifies one element; a class groups many.',
            selfCheckQuestion: 'What should happen if two elements claim the same identifier?',
            confidence: 'high',
          }),
        );
      } else {
        ids.set(value, index + 1);
      }
    }
  });

  // 3. Unbalanced common container tags.
  for (const tag of BALANCED_TAGS) {
    const open = (source.match(new RegExp(`<${tag}\\b`, 'gi')) ?? []).length;
    const close = (source.match(new RegExp(`</${tag}>`, 'gi')) ?? []).length;
    if (open !== close) {
      errors.push(
        makeError({
          line: findLineIndex(lines, new RegExp(`<${tag}\\b`, 'i')) + 1,
          lineConfidence: 'estimated',
          severity: 'warning',
          category: 'Structure',
          type: 'unbalanced-tag',
          title: `Possible unmatched <${tag}> tag`,
          technicalMessage: `Found ${open} opening and ${close} closing <${tag}> tags.`,
          whatHappened: 'The opening and closing tag counts do not match.',
          whyItHappened: 'A tag may be missing its closing partner, or one was closed twice.',
          gentleHint: 'Scan the section that uses this element and check each opening tag has a partner.',
          guidedHint: 'Trace nesting from the outermost element inward — which opening tag has no matching close?',
          learningHint: 'HTML is a nested tree. Every container element must be closed before its parent closes.',
          conceptReminder: 'Elements nest inside one another and must be closed in order.',
          selfCheckQuestion: 'Which element is still open when the document ends?',
          confidence: 'medium',
        }),
      );
      break; // One structural hint is enough; avoid a wall of similar messages.
    }
  }

  // 4. Form controls that are hard to reach with a screen reader.
  if (/<input\b/i.test(source) && !/<label\b/i.test(source) && !/\baria-label\s*=/i.test(source)) {
    errors.push(
      makeError({
        line: findLineIndex(lines, /<input\b/i) + 1,
        lineConfidence: 'estimated',
        severity: 'hint',
        category: 'Accessibility',
        type: 'unlabelled-input',
        title: 'Form control without a label',
        technicalMessage: 'An <input> was found without an associated label or aria-label.',
        whatHappened: 'A form field has no programmatic name.',
        whyItHappened: 'The field was added without a <label> or aria-label, so its purpose is not announced.',
        gentleHint: 'What question is this field asking the visitor?',
        guidedHint: 'Pair the field with a <label> that names it, or give it an aria-label.',
        learningHint: 'Labels connect visible text to a control so screen readers announce the field’s purpose.',
        conceptReminder: 'Every form control needs an accessible name.',
        selfCheckQuestion: 'What does a screen reader say when focus lands on this field?',
        confidence: 'medium',
      }),
    );
  }

  // 5. External resources — the sandboxed preview blocks these by default.
  if (/<script[^>]+src\s*=\s*["']https?:\/\//i.test(source) || /<link[^>]+href\s*=\s*["']https?:\/\//i.test(source)) {
    errors.push(
      makeError({
        line: findLineIndex(lines, /(<script[^>]+src|<link[^>]+href)/i) + 1,
        lineConfidence: 'exact',
        severity: 'hint',
        category: 'Security',
        type: 'external-resource',
        title: 'External resource is blocked in the preview',
        technicalMessage: 'A remote script or stylesheet reference was detected.',
        whatHappened: 'This page references a resource from another site.',
        whyItHappened: 'The learning preview blocks external resources so your workspace stays protected.',
        gentleHint: 'Do you need this file from the network, or can it live in your project?',
        guidedHint: 'Include the CSS or JavaScript in your own file, or use a same-project relative path.',
        learningHint: 'Local-first previews avoid remote requests so a page is reproducible and safe.',
        conceptReminder: 'The sandboxed preview loads only same-project files.',
        selfCheckQuestion: 'Which part of this page depends on something outside your project?',
        confidence: 'high',
      }),
    );
  }

  // 6. Missing document skeleton.
  if (!/<(!doctype|html)\b/i.test(source)) {
    warnings.push('This page has no document skeleton yet. A full page usually starts with a doctype and an <html> element.');
  }
  if (/<html\b/i.test(source) && !/<html\b[^>]*\blang\s*=/i.test(source)) {
    errors.push(
      makeError({
        line: findLineIndex(lines, /<html\b/i) + 1,
        lineConfidence: 'exact',
        severity: 'hint',
        category: 'Accessibility',
        type: 'missing-lang',
        title: 'Page language is not declared',
        technicalMessage: 'The <html> element has no lang attribute.',
        whatHappened: 'The document does not state which language its content is written in.',
        whyItHappened: 'The lang attribute was omitted, so screen readers may mispronounce the text.',
        gentleHint: 'Which language is most of this page written in?',
        guidedHint: 'Declare the page language on the <html> element, for example a two-letter language code.',
        learningHint: 'Declaring the language lets assistive technology choose the right pronunciation rules.',
        conceptReminder: 'The root element should declare the document language.',
        selfCheckQuestion: 'How would a screen reader know which language to use?',
        confidence: 'high',
      }),
    );
  }

  return {
    errors: errors.slice(0, 8),
    concepts: detectHtmlConcepts(source),
    warnings,
  };
}
