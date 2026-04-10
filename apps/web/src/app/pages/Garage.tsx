import React, { useState } from 'react';
import { Skeleton } from '@velocity-gp/ui/skeleton';
import { useNavigate } from 'react-router';
import { useGame } from '../context/GameContext';
import { Sparkles, ArrowRight } from 'lucide-react';

export default function Garage() {
  // TODO(figma-sync): Replace keyword-based generation with description-driven onboarding to match the updated Team Onboarding design flow. | Figma source: src/app/pages/Garage.tsx description textarea + suggestion chips | Impact: user flow
  const [keyword1, setKeyword1] = useState('');
  const [keyword2, setKeyword2] = useState('');
  const [keyword3, setKeyword3] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [generatedTeamName, setGeneratedTeamName] = useState('');
  const [generatedCarImage, setGeneratedCarImage] = useState('');
  const navigate = useNavigate();
  const { createTeam } = useGame();

  const handleGenerate = () => {
    if (!keyword1 || !keyword2 || !keyword3) return;

    setIsGenerating(true);

    setTimeout(() => {
      // Local generation stub emulates async AI output until backend image/name generation is wired.
      const teamName = `${keyword1} ${keyword3}s`;
      setGeneratedTeamName(teamName);
      setGeneratedCarImage(
        'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&h=500&fit=crop'
      );
      setIsGenerating(false);
      setIsComplete(true);
    }, 2500);
  };

  const handleFinalize = () => {
    // TODO(figma-sync): Route finalized onboarding to /team parity path (TeamPage) instead of direct /race-hub jump. | Figma source: src/app/pages/Garage.tsx handleContinue -> navigate('/team') | Impact: user flow
    // Persist generated identity in shared context so race/pit/leaderboard pages can consume it.
    createTeam(generatedTeamName, generatedCarImage, [keyword1, keyword2, keyword3]);
    navigate('/race-hub');
  };

  return (
    <div className="min-h-screen bg-black p-6" style={{ fontFamily: 'var(--font-body)' }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-400">AI Design Studio</span>
          </div>
          <h1
            className="text-4xl font-bold text-white mb-2"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Create Your Team
          </h1>
          <p className="text-gray-400">Generate a unique team identity using AI</p>
        </div>

        {/* Car Preview */}
        <div className="mb-8">
          <div className="w-full aspect-[16/10] rounded-2xl overflow-hidden bg-gray-900 border border-gray-800 relative">
            {!isGenerating && !isComplete && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-orange-500/20 border border-gray-700 flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-gray-600" />
                  </div>
                  <p className="text-gray-500 text-sm">Your AI-generated car will appear here</p>
                </div>
              </div>
            )}

            {isGenerating && (
              <div className="absolute inset-0 p-6">
                <Skeleton className="w-full h-full rounded-xl bg-gradient-to-br from-blue-500/10 to-orange-500/10 animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-white font-medium">Generating your team...</p>
                  </div>
                </div>
              </div>
            )}

            {isComplete && (
              <>
                <img
                  src={generatedCarImage}
                  alt="Generated F1 Car"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <h2
                    className="text-3xl font-bold text-white"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    {generatedTeamName}
                  </h2>
                  <div className="flex gap-2 mt-3">
                    {[keyword1, keyword2, keyword3].map((kw, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-xs text-white"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Input Fields */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Keyword 1</label>
            <input
              type="text"
              placeholder="e.g., Fast"
              value={keyword1}
              onChange={(e) => setKeyword1(e.target.value)}
              disabled={isComplete}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Keyword 2</label>
            <input
              type="text"
              placeholder="e.g., Corporate"
              value={keyword2}
              onChange={(e) => setKeyword2(e.target.value)}
              disabled={isComplete}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Keyword 3</label>
            <input
              type="text"
              placeholder="e.g., Tiger"
              value={keyword3}
              onChange={(e) => setKeyword3(e.target.value)}
              disabled={isComplete}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50"
            />
          </div>
        </div>

        {/* Action Button */}
        {!isComplete ? (
          <button
            onClick={handleGenerate}
            disabled={!keyword1 || !keyword2 || !keyword3 || isGenerating}
            className="w-full py-4 rounded-xl font-semibold text-white transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #3B82F6 0%, #F97316 100%)',
            }}
          >
            <Sparkles className="w-5 h-5" />
            {isGenerating ? 'Generating...' : 'Generate Team Identity'}
          </button>
        ) : (
          <button
            onClick={handleFinalize}
            className="w-full py-4 rounded-xl font-semibold bg-green-500 hover:bg-green-600 text-white transition-all duration-200 flex items-center justify-center gap-2"
          >
            Continue to Race
            <ArrowRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
