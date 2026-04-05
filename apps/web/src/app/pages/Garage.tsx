import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useGame } from '../context/GameContext';
import { Users, Sparkles, ArrowRight, Info } from 'lucide-react';

export default function Garage() {
  const [description, setDescription] = useState('');
  const navigate = useNavigate();
  const { createTeam, gameState } = useGame();

  const handleContinue = () => {
    if (!description.trim()) return;
    
    // Extract keywords from description (split by spaces/commas, trim punctuation, take first 3 non-empty words)
    const words = description
      .trim()
      .split(/[\s,]+/)
      .map((word) => word.replace(/^[^\w]+|[^\w]+$/g, ''))
      .filter((word) => word.length > 0);
    const keywords = words.slice(0, 3);
    
    // Generate a simple team name from first word
    navigate('/race-hub');
    
    // Use a placeholder for the team logo
    createTeam(teamName, '', keywords);
    navigate('/team');
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6" style={{ fontFamily: 'var(--font-body)' }}>
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0B1E3B] via-black to-[#050E1D] opacity-50" />
      
      {/* Content */}
      <div className="relative z-10 w-full max-w-2xl">
            <span className="font-medium text-[#00D4FF]" style={{ fontFamily: 'var(--font-body)' }}>Team Onboarding</span>
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#00D4FF]/20 to-[#F97316]/20 border border-[#00D4FF]/30 rounded-full mb-6">
            <Users className="w-5 h-5 text-[#00D4FF]" />
            <span className="font-['DM_Sans'] font-medium text-[#00D4FF]">Team Onboarding</span>
          </div>
          
          <h1 
            className="text-5xl md:text-6xl font-bold mb-4"
            style={{ 
              fontFamily: 'var(--font-heading)',
              background: 'linear-gradient(135deg, #00D4FF 0%, #F97316 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Welcome to {gameState.currentUser?.name ? gameState.currentUser.name + "'s" : 'Your'} Team!
          </h1>
          
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            You're about to join the race. Let's get to know you better.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-2xl p-8 md:p-12 shadow-2xl">
          {/* Info Box */}
          <div className="bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-xl p-4 mb-8 flex items-start gap-3">
            <Info className="w-5 h-5 text-[#00D4FF] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-[#00D4FF] font-['DM_Sans']">
                Your description will be used to create a unique team logo that represents your team's identity.
              </p>
            </div>
          </div>

          {/* Input Section */}
          <div className="mb-8">
            <label className="block text-white font-['Space_Grotesk'] text-xl mb-3">
              Describe yourself in a few words
            </label>
            <p className="text-gray-400 text-sm mb-4 font-['DM_Sans']">
              Tell us what makes you and your team unique. Use words that capture your style, values, or personality.
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Fast, innovative, bold, creative, determined..."
              rows={4}
              maxLength={150}
              className="w-full px-5 py-4 bg-black border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#00D4FF] focus:ring-2 focus:ring-[#00D4FF]/20 transition-all resize-none font-['DM_Sans']"
            />
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-gray-500 font-['DM_Sans']">
                Tip: Use descriptive words that inspire your team
              </p>
              <span className="text-xs text-gray-500 font-mono">
                {description.length}/150
              </span>
            </div>
          </div>

          {/* Example Keywords */}
          <div className="mb-8">
            <p className="text-sm text-gray-400 mb-3 font-['DM_Sans']">Popular choices:</p>
            <div className="flex flex-wrap gap-2">
              {['Fast', 'Bold', 'Innovative', 'Dynamic', 'Fierce', 'Unstoppable', 'Creative', 'Strategic'].map((word) => (
                <button
                  key={word}
                  onClick={() => {
                    if (description.length + word.length + 1 <= 150) {
                      setDescription(prev => prev ? `${prev}, ${word}` : word);
                    }
                  }}
                  className="px-4 py-2 bg-gray-800/50 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-lg text-gray-300 hover:text-white text-sm transition-all font-['DM_Sans']"
                >
                  {word}
                </button>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleContinue}
            disabled={!description.trim()}
            className="w-full py-5 rounded-xl font-bold text-white transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 font-['Space_Grotesk'] text-lg"
            style={{
              background: description.trim() 
                ? 'linear-gradient(135deg, #00D4FF 0%, #F97316 100%)' 
                : '#1F2937',
            }}
          >
            <Sparkles className="w-6 h-6" />
            Continue to Race Hub
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>

        {/* Footer Note */}
        <p className="text-center text-gray-500 text-sm mt-6 font-['DM_Sans']">
          Your team logo will be generated and displayed throughout the race
        </p>
      </div>
    </div>
  );
}