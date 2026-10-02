import { analyzeLocally } from './client/src/analyzers/localAnalyzer';
import { generateLocalQuestions } from './client/src/quizzes/localQuiz';

const c = analyzeLocally(
  'int main(void) {\n  for (int i = 0; i < 5; i++) {\n    printf("%d", i);\n  }\n  return 0;\n}',
  'C',
);
console.log('C concepts:', c.concepts.join(', '));

const quiz = generateLocalQuestions({ language: 'C', analysis: c, difficulty: 'Beginner', count: 5 });
console.log('C quiz questions:', quiz.length, '| first:', quiz[0]?.question?.slice(0, 70));
console.log('options per question:', quiz.map((q) => q.options.length).join(','));
