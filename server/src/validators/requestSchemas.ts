import { z } from 'zod';

/** Sections the frontend may request; AI always answers them in one request. */
export const DEEP_HELP_SECTIONS = ['overview', 'line-by-line', 'errors', 'tips', 'quiz'] as const;

export const deepAnalyzeSchema = z.object({
  source: z.string().min(1).max(12000),
  language: z.string().min(1).max(32),
  execution: z.record(z.string(), z.unknown()).nullable().optional(),
  localAnalysis: z.record(z.string(), z.unknown()).nullable().optional(),
  explanationLevel: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
  hintLevel: z.enum(['Gentle', 'Guided', 'Learning']).optional(),
  sections: z.array(z.enum(DEEP_HELP_SECTIONS)).max(DEEP_HELP_SECTIONS.length).optional(),
});

export const aiChatSchema = z.object({
  source: z.string().min(1).max(12000),
  language: z.string().min(1).max(32),
  execution: z.record(z.string(), z.unknown()).nullable().optional(),
  localAnalysis: z.record(z.string(), z.unknown()).nullable().optional(),
  explanationLevel: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
  hintLevel: z.enum(['Gentle', 'Guided', 'Learning']).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(12)
    .superRefine((messages, context) => {
      if (messages[0]?.role !== 'user') {
        context.addIssue({ code: 'custom', message: 'Chat history must start with a learner message.' });
      }
      if (messages[messages.length - 1]?.role !== 'user') {
        context.addIssue({ code: 'custom', message: 'The latest chat message must be from the learner.' });
      }
      for (let index = 1; index < messages.length; index += 1) {
        if (messages[index]?.role === messages[index - 1]?.role) {
          context.addIssue({ code: 'custom', message: 'Chat roles must alternate.' });
          break;
        }
      }
    }),
});

export const runSchema = z.object({
  source: z.string().min(1).max(51200),
  stdin: z.string().max(10240).default(''),
  language: z.enum(['c', 'cpp', 'java', 'csharp', 'go', 'php', 'ruby', 'rust', 'kotlin']),
});
