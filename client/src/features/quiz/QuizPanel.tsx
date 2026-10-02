import { useMemo, useState } from 'react';
import { ArrowRight, Check, ListChecks, RotateCcw, Trophy, X } from 'lucide-react';
import type { AnalysisLanguage, LocalAnalysis, LocalQuestion, QuizRecord } from '../../types';
import { Button, Pill, Skeleton } from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import { useQuizHistory } from '../../hooks/useQuizHistory';
import {
  generateLocalQuestions,
  INSUFFICIENT_QUESTIONS_NOTE,
  QUIZ_COUNT_OPTIONS,
  QUIZ_DIFFICULTIES,
  QUIZ_TYPE_OPTIONS,
} from '../../quizzes/localQuiz';

type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
type QuizQuestionType = NonNullable<Parameters<typeof generateLocalQuestions>[0]['types']>[number];

export function QuizPanel({
  analysis,
  language,
  projectTitle,
  projectId,
}: {
  analysis: LocalAnalysis | null;
  language: AnalysisLanguage;
  projectTitle: string;
  projectId?: string;
}) {
  const { notify } = useToast();
  const { addRecord } = useQuizHistory();
  const [difficulty, setDifficulty] = useState<Difficulty>('Beginner');
  const [typeFilter, setTypeFilter] = useState<QuizQuestionType | null>(null);
  const [count, setCount] = useState<number>(5);
  const [questions, setQuestions] = useState<LocalQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(false);

  const concepts = analysis?.concepts ?? [];

  const generate = () => {
    setLoading(true);
    // Local generation is synchronous; a short skeleton makes the state visible
    // without pretending a network call is happening.
    window.setTimeout(() => {
      const generated = generateLocalQuestions({ language, analysis, difficulty, count, types: typeFilter ? [typeFilter] : undefined });
      setQuestions(generated);
      setIndex(0);
      setSelected(null);
      setAnswers([]);
      setFinished(false);
      setLoading(false);
      if (generated.length < count) notify(INSUFFICIENT_QUESTIONS_NOTE, 'info');
    }, 120);
  };

  const current = questions[index];
  const score = useMemo(
    () => questions.reduce((total, question, questionIndex) => total + (answers[questionIndex] === question.correctIndex ? 1 : 0), 0),
    [answers, questions],
  );

  const submitAnswer = () => {
    if (selected === null || !current) return;
    const nextAnswers = [...answers];
    nextAnswers[index] = selected;
    setAnswers(nextAnswers);
  };

  const next = () => {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setSelected(null);
    } else {
      finish(answers);
    }
  };

  const finish = (finalAnswers: number[]) => {
    const finalScore = questions.reduce(
      (total, question, questionIndex) => total + (finalAnswers[questionIndex] === question.correctIndex ? 1 : 0),
      0,
    );
    const percentage = questions.length ? Math.round((finalScore / questions.length) * 100) : 0;
    const multipleChoice = questions.filter((q) => q.type !== 'true_false');
    const incorrect = multipleChoice.filter((q) => finalAnswers[questions.indexOf(q)] !== q.correctIndex);
    const conceptsToReview = Array.from(new Set(incorrect.map((q) => q.concept))).slice(0, 5);

    const record: QuizRecord = {
      id: crypto.randomUUID(),
      project: projectTitle,
      projectId,
      language: language as QuizRecord['language'],
      difficulty,
      score: finalScore,
      total: questions.length,
      percentage: `${percentage}%`,
      date: new Date().toISOString(),
      conceptsToReview,
    };
    void addRecord(record).then((result) => {
      if (!result.saved) notify(result.message, 'warning');
      else notify(result.local ? 'Quiz history saved in this browser.' : 'Quiz saved to your account.', 'success');
    });
    setFinished(true);
  };

  if (loading) {
    return (
      <div className="quiz-panel">
        <Skeleton lines={4} />
      </div>
    );
  }

  if (finished) {
    const percentage = questions.length ? Math.round((score / questions.length) * 100) : 0;
    const review = Array.from(
      new Set(questions.filter((q, i) => answers[i] !== q.correctIndex).map((q) => q.concept)),
    );
    return (
      <div className="quiz-panel quiz-result">
        <div className="quiz-badge">
          <Trophy size={21} />
        </div>
        <h3>Quiz complete</h3>
        <p>
          You scored <strong>{score}</strong> of {questions.length} ({percentage}%).
        </p>
        <div className="progress">
          <i style={{ width: `${percentage}%` }} />
        </div>
        {review.length ? (
          <div className="concept-list">
            <strong>Concepts to review</strong>
            {review.map((concept) => (
              <span key={concept}>
                <RotateCcw size={14} /> {concept}
              </span>
            ))}
          </div>
        ) : (
          <p className="muted">Excellent — you answered every question correctly. Keep this momentum going.</p>
        )}
        <p className="encouragement">Great effort. Every question you review makes the next attempt easier.</p>
        <div className="quiz-actions">
          <Button variant="soft" icon={RotateCcw} onClick={generate}>
            Try Again
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setFinished(false);
              setQuestions([]);
            }}
          >
            Change settings
          </Button>
        </div>
      </div>
    );
  }

  if (questions.length && current) {
    const answered = answers[index] !== undefined;
    const chosen = answered ? answers[index] : selected;
    const correct = answered ? chosen === current.correctIndex : null;
    return (
      <div className="quiz-panel">
        <div className="quiz-progress">
          <span>
            Question {index + 1} of {questions.length}
          </span>
          <span>{Math.round(((index + 1) / questions.length) * 100)}%</span>
        </div>
        <div className="progress">
          <i style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
        </div>
        <div className="quiz-meta">
          <Pill tone="indigo">{current.type.replace(/_/g, ' ')}</Pill>
          <Pill tone="neutral">{current.difficulty}</Pill>
        </div>
        <h3>{current.prompt}</h3>
        <div className="answers">
          {current.options.map((option, optionIndex) => {
            const isSelected = chosen === optionIndex;
            const state = answered
              ? optionIndex === current.correctIndex
                ? 'correct'
                : isSelected
                  ? 'incorrect'
                  : ''
              : isSelected
                ? 'selected'
                : '';
            return (
              <button
                key={option}
                className={state}
                disabled={answered}
                onClick={() => setSelected(optionIndex)}
              >
                <span>{String.fromCharCode(65 + optionIndex)}</span>
                {option}
                {answered && optionIndex === current.correctIndex ? <Check size={15} /> : null}
                {answered && isSelected && optionIndex !== current.correctIndex ? <X size={15} /> : null}
              </button>
            );
          })}
        </div>
        {answered ? (
          <div className={`quiz-feedback ${correct ? 'success' : 'warning'}`} role="status">
            <strong>{correct ? 'Correct' : 'Not quite — here is the idea behind it'}</strong>
            <p>{current.explanation}</p>
          </div>
        ) : null}
        <Button
          disabled={selected === null && !answered}
          onClick={answered ? next : submitAnswer}
          icon={answered ? ArrowRight : ListChecks}
        >
          {answered ? (index + 1 < questions.length ? 'Next question' : 'See results') : 'Submit answer'}
        </Button>
      </div>
    );
  }

  return (
    <div className="quiz-panel">
      <div className="quiz-empty">
        <div className="quiz-badge">
          <ListChecks size={21} />
        </div>
        <h3>Make this code stick</h3>
        <p>
          {concepts.length
            ? 'Generate a short local quiz from the concepts detected in your own code.'
            : 'Analyze your code first so CodeMentor AI can generate safe questions from it.'}
        </p>
        <div className="quiz-settings-editor">
          <label>
            Difficulty
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)} aria-label="Quiz difficulty">
              {QUIZ_DIFFICULTIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Questions
            <select value={count} onChange={(event) => setCount(Number(event.target.value))}>
              {QUIZ_COUNT_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Question type
            <select
              value={typeFilter === null ? 'all' : typeFilter}
              onChange={(event) => {
                const value = event.target.value;
                setTypeFilter(value === 'all' ? null : (value as QuizQuestionType));
              }}
              aria-label="Question type"
            >
              <option value="all">All types</option>
              {QUIZ_TYPE_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Button disabled={!concepts.length} onClick={generate} icon={ListChecks}>
          Generate Local Quiz
        </Button>
        {!concepts.length ? <small>{INSUFFICIENT_QUESTIONS_NOTE}</small> : null}
      </div>
    </div>
  );
}
