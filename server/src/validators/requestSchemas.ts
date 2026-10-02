import { z } from 'zod';

/** Sections the frontend may request; AI always answers them in one request. */
export const DEEP_HELP_SECTIONS = ['overview', 'line-by-line', 'errors', 'tips', 'quiz'] as const;

export const deepAnalyzeSchema = z.object({
  source: z.string().min(1).max(12000),
  language: z.string().min(1).max(32),
  execution: z.record(z.string(), z.unknown()).nullable().optional(),
  localAnalysis: z.record(z.string(), z.unknown()).optional(),
  explanationLevel: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
  hintLevel: z.enum(['Gentle', 'Guided', 'Learning']).optional(),
  sections: z.array(z.enum(DEEP_HELP_SECTIONS)).max(DEEP_HELP_SECTIONS.length).optional(),
});

export const runSchema = z.object({
  source: z.string().min(1).max(51200),
  stdin: z.string().max(10240).default(''),
  language: z.enum(['c', 'cpp', 'java', 'csharp', 'go', 'php', 'ruby', 'rust', 'kotlin']),
});
