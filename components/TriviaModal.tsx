"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Zap } from "lucide-react";
import Button from "@/components/Button";
import Card from "@/components/Card";

interface TriviaModalProps {
  question: string;
  answer: string;
  pointsValue: number;
  onClose: (correct: boolean) => void;
}

export default function TriviaModal({
  question,
  answer,
  pointsValue,
  onClose,
}: TriviaModalProps) {
  const [userAnswer, setUserAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isCorrect =
      userAnswer.trim().toLowerCase() === answer.trim().toLowerCase();
    setCorrect(isCorrect);
    setSubmitted(true);
  }

  return (
    // Backdrop
    <div className="fixed inset-0 bg-navy-bg/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-sm border border-electric-cyan/40 shadow-cyan-lg space-y-5">
        {!submitted ? (
          <>
            <div className="text-center">
              <p className="text-electric-cyan text-xs uppercase tracking-widest mb-2 font-semibold">
                ⚡ Trivia Challenge
              </p>
              <p className="text-white font-bold text-lg leading-snug">
                {question}
              </p>
              <p className="text-slate-text text-sm mt-1">
                Answer correctly to earn{" "}
                <span className="text-neon-green font-bold">
                  +{pointsValue} pts
                </span>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Your answer…"
                autoFocus
                className="w-full bg-navy-bg border border-electric-cyan/30 rounded-lg px-4 py-3 text-white placeholder:text-slate-text/50 focus:outline-none focus:border-electric-cyan focus:ring-1 focus:ring-electric-cyan"
              />
              <Button type="submit" variant="cyan" className="w-full">
                Submit Answer
              </Button>
            </form>

            <button
              onClick={() => onClose(false)}
              className="w-full text-slate-text text-sm hover:text-white transition-colors"
            >
              Skip question
            </button>
          </>
        ) : (
          // Result state
          <div className="text-center space-y-4 animate-slide-up">
            {correct ? (
              <>
                <CheckCircle className="text-neon-green w-14 h-14 mx-auto text-glow-green" />
                <p className="text-neon-green font-black text-2xl text-glow-green">
                  Correct!
                </p>
                <div className="flex items-center justify-center gap-2 text-neon-green text-xl font-bold">
                  <Zap className="w-5 h-5" />
                  <span>+{pointsValue} Fuel</span>
                </div>
                <p className="text-slate-text text-sm">
                  Points added to your tank!
                </p>
              </>
            ) : (
              <>
                <XCircle className="text-red-400 w-14 h-14 mx-auto" />
                <p className="text-red-400 font-black text-2xl">
                  Wrong Answer!
                </p>
                <p className="text-slate-text text-sm">
                  The correct answer was:{" "}
                  <span className="text-white font-semibold">{answer}</span>
                </p>
              </>
            )}
            <Button
              variant={correct ? "green" : "outline"}
              onClick={() => onClose(correct)}
              className="w-full"
            >
              {correct ? "🏎️ Back to Race!" : "Continue Racing"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
