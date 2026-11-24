'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/client-api';
import { MathRenderer } from '@/components/MathRenderer';

export default function StudentQuizPlayerPage() {
  const params = useParams();
  const quizId = params?.id;
  const router = useRouter();

  const [quiz, setQuiz] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]); // array of 0-3 or null
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState('');
  const submitRef = useRef(null);

  // Fetch quiz on mount
  useEffect(() => {
    if (!quizId) return;
    async function loadQuiz() {
      setIsLoading(true);
      setErrorBanner('');
      try {
        const data = await apiRequest(`/api/quizzes/${quizId}`);
        if (data.quiz) {
          setQuiz(data.quiz);
          const qCount = data.quiz.questions?.length || 0;
          setAnswers(new Array(qCount).fill(null));
          setTimeLeftSeconds(qCount * 120); // 2 mins per question
        } else {
          throw new Error('Quiz not found');
        }
      } catch (err) {
        setErrorBanner(err.message || 'Failed to load quiz');
      } finally {
        setIsLoading(false);
      }
    }
    loadQuiz();
  }, [quizId]);

  // Countdown timer while active
  useEffect(() => {
    if (submissionResult || timeLeftSeconds <= 0 || !quiz) return;
    const interval = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          submitRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeftSeconds, submissionResult, quiz]);

  function handleSelectOption(optIndex) {
    if (submissionResult) return;
    setAnswers((prev) => {
      const copy = [...prev];
      copy[currentQuestionIndex] = optIndex;
      return copy;
    });
  }

  async function handleSubmitQuiz() {
    if (isSubmitting || submissionResult) return;
    setIsSubmitting(true);
    setErrorBanner('');

    try {
      const data = await apiRequest(`/api/quizzes/${quizId}/attempt`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });
      setSubmissionResult(data);
    } catch (err) {
      setErrorBanner(err.message || 'Failed to submit quiz attempt');
    } finally {
      setIsSubmitting(false);
    }
  }
  useEffect(() => {
    submitRef.current = handleSubmitQuiz;
  });

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-on-surface-variant font-medium">Preparing test environment...</p>
      </div>
    );
  }

  if (errorBanner && !quiz) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4">
        <span className="material-symbols-outlined text-[48px] text-error">error</span>
        <h2 className="text-lg font-bold text-on-surface">{errorBanner}</h2>
        <Link
          href="/student/quiz"
          className="inline-flex px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold"
        >
          Return to Quizzes
        </Link>
      </div>
    );
  }

  const questions = quiz?.questions || [];
  const currentQ = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const answeredCount = answers.filter((a) => a !== null).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Test Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/student/quiz"
            className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-on-surface leading-tight">{quiz.title}</h1>
            <span className="text-xs text-on-surface-variant">
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </span>
          </div>
        </div>

        {!submissionResult && (
          <div className="flex items-center gap-4">
            {/* Countdown Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-primary font-mono text-sm font-bold">
              <span className="material-symbols-outlined text-[18px]">timer</span>
              <span>{formatTime(timeLeftSeconds)}</span>
            </div>

            <button
              onClick={handleSubmitQuiz}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>Submit Test</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {errorBanner && (
        <div className="p-3 rounded-lg bg-error-container text-on-error-container text-xs flex items-center justify-between">
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner('')} className="font-bold underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* RESULTS VIEW ONCE SUBMITTED */}
      {submissionResult ? (
        <div className="space-y-6">
          {/* Summary Score Banner */}
          <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 text-primary flex flex-col items-center justify-center font-bold">
                <span className="text-2xl leading-none">{submissionResult.score}</span>
                <span className="text-xs text-on-surface-variant font-normal">/ {submissionResult.total}</span>
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold uppercase">
                  {Math.round((submissionResult.score / submissionResult.total) * 100)}% Accuracy
                </span>
                <h2 className="text-xl font-bold text-on-surface mt-2">Test Attempt Evaluated</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Your attempt has been scored server-side against vetted faculty solutions.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSubmissionResult(null);
                  setAnswers(new Array(totalQuestions).fill(null));
                  setCurrentQuestionIndex(0);
                  setTimeLeftSeconds(totalQuestions * 120);
                }}
                className="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container text-primary text-xs font-semibold border border-outline-variant/30 transition-colors"
              >
                Re-attempt DPP
              </button>
              <Link
                href="/student/quiz"
                className="px-4 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold transition-colors"
              >
                Back to Tests
              </Link>
            </div>
          </div>

          {/* Question Breakdown */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-on-surface">Detailed Solutions &amp; Explanations</h3>
            {questions.map((q, qIdx) => {
              const res = submissionResult.results?.[qIdx];
              const studentAnswer = answers[qIdx];
              const isCorrect = res?.correct;

              return (
                <div
                  key={qIdx}
                  className={`p-5 rounded-2xl border bg-surface-container-lowest shadow-sm space-y-4 ${
                    isCorrect ? 'border-tertiary/40' : 'border-error/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-surface-container text-on-surface flex items-center justify-center font-bold text-xs">
                        Q{qIdx + 1}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                          isCorrect
                            ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                            : 'bg-error-container text-on-error-container'
                        }`}
                      >
                        {isCorrect ? 'Correct' : 'Incorrect'}
                      </span>
                    </div>

                    {res?.sourcePage && (
                      <span className="text-xs text-on-surface-variant">
                        Reference: Lecture Notes (Pg {res.sourcePage})
                      </span>
                    )}
                  </div>

                  <div className="text-sm font-medium text-on-surface">
                    <MathRenderer content={q.question} />
                  </div>

                  {/* Options display with correct/incorrect highlights */}
                  <div className="space-y-2">
                    {q.options.map((opt, optIdx) => {
                      const isTeacherCorrect = optIdx === res?.correctIndex;
                      const isStudentChosen = optIdx === studentAnswer;

                      let optClasses = 'border-outline-variant/30 bg-surface-container-low text-on-surface';
                      if (isTeacherCorrect) {
                        optClasses = 'border-tertiary bg-tertiary/10 text-on-surface font-semibold';
                      } else if (isStudentChosen && !isCorrect) {
                        optClasses = 'border-error bg-error/10 text-error';
                      }

                      return (
                        <div
                          key={optIdx}
                          className={`flex items-center gap-3 p-3 rounded-xl border text-xs ${optClasses}`}
                        >
                          <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold border border-current shrink-0">
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <div className="flex-1">
                            <MathRenderer content={opt} />
                          </div>
                          {isTeacherCorrect && (
                            <span className="material-symbols-outlined text-tertiary text-[18px]">
                              check_circle
                            </span>
                          )}
                          {isStudentChosen && !isCorrect && (
                            <span className="material-symbols-outlined text-error text-[18px]">
                              cancel
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation card */}
                  {res?.explanation && (
                    <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface space-y-1">
                      <span className="font-bold text-primary flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">lightbulb</span>
                        Faculty Solution Explanation:
                      </span>
                      <MathRenderer content={res.explanation} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ACTIVE TEST TAKING VIEW */
        <div className="grid grid-cols-12 gap-6">
          {/* Main Question Display */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
                <span className="px-2.5 py-1 rounded-lg bg-surface-container text-primary font-bold text-xs uppercase tracking-wider">
                  Question {currentQuestionIndex + 1}
                </span>
                <span className="text-xs text-on-surface-variant font-medium capitalize">
                  Difficulty: {currentQ?.difficulty || 'Medium'}
                </span>
              </div>

              {/* Question Text */}
              <div className="text-base text-on-surface font-medium leading-relaxed">
                <MathRenderer content={currentQ?.question || ''} />
              </div>

              {/* Options */}
              <div className="space-y-3 pt-2">
                {currentQ?.options?.map((opt, optIdx) => {
                  const isSelected = answers[currentQuestionIndex] === optIdx;
                  return (
                    <div
                      key={optIdx}
                      onClick={() => handleSelectOption(optIdx)}
                      className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-sm text-primary font-semibold'
                          : 'border-outline-variant/30 bg-surface-container-low hover:bg-surface-container text-on-surface'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border ${
                          isSelected ? 'border-primary bg-primary text-on-primary' : 'border-outline text-on-surface-variant'
                        }`}
                      >
                        {String.fromCharCode(65 + optIdx)}
                      </div>
                      <div className="flex-1 text-sm">
                        <MathRenderer content={opt} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Prev / Clear / Next Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-outline-variant/20">
                <button
                  onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="px-4 py-2 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container disabled:opacity-40 text-xs font-semibold transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  <span>Previous</span>
                </button>

                <button
                  onClick={() => handleSelectOption(null)}
                  className="text-xs text-on-surface-variant hover:text-error transition-colors font-medium"
                >
                  Clear Selection
                </button>

                <button
                  onClick={() => setCurrentQuestionIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                  disabled={currentQuestionIndex === totalQuestions - 1}
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container disabled:opacity-40 text-xs font-semibold transition-colors flex items-center gap-1"
                >
                  <span>Next</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>

          {/* Question Navigator Matrix */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-on-surface">Question Palette</h3>

              <div className="flex items-center justify-between text-xs text-on-surface-variant pb-2 border-b border-outline-variant/20">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                  Answered: {answeredCount}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-surface-container-high" />
                  Remaining: {totalQuestions - answeredCount}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2.5">
                {questions.map((_, i) => {
                  const isCurrent = i === currentQuestionIndex;
                  const isAnswered = answers[i] !== null;

                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentQuestionIndex(i)}
                      className={`h-10 rounded-xl font-bold text-xs flex items-center justify-center transition-all ${
                        isCurrent
                          ? 'ring-2 ring-primary ring-offset-2 bg-primary text-on-primary shadow-sm'
                          : isAnswered
                          ? 'bg-primary/20 text-primary border border-primary/40'
                          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-outline-variant/20">
                <button
                  onClick={handleSubmitQuiz}
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
                  <span>Finish &amp; Submit Test</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
