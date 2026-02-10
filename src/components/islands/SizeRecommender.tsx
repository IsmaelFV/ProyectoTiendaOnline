/**
 * ============================================================================
 * Modal Recomendador de Talla
 * ============================================================================
 * Componente que sugiere talla basándose en altura y peso del usuario
 */
import { useState } from 'react';

interface SizeRecommenderProps {
  productSizes: string[];
  onSelectSize: (size: string) => void;
}

// Tabla de tallas basada en altura y peso
const sizeChart = {
  XS: { minHeight: 150, maxHeight: 165, minWeight: 40, maxWeight: 55 },
  S: { minHeight: 160, maxHeight: 170, minWeight: 50, maxWeight: 65 },
  M: { minHeight: 165, maxHeight: 178, minWeight: 60, maxWeight: 75 },
  L: { minHeight: 173, maxHeight: 185, minWeight: 70, maxWeight: 85 },
  XL: { minHeight: 180, maxHeight: 195, minWeight: 80, maxWeight: 100 },
  XXL: { minHeight: 185, maxHeight: 210, minWeight: 95, maxWeight: 130 },
};

export default function SizeRecommender({ productSizes, onSelectSize }: SizeRecommenderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [recommendedSize, setRecommendedSize] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const calculateSize = () => {
    const h = parseInt(height);
    const w = parseInt(weight);

    if (isNaN(h) || isNaN(w)) {
      alert('Por favor, introduce valores válidos');
      return;
    }

    if (h < 140 || h > 220) {
      alert('La altura debe estar entre 140 y 220 cm');
      return;
    }

    if (w < 35 || w > 150) {
      alert('El peso debe estar entre 35 y 150 kg');
      return;
    }

    // Algoritmo de recomendación
    let bestSize = 'M'; // Default
    let bestScore = 999;

    for (const [size, range] of Object.entries(sizeChart)) {
      if (!productSizes.includes(size)) continue;

      // Calcular score (menor es mejor)
      const heightMid = (range.minHeight + range.maxHeight) / 2;
      const weightMid = (range.minWeight + range.maxWeight) / 2;
      
      const heightDiff = Math.abs(h - heightMid) / 10;
      const weightDiff = Math.abs(w - weightMid) / 10;
      const score = heightDiff + weightDiff;

      if (score < bestScore) {
        bestScore = score;
        bestSize = size;
      }
    }

    setRecommendedSize(bestSize);
    setShowResult(true);
  };

  const handleSelectRecommended = () => {
    if (recommendedSize) {
      onSelectSize(recommendedSize);
      setIsOpen(false);
      setShowResult(false);
      setHeight('');
      setWeight('');
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-sm text-brand-navy hover:text-brand-gold underline transition-colors"
      >
        ¿No sabes tu talla? Te ayudamos →
      </button>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
          {/* Botón cerrar */}
          <button
            onClick={() => {
              setIsOpen(false);
              setShowResult(false);
            }}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h3 className="text-2xl font-serif font-bold text-brand-navy mb-2">
            Encuentra tu talla perfecta
          </h3>
          <p className="text-gray-600 mb-6">
            Introduce tus medidas y te recomendaremos la talla ideal para ti.
          </p>

          {!showResult ? (
            <div className="space-y-4">
              {/* Altura */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Altura (cm)
                </label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="Ej: 175"
                  min="140"
                  max="220"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                />
              </div>

              {/* Peso */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Peso (kg)
                </label>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="Ej: 70"
                  min="35"
                  max="150"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                />
              </div>

              <button
                onClick={calculateSize}
                className="w-full bg-brand-navy text-white py-3 rounded-lg font-medium hover:bg-brand-charcoal transition-colors"
              >
                Calcular mi talla
              </button>

              <p className="text-xs text-gray-500 text-center">
                Esta es una guía orientativa. Las tallas pueden variar según el tipo de prenda.
              </p>
            </div>
          ) : (
            <div className="text-center space-y-4">
              {/* Resultado */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                <p className="text-green-800 font-medium mb-2">
                  ¡Tu talla recomendada es!
                </p>
                <div className="text-5xl font-bold text-brand-navy mb-4">
                  {recommendedSize}
                </div>
                <p className="text-sm text-gray-600">
                  Para {height} cm y {weight} kg
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowResult(false)}
                  className="flex-1 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Volver a calcular
                </button>
                <button
                  onClick={handleSelectRecommended}
                  className="flex-1 bg-brand-navy text-white py-3 rounded-lg font-medium hover:bg-brand-charcoal transition-colors"
                >
                  Seleccionar {recommendedSize}
                </button>
              </div>
            </div>
          )}

          {/* Tabla de tallas */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Guía de tallas</h4>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="font-medium text-gray-500">Talla</div>
              <div className="font-medium text-gray-500">Altura</div>
              <div className="font-medium text-gray-500">Peso</div>
              {Object.entries(sizeChart).map(([size, range]) => (
                <>
                  <div key={`size-${size}`} className={`font-medium ${productSizes.includes(size) ? 'text-brand-navy' : 'text-gray-300'}`}>
                    {size}
                  </div>
                  <div key={`height-${size}`} className="text-gray-600">
                    {range.minHeight}-{range.maxHeight} cm
                  </div>
                  <div key={`weight-${size}`} className="text-gray-600">
                    {range.minWeight}-{range.maxWeight} kg
                  </div>
                </>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
