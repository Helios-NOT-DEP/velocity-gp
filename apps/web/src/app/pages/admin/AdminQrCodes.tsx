import React, { useMemo, useState } from 'react';
import { Check, Plus, QrCode, Trash2, X } from 'lucide-react';
import { adminDemoQrCodes, type AdminQrCode } from '../../admin/adminViewData';

export default function AdminQrCodes() {
  const [qrCodes, setQrCodes] = useState<AdminQrCode[]>(adminDemoQrCodes);
  const [newQRName, setNewQRName] = useState('');
  const [newQRPoints, setNewQRPoints] = useState('100');

  const activeCount = useMemo(() => qrCodes.filter((code) => code.active).length, [qrCodes]);

  function handleCreateQRCode() {
    if (!newQRName.trim()) {
      return;
    }

    const points = Number.parseInt(newQRPoints, 10);
    if (!Number.isFinite(points) || points <= 0) {
      return;
    }

    setQrCodes((existing) => [
      {
        id: `qr-${Date.now()}`,
        name: newQRName.trim(),
        points,
        active: true,
        scanCount: 0,
      },
      ...existing,
    ]);
    setNewQRName('');
    setNewQRPoints('100');
  }

  function toggleStatus(id: string) {
    setQrCodes((existing) =>
      existing.map((code) => (code.id === id ? { ...code, active: !code.active } : code))
    );
  }

  function removeCode(id: string) {
    setQrCodes((existing) => existing.filter((code) => code.id !== id));
  }

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl">QR Codes</h2>
        <p className="text-sm text-gray-400">
          {activeCount} active / {qrCodes.length} total
        </p>
      </div>

      <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6">
        <h3 className="font-['Space_Grotesk'] text-2xl mb-4 flex items-center gap-2">
          <Plus className="w-6 h-6 text-[#00D4FF]" />
          Create New QR Code
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">QR Code Name</label>
            <input
              type="text"
              value={newQRName}
              onChange={(event) => setNewQRName(event.target.value)}
              placeholder="e.g., Checkpoint Alpha"
              className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00D4FF]"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Point Value</label>
            <input
              type="number"
              value={newQRPoints}
              onChange={(event) => setNewQRPoints(event.target.value)}
              className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00D4FF]"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleCreateQRCode}
              className="w-full py-3 px-6 bg-gradient-to-r from-[#00D4FF] to-[#00A3CC] text-black font-['DM_Sans'] font-bold rounded-lg hover:opacity-90 transition-all"
            >
              Generate QR Code
            </button>
          </div>
        </div>
      </article>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {qrCodes.map((qrCode) => (
          <article
            key={qrCode.id}
            className={`bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border rounded-xl p-6 ${
              qrCode.active ? 'border-[#39FF14]/30' : 'border-gray-800 opacity-70'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-['Space_Grotesk'] text-lg">{qrCode.name}</h3>
              <span
                className={`px-2 py-1 rounded text-xs font-mono ${
                  qrCode.active
                    ? 'bg-[#39FF14]/20 text-[#39FF14]'
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                {qrCode.active ? 'ACTIVE' : 'DISABLED'}
              </span>
            </div>

            <div className="bg-white p-4 rounded-lg mb-4">
              <div className="aspect-square w-full rounded-md border border-gray-200 grid place-items-center bg-[linear-gradient(135deg,#f8fafc,#e2e8f0)]">
                <QrCode className="w-20 h-20 text-gray-800" />
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Points:</span>
                <span className="font-mono text-[#39FF14]">+{qrCode.points}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Scans:</span>
                <span className="font-mono text-[#00D4FF]">{qrCode.scanCount}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => toggleStatus(qrCode.id)}
                className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm flex items-center justify-center gap-1 ${
                  qrCode.active
                    ? 'bg-[#FF3939]/20 text-[#FF3939] border border-[#FF3939]/30 hover:bg-[#FF3939]/30'
                    : 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30 hover:bg-[#39FF14]/30'
                }`}
              >
                {qrCode.active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                {qrCode.active ? 'Disable' : 'Enable'}
              </button>
              <button
                type="button"
                onClick={() => removeCode(qrCode.id)}
                className="py-2 px-3 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 hover:text-white transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
