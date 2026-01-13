/**
 * ============================================================================
 * GenderSelector - Selector de Género tipo H&M
 * ============================================================================
 * Selector prominente que cambia toda la experiencia de navegación
 * ============================================================================
 */

interface GenderSelectorProps {
  currentGender?: 'mujer' | 'hombre';
  className?: string;
}

export default function GenderSelector({ currentGender, className = '' }: GenderSelectorProps) {
  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      <a
        href="/mujer"
        className={`px-6 py-2 text-sm font-medium uppercase tracking-wider transition-all ${
          currentGender === 'mujer'
            ? 'text-brand-navy border-b-2 border-brand-navy'
            : 'text-gray-600 hover:text-brand-navy border-b-2 border-transparent hover:border-gray-300'
        }`}
      >
        Mujer
      </a>
      <a
        href="/hombre"
        className={`px-6 py-2 text-sm font-medium uppercase tracking-wider transition-all ${
          currentGender === 'hombre'
            ? 'text-brand-navy border-b-2 border-brand-navy'
            : 'text-gray-600 hover:text-brand-navy border-b-2 border-transparent hover:border-gray-300'
        }`}
      >
        Hombre
      </a>
    </div>
  );
}
