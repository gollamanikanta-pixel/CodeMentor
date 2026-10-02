import type {
  AnalysisLanguage,
  LocalAnalysis,
  LocalQuestion,
  QuizQuestionType,
} from '../types';

export type GenerateQuizOptions = {
  language: AnalysisLanguage;
  analysis: LocalAnalysis | null;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  count: number;
  types?: QuizQuestionType[];
};

let sequence = 0;
const nextId = () => `q-${(sequence += 1)}`;

type ConceptBankEntry = {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
};

/** Concept questions are language-general so they stay safe to generate offline. */
const CONCEPT_BANK: Record<string, ConceptBankEntry> = {
  Functions: {
    question: 'What is the main benefit of moving repeated work into a function?',
    options: [
      'It names one idea once so the logic is easier to read and reuse',
      'It makes the program run without any inputs',
      'It removes the need to test the program',
      'It guarantees there will be no errors',
    ],
    correctIndex: 0,
    explanation: 'Functions give a name to a single idea, which makes code easier to read, reuse and test.',
  },
  Loops: {
    question: 'When is a loop the right tool?',
    options: [
      'When the same steps should repeat for each item or while a condition holds',
      'When you want to store a single value',
      'When you want to hide an error',
      'When the code should run only once',
    ],
    correctIndex: 0,
    explanation: 'Loops express repetition, so you describe the step once and let the program repeat it.',
  },
  Conditions: {
    question: 'What does an if statement let a program do?',
    options: [
      'Choose different behaviour depending on a condition',
      'Repeat the same step forever',
      'Store values in a list',
      'Print output automatically',
    ],
    correctIndex: 0,
    explanation: 'Conditions branch the flow so different inputs can lead to different behaviour.',
  },
  Return: {
    question: 'What happens when a function reaches a return statement?',
    options: [
      'It hands a value back to the caller and stops running',
      'It restarts the program from the top',
      'It prints the value to the screen automatically',
      'It waits for input from the user',
    ],
    correctIndex: 0,
    explanation: 'return ends the function and passes a result back to the code that called it.',
  },
  Lists: {
    question: 'In a list, what is the valid range of positions?',
    options: [
      'From 0 up to the length minus one',
      'From 1 up to the length',
      'Only position 0 is valid',
      'Any number, including the length itself',
    ],
    correctIndex: 0,
    explanation: 'Positions are zero-based, so the last valid index is length − 1.',
  },
  Arrays: {
    question: 'In an array, what is the valid range of indices?',
    options: [
      'From 0 up to length − 1',
      'From 1 up to length',
      'Only index 0',
      'Any index, even past the end',
    ],
    correctIndex: 0,
    explanation: 'Arrays are zero-indexed; the final valid index is length − 1.',
  },
  Dictionaries: {
    question: 'What is important when reading a value from a dictionary?',
    options: [
      'The key must exist, or the program needs a safe fallback',
      'The dictionary must be sorted first',
      'The value must be a number',
      'The dictionary can only store one key',
    ],
    correctIndex: 0,
    explanation: 'Unlike lists, dictionaries are accessed by key, so a missing key needs handling.',
  },
  Objects: {
    question: 'Which habit keeps object access safe?',
    options: [
      'Check that a property exists before using it',
      'Assume every property is always defined',
      'Always delete unused properties',
      'Never read nested properties',
    ],
    correctIndex: 0,
    explanation: 'Checking for presence prevents reading properties of an undefined value.',
  },
  Input: {
    question: 'Why should program input be validated?',
    options: [
      'Because users may supply values the program did not expect',
      'Because input is always a number',
      'Because validation makes the program longer',
      'Because input never changes',
    ],
    correctIndex: 0,
    explanation: 'Validating input keeps the program predictable even when values are unusual.',
  },
  Output: {
    question: 'What is the purpose of printing output while learning?',
    options: [
      'To observe what the program actually did at each step',
      'To make the program run faster',
      'To permanently store the data',
      'To replace the need for tests',
    ],
    correctIndex: 0,
    explanation: 'Output is evidence: it shows what the program really produced.',
  },
  Imports: {
    question: 'What does an import statement represent?',
    options: [
      'An external dependency the program needs to run',
      'A local variable definition',
      'A loop that repeats imports',
      'A comment about the code',
    ],
    correctIndex: 0,
    explanation: 'Imports bring in code from other modules, so they are dependencies.',
  },
  Comparisons: {
    question: 'Why is strict comparison usually preferred in JavaScript?',
    options: [
      'It compares both type and value, avoiding hidden conversions',
      'It runs faster than any other operator',
      'It automatically fixes type problems',
      'It works only with strings',
    ],
    correctIndex: 0,
    explanation: 'Strict comparison avoids surprising conversions that loose equality allows.',
  },
  'Data types': {
    question: 'Why do data types matter in a program?',
    options: [
      'Operations expect specific types, and mismatches cause runtime surprises',
      'Types only affect how code is coloured',
      'Types are optional in every language',
      'Types make programs slower',
    ],
    correctIndex: 0,
    explanation: 'Each operation has expectations about the values it works with.',
  },
  Variables: {
    question: 'What does a variable give a program?',
    options: [
      'A named place to hold a value you can refer to later',
      'A way to repeat code',
      'A permanent database record',
      'A type of loop',
    ],
    correctIndex: 0,
    explanation: 'A variable names a value so you can reuse and reason about it.',
  },
  SELECT: {
    question: 'What does the SELECT clause decide in a query?',
    options: [
      'Which columns the result will include',
      'Which table to delete',
      'How many users can connect',
      'The order the tables were created',
    ],
    correctIndex: 0,
    explanation: 'SELECT lists the columns (or expressions) the query returns.',
  },
  Filtering: {
    question: 'What does a WHERE clause do?',
    options: [
      'Limits which rows take part in the query',
      'Sorts the final rows',
      'Creates a new table',
      'Joins two tables',
    ],
    correctIndex: 0,
    explanation: 'WHERE acts as a filter that decides which rows qualify.',
  },
  Aggregation: {
    question: 'Why does an aggregate often need GROUP BY?',
    options: [
      'It decides which rows each aggregate summarises',
      'It is required for every query',
      'It sorts the output for you',
      'It removes duplicate columns',
    ],
    correctIndex: 0,
    explanation: 'GROUP BY defines the groups that aggregates such as SUM or AVG operate over.',
  },
  Joins: {
    question: 'What does a join condition (ON) describe?',
    options: [
      'How rows from two tables relate to each other',
      'How many rows to delete',
      'Which columns to hide',
      'The order of the result',
    ],
    correctIndex: 0,
    explanation: 'ON names the key relationship used to match rows across tables.',
  },
  Grouping: {
    question: 'What is the effect of grouping rows?',
    options: [
      'It collapses rows that share a value into one summarised row',
      'It deletes rows that are similar',
      'It hides duplicate columns',
      'It converts all values to text',
    ],
    correctIndex: 0,
    explanation: 'Grouping collects related rows so aggregates can summarise them.',
  },
  'Type annotations': {
    question: 'What do type annotations add to a program?',
    options: [
      'A description of the shape of a value the compiler can check',
      'Faster runtime performance',
      'Automatic error correction',
      'A way to skip writing tests',
    ],
    correctIndex: 0,
    explanation: 'Annotations let the compiler verify how values are used before the code runs.',
  },
  Types: {
    question: 'Why declare an explicit type or interface?',
    options: [
      'It documents the shape of data and lets the compiler catch mistakes',
      'It makes the program run without a runtime',
      'It removes the need for variables',
      'It changes how the program is displayed',
    ],
    correctIndex: 0,
    explanation: 'Named types explain intent and enable earlier feedback.',
  },
  Ordering: {
    question: 'What does ORDER BY control?',
    options: [
      'The order of the rows in the result',
      'Which rows are returned',
      'How the table is stored on disk',
      'The number of columns returned',
    ],
    correctIndex: 0,
    explanation: 'ORDER BY sorts the result set by the listed columns.',
  },
  Subqueries: {
    question: 'Why might a query use a subquery?',
    options: [
      'To compute an intermediate result the outer query can use',
      'To permanently delete a table',
      'To connect to another database',
      'To speed up every query automatically',
    ],
    correctIndex: 0,
    explanation: 'Subqueries let one query build a result another query can use.',
  },
  Recursion: {
    question: 'What must every recursive function have so it can stop?',
    options: [
      'A base case that returns without calling itself again',
      'A loop around the recursive call',
      'A global variable to count the calls',
      'A try/except around the whole function',
    ],
    correctIndex: 0,
    explanation: 'Without a base case the calls keep stacking until the program runs out of room.',
  },
  Stacks: {
    question: 'Which order does a stack hand items back in?',
    options: [
      'Last in, first out',
      'First in, first out',
      'Random order',
      'Sorted by value',
    ],
    correctIndex: 0,
    explanation: 'A stack only exposes one end, so the item added last is the one you get back first.',
  },
  Queues: {
    question: 'Where does a queue take its next item from?',
    options: [
      'The front, where the oldest item sits',
      'The back, where the newest item sits',
      'Anywhere the program chooses',
      'The middle of the collection',
    ],
    correctIndex: 0,
    explanation: 'A queue removes from the front and adds at the back, which keeps arrival order.',
  },
};

function conceptQuestion(concept: string, difficulty: LocalQuestion['difficulty']): LocalQuestion | null {
  const entry = CONCEPT_BANK[concept];
  if (!entry) return null;
  return {
    id: nextId(),
    type: 'concept',
    prompt: entry.question,
    options: [...entry.options],
    correctIndex: entry.correctIndex,
    explanation: entry.explanation,
    concept,
    difficulty,
  };
}

function trueFalse(concept: string): LocalQuestion | null {
  const statements: Record<string, { prompt: string; answer: boolean; explanation: string }> = {
    Functions: {
      prompt: 'A function lets you name one idea and reuse it, instead of repeating the same lines.',
      answer: true,
      explanation: 'Functions express reuse and give repeated logic a single name.',
    },
    Loops: {
      prompt: 'A loop means the program will always repeat forever.',
      answer: false,
      explanation: 'Loops repeat while a condition holds or for a fixed set of items; they can finish.',
    },
    Conditions: {
      prompt: 'Different inputs can make a program follow different branches.',
      answer: true,
      explanation: 'Conditions exist precisely so behaviour can depend on the data.',
    },
    Return: {
      prompt: 'After a return statement runs, the function stops and hands back a value.',
      answer: true,
      explanation: 'return ends the current function call and passes a result back.',
    },
    Lists: {
      prompt: 'The first item of a list is at position 0.',
      answer: true,
      explanation: 'Sequences are zero-indexed in Python and JavaScript.',
    },
    Arrays: {
      prompt: 'An array index equal to the length is still inside the array.',
      answer: false,
      explanation: 'The length itself is one past the last valid index.',
    },
    Input: {
      prompt: 'Program input never needs validation because users always type numbers.',
      answer: false,
      explanation: 'Input is untrusted; validation keeps behaviour predictable.',
    },
    Filtering: {
      prompt: 'A WHERE clause limits which rows take part in a query.',
      answer: true,
      explanation: 'WHERE acts as the filter for a query.',
    },
    Aggregation: {
      prompt: 'An aggregate function summarises many rows into fewer values.',
      answer: true,
      explanation: 'Aggregates such as SUM and AVG reduce many rows to a summary.',
    },
    Comparisons: {
      prompt: 'In JavaScript, == compares types strictly as well as values.',
      answer: false,
      explanation: '== performs type conversion; === compares type and value.',
    },
  };
  const entry = statements[concept];
  if (!entry) return null;
  return {
    id: nextId(),
    type: 'true_false',
    prompt: entry.prompt,
    options: ['True', 'False'],
    correctIndex: entry.answer ? 0 : 1,
    explanation: entry.explanation,
    concept,
    difficulty: 'Beginner',
  };
}

function issueQuestion(analysis: LocalAnalysis): LocalQuestion | null {
  const first = analysis.errors[0];
  if (!first) return null;
  const area = first.line ? `the area around line ${first.line}` : 'the reported area';
  return {
    id: nextId(),
    type: 'find_issue',
    prompt: `A ${first.type} pattern was detected. Where would you look first?`,
    options: [
      `Inspect ${area} and the values it receives`,
      'Rewrite the whole program from scratch',
      'Ignore the message and run it again unchanged',
      'Delete the function entirely',
    ],
    correctIndex: 0,
    explanation:
      'Debugging starts with careful inspection of the reported area and the values it receives — never with a blind rewrite.',
    concept: first.category,
    difficulty: 'Intermediate',
  };
}

function strategyQuestion(concept: string): LocalQuestion {
  return {
    id: nextId(),
    type: 'debugging_strategy',
    prompt: `You suspect a problem involving ${concept}. What is the best next step?`,
    options: [
      'Change one small thing, then run the code again to compare behaviour',
      'Change many things at once so it is faster',
      'Copy an unrelated solution from the internet',
      'Assume the language is broken',
    ],
    correctIndex: 0,
    explanation: 'Small, isolated changes let you confirm cause and effect instead of guessing.',
    concept,
    difficulty: 'Intermediate',
  };
}

/**
 * Builds a quiz entirely from the learner's own code, analysis and execution
 * results. It never reveals an exact correction, only concepts and strategy.
 */
export function generateLocalQuestions(options: GenerateQuizOptions): LocalQuestion[] {
  const { language, analysis, difficulty, count, types } = options;
  const allowed = types && types.length ? new Set(types) : null;
  const concepts = analysis?.concepts?.length
    ? analysis.concepts
    : ['Variables', 'Output'];

  const questions: LocalQuestion[] = [];
  const conceptPool = [...concepts, ...Object.keys(CONCEPT_BANK).filter((key) => !concepts.includes(key))];

  for (const concept of conceptPool) {
    if (questions.length >= count * 2) break;
    const question = conceptQuestion(concept, difficulty);
    if (question && (!allowed || allowed.has(question.type))) questions.push(question);
    const tf = trueFalse(concept);
    if (tf && (!allowed || allowed.has(tf.type))) questions.push(tf);
  }

  if (analysis) {
    const issue = issueQuestion(analysis);
    if (issue && (!allowed || allowed.has(issue.type))) questions.unshift(issue);
  }

  if (!allowed || allowed.has('debugging_strategy')) {
    questions.push(strategyQuestion(concepts[0] ?? 'this program'));
  }

  // Deterministic selection keeps quizzes reproducible per code version.
  const unique: LocalQuestion[] = [];
  const seen = new Set<string>();
  for (const question of questions) {
    if (seen.has(question.prompt)) continue;
    seen.add(question.prompt);
    unique.push(question);
  }

  const trimmed = unique.slice(0, count);
  return trimmed.map((question) => ({
    ...question,
    difficulty,
    concept: question.concept || language,
  }));
}

export const QUIZ_COUNT_OPTIONS = [5, 10, 15] as const;
export const QUIZ_DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'] as const;
export const QUIZ_TYPE_OPTIONS: QuizQuestionType[] = [
  'multiple_choice',
  'true_false',
  'concept',
  'find_issue',
  'debugging_strategy',
  'output_prediction',
];

export const INSUFFICIENT_QUESTIONS_NOTE =
  'CodeMentor generated the available safe questions from this program. Add more concepts or analyze another program for more practice.';
