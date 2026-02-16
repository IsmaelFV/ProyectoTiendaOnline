/**
 * ============================================================================
 * Recomendador Avanzado de Tallas
 * ============================================================================
 * Inspirado en Zara, H&M, ASOS:
 *  - Medidas corporales reales (pecho, cintura, cadera)
 *  - Diferenciación hombre / mujer
 *  - Preferencia de ajuste (ajustado / regular / holgado)
 *  - Silueta visual interactiva con indicadores
 *  - Tabla de medidas desplegable
 *  - Guardado de perfil en localStorage
 *  - Nivel de confianza en la recomendación
 */
import { useState, useEffect } from 'react';

interface SizeRecommenderProps {
  productSizes: string[];
  onSelectSize: (size: string) => void;
  sizeMeasurements?: Record<string, { chest: [number, number]; waist: [number, number]; hip: [number, number] }>;
}

type Gender = 'mujer' | 'hombre';
type Fit = 'ajustado' | 'normal' | 'holgado';
type MeasureStep = 'gender' | 'measures' | 'fit' | 'result';

interface UserMeasures {
  gender: Gender;
  height: number;
  chest: number;
  waist: number;
  hip: number;
  fit: Fit;
}

interface SizeMatch {
  size: string;
  score: number;
  confidence: 'perfecto' | 'bueno' | 'aproximado';
}

// Tablas de medidas (cm) — basadas en estándares europeos de moda
const SIZE_CHARTS: Record<Gender, Record<string, { chest: [number, number]; waist: [number, number]; hip: [number, number]; height: [number, number] }>> = {
  mujer: {
    XS:  { chest: [78, 82],   waist: [60, 64],  hip: [86, 90],   height: [154, 163] },
    S:   { chest: [82, 88],   waist: [64, 70],  hip: [90, 96],   height: [158, 168] },
    M:   { chest: [88, 94],   waist: [70, 76],  hip: [96, 102],  height: [162, 173] },
    L:   { chest: [94, 100],  waist: [76, 82],  hip: [102, 108], height: [166, 178] },
    XL:  { chest: [100, 108], waist: [82, 90],  hip: [108, 116], height: [168, 182] },
    XXL: { chest: [108, 118], waist: [90, 100], hip: [116, 126], height: [170, 186] },
  },
  hombre: {
    XS:  { chest: [84, 88],   waist: [70, 74],  hip: [86, 90],   height: [162, 170] },
    S:   { chest: [88, 94],   waist: [74, 80],  hip: [90, 96],   height: [166, 174] },
    M:   { chest: [94, 100],  waist: [80, 86],  hip: [96, 102],  height: [170, 180] },
    L:   { chest: [100, 108], waist: [86, 94],  hip: [102, 108], height: [176, 186] },
    XL:  { chest: [108, 116], waist: [94, 102], hip: [108, 116], height: [180, 192] },
    XXL: { chest: [116, 126], waist: [102, 112], hip: [116, 126], height: [184, 200] },
  },
};

const STORAGE_KEY = 'fm_size_profile';

function loadProfile(): Partial<UserMeasures> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveProfile(m: UserMeasures) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(m)); } catch {}
}

/** Puntuación 0–100 de cómo encaja un valor en un rango [min, max] */
function measureScore(value: number, [min, max]: [number, number]): number {
  if (value >= min && value <= max) {
    const mid = (min + max) / 2;
    const dist = Math.abs(value - mid) / ((max - min) / 2);
    return 100 - (dist * 20);
  }
  const dist = value < min ? min - value : value - max;
  const rangeSpan = max - min;
  return Math.max(0, 80 - (dist / rangeSpan) * 80);
}

function recommendSize(measures: UserMeasures, availableSizes: string[], customMeasurements?: Record<string, { chest: [number, number]; waist: [number, number]; hip: [number, number] }>): SizeMatch[] {
  const chart = SIZE_CHARTS[measures.gender];
  
  // Si hay medidas personalizadas del producto, usarlas como fuente principal
  const useCustom = customMeasurements && Object.keys(customMeasurements).length > 0;
  
  const allSizeKeys = useCustom ? Object.keys(customMeasurements) : Object.keys(chart);
  const results: SizeMatch[] = [];

  for (const size of allSizeKeys) {
    if (!availableSizes.includes(size)) continue;
    
    // Usar medidas personalizadas si están disponibles, si no las estándar
    const customR = customMeasurements?.[size];
    const standardR = chart[size];
    
    if (!customR && !standardR) continue;
    
    const ranges = {
      chest: customR?.chest || standardR?.chest || [0, 999],
      waist: customR?.waist || standardR?.waist || [0, 999],
      hip: customR?.hip || standardR?.hip || [0, 999],
      height: standardR?.height || [150, 200],
    };

    const chestScore  = measureScore(measures.chest,  ranges.chest);
    const waistScore  = measureScore(measures.waist,  ranges.waist);
    const hipScore    = measureScore(measures.hip,    ranges.hip);
    const heightScore = measureScore(measures.height, ranges.height);

    let total = (chestScore * 0.35) + (waistScore * 0.30) + (hipScore * 0.25) + (heightScore * 0.10);

    if (measures.fit === 'holgado') {
      const midChest = (ranges.chest[0] + ranges.chest[1]) / 2;
      if (measures.chest > midChest) total *= 0.85;
    }

    const score = Math.round(Math.max(0, Math.min(100, total)));
    const confidence: SizeMatch['confidence'] =
      score >= 80 ? 'perfecto' : score >= 55 ? 'bueno' : 'aproximado';

    results.push({ size, score, confidence });
  }

  // Ajuste de fit: favorecer talla superior/inferior según preferencia
  if (measures.fit === 'holgado' && results.length >= 2) {
    results.sort((a, b) => b.score - a.score);
    const bestIdx = allSizeKeys.indexOf(results[0].size);
    const nextSize = allSizeKeys[bestIdx + 1];
    if (nextSize && availableSizes.includes(nextSize)) {
      const r = results.find(r => r.size === nextSize);
      if (r) r.score = Math.min(100, r.score + 15);
    }
  }
  if (measures.fit === 'ajustado' && results.length >= 2) {
    results.sort((a, b) => b.score - a.score);
    const bestIdx = allSizeKeys.indexOf(results[0].size);
    const prevSize = allSizeKeys[bestIdx - 1];
    if (prevSize && availableSizes.includes(prevSize)) {
      const r = results.find(r => r.size === prevSize);
      if (r) r.score = Math.min(100, r.score + 10);
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

// ─── Componente ─────────────────────────────────────────────────────────────

export default function SizeRecommender({ productSizes, onSelectSize, sizeMeasurements }: SizeRecommenderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<MeasureStep>('gender');
  const [gender, setGender] = useState<Gender | null>(null);
  const [height, setHeight] = useState('');
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [hip, setHip] = useState('');
  const [fit, setFit] = useState<Fit>('normal');
  const [results, setResults] = useState<SizeMatch[]>([]);
  const [showTable, setShowTable] = useState(false);
  const [activeMeasure, setActiveMeasure] = useState<'chest' | 'waist' | 'hip' | null>(null);

  // Cargar perfil guardado
  useEffect(() => {
    const profile = loadProfile();
    if (profile) {
      if (profile.gender) setGender(profile.gender);
      if (profile.height) setHeight(String(profile.height));
      if (profile.chest) setChest(String(profile.chest));
      if (profile.waist) setWaist(String(profile.waist));
      if (profile.hip) setHip(String(profile.hip));
      if (profile.fit) setFit(profile.fit);
    }
  }, []);

  const openModal = () => {
    setIsOpen(true);
    setStep(gender ? 'measures' : 'gender');
    setResults([]);
  };

  const closeModal = () => {
    setIsOpen(false);
    setResults([]);
    setShowTable(false);
    setActiveMeasure(null);
  };

  const calculate = () => {
    const h = parseInt(height);
    const c = parseInt(chest);
    const w = parseInt(waist);
    const hp = parseInt(hip);
    if (!gender || isNaN(h) || isNaN(c) || isNaN(w) || isNaN(hp)) return;

    const measures: UserMeasures = { gender, height: h, chest: c, waist: w, hip: hp, fit };
    saveProfile(measures);
    const matches = recommendSize(measures, productSizes, sizeMeasurements);
    setResults(matches);
    setStep('result');
  };

  const selectAndClose = (size: string) => {
    onSelectSize(size);
    closeModal();
  };

  const progressPct = step === 'gender' ? '25%' : step === 'measures' ? '50%' : step === 'fit' ? '75%' : '100%';

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={openModal}
        className="group flex items-center gap-1.5 text-sm text-gray-400 hover:text-accent-gold transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
        <span className="group-hover:underline">Encuentra tu talla</span>
        <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={closeModal} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg relative overflow-hidden"
          style={{ animation: 'sizeRecSlideUp .25s ease-out' }}
        >
          {/* Barra de progreso */}
          <div className="h-1 bg-white/5">
            <div
              className="h-full bg-gradient-to-r from-accent-gold to-amber-400 transition-all duration-500"
              style={{ width: progressPct }}
            />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Encuentra tu talla</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {step === 'gender' && 'Paso 1 de 4 — Tipo de prenda'}
                {step === 'measures' && 'Paso 2 de 4 — Tus medidas'}
                {step === 'fit' && 'Paso 3 de 4 — Preferencia de ajuste'}
                {step === 'result' && 'Resultado — Tu talla ideal'}
              </p>
            </div>
            <button onClick={closeModal} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-6 pb-6">

            {/* ─── PASO 1: Género ─── */}
            {step === 'gender' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">Las tallas varían según la sección. ¿Qué tipo de prenda buscas?</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['mujer', 'hombre'] as Gender[]).map((g) => (
                    <button
                      key={g}
                      onClick={() => { setGender(g); setStep('measures'); }}
                      className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all ${
                        gender === g
                          ? 'border-accent-gold bg-accent-gold/10'
                          : 'border-white/10 hover:border-white/30 bg-white/[0.02]'
                      }`}
                    >
                      {g === 'mujer' ? (
                        <svg className="w-12 h-12 text-gray-300" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="32" cy="14" r="8" />
                          <path d="M22 28c0-4 4-8 10-8s10 4 10 8l2 12h-6l-1 18h-10l-1-18h-6l2-12z" />
                        </svg>
                      ) : (
                        <svg className="w-12 h-12 text-gray-300" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="32" cy="14" r="8" />
                          <path d="M24 28c0-4 3-8 8-8s8 4 8 8l1 12h-5v18h-3l-2-18h-2l-2 18h-3v-18h-5l1-12z" />
                        </svg>
                      )}
                      <span className="text-white font-medium capitalize">{g}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ─── PASO 2: Medidas ─── */}
            {step === 'measures' && (
              <div className="space-y-5">
                <div className="flex gap-5">
                  {/* Silueta con indicadores */}
                  <div className="hidden sm:flex flex-col items-center justify-center min-w-[100px]">
                    <div className="relative">
                      <svg width="80" height="180" viewBox="0 0 80 180" fill="none" className="text-gray-600">
                        <circle cx="40" cy="18" r="12" stroke="currentColor" strokeWidth="1.5" />
                        {gender === 'mujer' ? (
                          <path d="M26 45c0-6 6-12 14-12s14 6 14 12l3 20h-8l-2 45H33l-2-45h-8l3-20z" stroke="currentColor" strokeWidth="1.5" fill="none" />
                        ) : (
                          <path d="M28 45c0-6 5-12 12-12s12 6 12 12l2 20h-7v45h-4l-3-45h-2l-3 45h-4V65h-7l2-20z" stroke="currentColor" strokeWidth="1.5" fill="none" />
                        )}
                        {/* Líneas de medida dinámicas */}
                        <line x1="8" y1="50" x2="72" y2="50" stroke={activeMeasure === 'chest' ? '#d4a843' : 'transparent'} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                        <line x1="14" y1="70" x2="66" y2="70" stroke={activeMeasure === 'waist' ? '#d4a843' : 'transparent'} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                        <line x1="10" y1="85" x2="70" y2="85" stroke={activeMeasure === 'hip' ? '#d4a843' : 'transparent'} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                        {activeMeasure === 'chest' && <text x="40" y="46" textAnchor="middle" fill="#d4a843" fontSize="8" fontWeight="bold">Pecho</text>}
                        {activeMeasure === 'waist' && <text x="40" y="66" textAnchor="middle" fill="#d4a843" fontSize="8" fontWeight="bold">Cintura</text>}
                        {activeMeasure === 'hip'   && <text x="40" y="81" textAnchor="middle" fill="#d4a843" fontSize="8" fontWeight="bold">Cadera</text>}
                      </svg>
                    </div>
                    <button onClick={() => setStep('gender')} className="mt-2 text-[11px] text-gray-500 hover:text-accent-gold underline">
                      {gender === 'mujer' ? 'Mujer' : 'Hombre'} · Cambiar
                    </button>
                  </div>

                  {/* Formulario */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="flex items-center justify-between text-sm text-gray-400 mb-1.5">
                        <span>Altura</span><span className="text-xs text-gray-600">cm</span>
                      </label>
                      <input type="number" value={height} onChange={(e) => setHeight(e.target.value)}
                        onFocus={() => setActiveMeasure(null)} placeholder="Ej: 170" min="140" max="220"
                        className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/50 transition-all text-sm" />
                    </div>
                    <div>
                      <label className="flex items-center justify-between text-sm text-gray-400 mb-1.5">
                        <span>Contorno de pecho</span><span className="text-xs text-gray-600">cm</span>
                      </label>
                      <input type="number" value={chest} onChange={(e) => setChest(e.target.value)}
                        onFocus={() => setActiveMeasure('chest')} onBlur={() => setActiveMeasure(null)}
                        placeholder={gender === 'mujer' ? 'Ej: 88' : 'Ej: 96'} min="60" max="140"
                        className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/50 transition-all text-sm" />
                    </div>
                    <div>
                      <label className="flex items-center justify-between text-sm text-gray-400 mb-1.5">
                        <span>Contorno de cintura</span><span className="text-xs text-gray-600">cm</span>
                      </label>
                      <input type="number" value={waist} onChange={(e) => setWaist(e.target.value)}
                        onFocus={() => setActiveMeasure('waist')} onBlur={() => setActiveMeasure(null)}
                        placeholder={gender === 'mujer' ? 'Ej: 70' : 'Ej: 82'} min="50" max="130"
                        className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/50 transition-all text-sm" />
                    </div>
                    <div>
                      <label className="flex items-center justify-between text-sm text-gray-400 mb-1.5">
                        <span>Contorno de cadera</span><span className="text-xs text-gray-600">cm</span>
                      </label>
                      <input type="number" value={hip} onChange={(e) => setHip(e.target.value)}
                        onFocus={() => setActiveMeasure('hip')} onBlur={() => setActiveMeasure(null)}
                        placeholder={gender === 'mujer' ? 'Ej: 96' : 'Ej: 100'} min="60" max="150"
                        className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold/50 transition-all text-sm" />
                    </div>

                    {/* Tooltip cómo medir */}
                    <details className="text-xs text-gray-500 cursor-pointer">
                      <summary className="hover:text-gray-300 transition-colors list-none flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        ¿Cómo me tomo las medidas?
                      </summary>
                      <div className="mt-2 p-3 bg-white/5 rounded-lg space-y-1.5 text-gray-400">
                        <p><strong className="text-gray-300">Pecho:</strong> Mide alrededor de la parte más ancha del pecho, por debajo de las axilas.</p>
                        <p><strong className="text-gray-300">Cintura:</strong> Mide alrededor de la parte más estrecha de tu cintura natural.</p>
                        <p><strong className="text-gray-300">Cadera:</strong> Mide alrededor de la parte más ancha de las caderas.</p>
                        <p className="text-gray-500 italic">Usa una cinta métrica flexible. No aprietes, deja que quede ajustada sin comprimir.</p>
                      </div>
                    </details>
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button onClick={() => setStep('gender')}
                    className="px-4 py-2.5 text-sm text-gray-400 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                    Atrás
                  </button>
                  <button onClick={() => { if (height && chest && waist && hip) setStep('fit'); }}
                    disabled={!height || !chest || !waist || !hip}
                    className="flex-1 py-2.5 text-sm bg-accent-gold text-[#1a1a2e] rounded-lg font-semibold hover:bg-accent-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    Siguiente
                  </button>
                </div>
              </div>
            )}

            {/* ─── PASO 3: Preferencia de ajuste ─── */}
            {step === 'fit' && (
              <div className="space-y-5">
                <p className="text-sm text-gray-400">¿Cómo prefieres que te quede la ropa?</p>
                <div className="space-y-3">
                  {([
                    { value: 'ajustado' as Fit, label: 'Ajustado', desc: 'Ceñido al cuerpo, estilo entallado' },
                    { value: 'normal' as Fit,   label: 'Regular',  desc: 'Ni ajustado ni holgado, el corte estándar' },
                    { value: 'holgado' as Fit,  label: 'Holgado',  desc: 'Cómodo y suelto, estilo oversize' },
                  ]).map((opt) => (
                    <button key={opt.value} onClick={() => setFit(opt.value)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                        fit === opt.value
                          ? 'border-accent-gold bg-accent-gold/10'
                          : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                      }`}>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        fit === opt.value ? 'bg-accent-gold/20 text-accent-gold' : 'bg-white/5 text-gray-500'
                      }`}>
                        {opt.value === 'ajustado' && (
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3c-2 0-4 2-4 5v3c0 2-1 3-2 4v1h12v-1c-1-1-2-2-2-4v-3c0-3-2-5-4-5z" /></svg>
                        )}
                        {opt.value === 'normal' && (
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="3" width="12" height="18" rx="2" /></svg>
                        )}
                        {opt.value === 'holgado' && (
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3" /></svg>
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{opt.label}</p>
                        <p className="text-gray-500 text-xs">{opt.desc}</p>
                      </div>
                      {fit === opt.value && (
                        <svg className="w-5 h-5 text-accent-gold ml-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setStep('measures')}
                    className="px-4 py-2.5 text-sm text-gray-400 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                    Atrás
                  </button>
                  <button onClick={calculate}
                    className="flex-1 py-2.5 text-sm bg-accent-gold text-[#1a1a2e] rounded-lg font-semibold hover:bg-accent-gold/90 transition-colors">
                    Ver mi talla
                  </button>
                </div>
              </div>
            )}

            {/* ─── PASO 4: Resultado ─── */}
            {step === 'result' && results.length > 0 && (
              <div className="space-y-4">
                {/* Talla principal */}
                <div className="text-center p-6 rounded-xl bg-gradient-to-br from-accent-gold/10 to-amber-500/5 border border-accent-gold/20">
                  <p className="text-sm text-gray-400 mb-1">Tu talla recomendada</p>
                  <div className="text-5xl font-bold text-white my-3">{results[0].size}</div>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                    results[0].confidence === 'perfecto' ? 'bg-emerald-500/20 text-emerald-400'
                    : results[0].confidence === 'bueno' ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {results[0].confidence === 'perfecto' && '✓ Match perfecto'}
                    {results[0].confidence === 'bueno' && '≈ Buen match'}
                    {results[0].confidence === 'aproximado' && '~ Aproximado'}
                    <span className="text-[10px] opacity-70">({results[0].score}%)</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    {height} cm · Pecho {chest} · Cintura {waist} · Cadera {hip} cm
                    {' · '}{fit === 'ajustado' ? 'Ajustado' : fit === 'normal' ? 'Regular' : 'Holgado'}
                  </p>
                </div>

                {/* Alternativas */}
                {results.length > 1 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">También podrían quedarte bien:</p>
                    <div className="flex gap-2">
                      {results.slice(1, 3).map((r) => (
                        <button key={r.size} onClick={() => selectAndClose(r.size)}
                          className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
                          <span className="text-white font-semibold text-sm">{r.size}</span>
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div className={`h-full rounded-full ${
                                r.confidence === 'perfecto' ? 'bg-emerald-400' : r.confidence === 'bueno' ? 'bg-amber-400' : 'bg-gray-400'
                              }`} style={{ width: `${r.score}%` }} />
                            </div>
                            <span className="text-[10px] text-gray-500">{r.score}%</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Botones */}
                <div className="flex gap-3">
                  <button onClick={() => { setStep('measures'); setResults([]); }}
                    className="px-4 py-2.5 text-sm text-gray-400 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                    Recalcular
                  </button>
                  <button onClick={() => selectAndClose(results[0].size)}
                    className="flex-1 py-2.5 text-sm bg-accent-gold text-[#1a1a2e] rounded-lg font-semibold hover:bg-accent-gold/90 transition-colors">
                    Seleccionar {results[0].size}
                  </button>
                </div>

                {/* Tabla desplegable */}
                <div className="pt-2">
                  <button onClick={() => setShowTable(!showTable)}
                    className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors w-full">
                    <svg className={`w-3.5 h-3.5 transition-transform ${showTable ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Tabla completa de medidas ({gender === 'mujer' ? 'Mujer' : 'Hombre'})
                  </button>

                  {showTable && gender && (
                    <div className="mt-3 rounded-lg overflow-hidden border border-white/10">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-white/5">
                            <th className="px-3 py-2 text-left text-gray-400 font-medium">Talla</th>
                            <th className="px-3 py-2 text-center text-gray-400 font-medium">Pecho</th>
                            <th className="px-3 py-2 text-center text-gray-400 font-medium">Cintura</th>
                            <th className="px-3 py-2 text-center text-gray-400 font-medium">Cadera</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {(() => {
                            // Usar medidas del producto si las hay, si no las estándar
                            const hasCustom = sizeMeasurements && Object.keys(sizeMeasurements).length > 0;
                            const entries = hasCustom
                              ? Object.entries(sizeMeasurements).map(([size, m]) => [size, {
                                  chest: m.chest || SIZE_CHARTS[gender]?.[size]?.chest || [0, 0],
                                  waist: m.waist || SIZE_CHARTS[gender]?.[size]?.waist || [0, 0],
                                  hip: m.hip || SIZE_CHARTS[gender]?.[size]?.hip || [0, 0],
                                }] as const)
                              : Object.entries(SIZE_CHARTS[gender]).map(([size, ranges]) => [size, ranges] as const);
                            
                            return entries.map(([size, ranges]) => {
                              const isRecommended = results[0]?.size === size;
                              const isAvailable = productSizes.includes(size as string);
                              return (
                                <tr key={size} className={`transition-colors ${
                                  isRecommended ? 'bg-accent-gold/10' : isAvailable ? 'hover:bg-white/5' : 'opacity-40'
                                }`}>
                                  <td className="px-3 py-2">
                                    <span className={`font-semibold ${isRecommended ? 'text-accent-gold' : isAvailable ? 'text-white' : 'text-gray-600'}`}>
                                      {size}
                                    </span>
                                    {isRecommended && <span className="ml-1 text-accent-gold">←</span>}
                                    {!isAvailable && <span className="ml-1 text-gray-600 text-[10px]">(agotada)</span>}
                                  </td>
                                  <td className="px-3 py-2 text-center text-gray-400">{ranges.chest[0]}–{ranges.chest[1]}</td>
                                  <td className="px-3 py-2 text-center text-gray-400">{ranges.waist[0]}–{ranges.waist[1]}</td>
                                  <td className="px-3 py-2 text-center text-gray-400">{ranges.hip[0]}–{ranges.hip[1]}</td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                      <div className="px-3 py-2 bg-white/[0.02] text-[10px] text-gray-600">
                        {sizeMeasurements && Object.keys(sizeMeasurements).length > 0
                          ? 'Medidas específicas de este producto (cm). Pueden variar ligeramente según el diseño.'
                          : 'Medidas en centímetros (cm). Las tallas pueden variar ligeramente según el diseño.'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Nota perfil guardado */}
                <p className="text-[10px] text-gray-600 text-center flex items-center justify-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Tus medidas se han guardado para futuras visitas
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes sizeRecSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
