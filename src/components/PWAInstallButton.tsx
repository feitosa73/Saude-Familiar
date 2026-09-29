import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share, PlusSquare, X, Smartphone } from 'lucide-react';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed as standalone PWA, suppress button
  if (isInstalled) {
    return null;
  }

  // Android / Chromium / Desktop PWA prompt
  if (isInstallable) {
    return (
      <button
        type="button"
        id="pwa-install-btn"
        onClick={install}
        className={`inline-flex items-center justify-center gap-2 font-bold transition-all active:scale-[0.98] ${
          compact
            ? 'px-3 py-2 text-xs rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
            : 'px-4 py-2.5 text-sm rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md'
        }`}
        title="Instalar Saúde Familiar na tela inicial do celular"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Instalar App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          id="pwa-ios-install-btn"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center justify-center gap-1.5 font-bold border transition-all ${
            compact
              ? 'px-2.5 py-1.5 text-xs rounded-xl bg-blue-50/80 border-blue-200 text-blue-700 hover:bg-blue-100'
              : 'px-3.5 py-2 text-xs rounded-xl bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
          }`}
          title="Como instalar no iPhone/iPad"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Instalar no celular</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Instalar Saúde Familiar</h3>
                    <p className="text-[11px] text-slate-500">Tela cheia sem barra do navegador</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                    1
                  </span>
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900">Toque no botão Compartilhar</p>
                    <p className="text-slate-500 text-[11px] flex items-center gap-1">
                      No menu inferior do Safari <Share className="w-3.5 h-3.5 text-blue-600 inline" />
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                    2
                  </span>
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900">Selecione "Adicionar à Tela de Início"</p>
                    <p className="text-slate-500 text-[11px] flex items-center gap-1">
                      Role a lista até encontrar <PlusSquare className="w-3.5 h-3.5 text-blue-600 inline" />
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
