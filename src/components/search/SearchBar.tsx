/**
 * ============================================================================
 * SearchBar - Barra de Búsqueda con Autocompletado
 * ============================================================================
 * Componente React para búsqueda instantánea en el header
 * ============================================================================
 */

import { useState, useEffect, useRef } from 'react';
import type { AutocompleteResult } from '../../lib/search';

interface SearchBarProps {
  initialQuery?: string;
  placeholder?: string;
}

export default function SearchBar({ 
  initialQuery = '', 
  placeholder = 'Buscar ropa, zapatos...' 
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<AutocompleteResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout>();

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Autocompletado con debounce
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    // Debounce de 300ms
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    setIsLoading(true);

    debounceTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/autocomplete?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        setSuggestions(data.suggestions || []);
        setIsOpen(true);
        setIsLoading(false);
      } catch (error) {
        console.error('Error en autocompletado:', error);
        setSuggestions([]);
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query]);

  // Navegación con teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Enter') {
        handleSearch();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          const selected = suggestions[selectedIndex];
          navigateToResult(selected);
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSearch = () => {
    if (query.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(query.trim())}`;
    }
  };

  const navigateToResult = (result: AutocompleteResult) => {
    if (result.type === 'product') {
      window.location.href = `/productos/${result.slug}`;
    } else if (result.type === 'category') {
      window.location.href = `/categoria/${result.slug}`;
    } else if (result.type === 'gender') {
      window.location.href = `/${result.slug}`;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'product':
        return '🏷️';
      case 'category':
        return '📁';
      case 'gender':
        return '👤';
      default:
        return '🔍';
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full max-w-2xl">
      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full px-4 py-3 pl-12 pr-4 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy focus:border-transparent transition-all"
          aria-label="Buscar productos"
          aria-autocomplete="list"
          aria-controls="search-suggestions"
          aria-expanded={isOpen}
        />
        
        {/* Icono de búsqueda */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          {isLoading ? (
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>

        {/* Botón limpiar */}
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setSuggestions([]);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Limpiar búsqueda"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown de sugerencias */}
      {isOpen && suggestions.length > 0 && (
        <div
          id="search-suggestions"
          className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto"
          role="listbox"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.type}-${suggestion.id}`}
              onClick={() => navigateToResult(suggestion)}
              className={`w-full flex items-center gap-4 px-4 py-3 text-left transition-colors ${
                index === selectedIndex
                  ? 'bg-brand-navy text-white'
                  : 'hover:bg-gray-50'
              }`}
              role="option"
              aria-selected={index === selectedIndex}
            >
              {/* Imagen o Icono */}
              {suggestion.image ? (
                <img
                  src={suggestion.image}
                  alt={suggestion.name}
                  className="w-12 h-12 object-cover rounded"
                />
              ) : (
                <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded text-2xl">
                  {getIcon(suggestion.type)}
                </div>
              )}

              {/* Contenido */}
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${
                  index === selectedIndex ? 'text-white' : 'text-gray-900'
                }`}>
                  {suggestion.name}
                </p>
                {suggestion.additionalInfo && (
                  <p className={`text-sm truncate ${
                    index === selectedIndex ? 'text-gray-200' : 'text-gray-500'
                  }`}>
                    {suggestion.additionalInfo}
                  </p>
                )}
              </div>

              {/* Tipo */}
              <span className={`text-xs px-2 py-1 rounded ${
                index === selectedIndex
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {suggestion.type === 'product' ? 'Producto' : 
                 suggestion.type === 'category' ? 'Categoría' : 'Género'}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Hint de teclado */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute right-0 mt-1 text-xs text-gray-500">
          <kbd className="px-2 py-1 bg-gray-100 rounded">↑↓</kbd> navegar
          <kbd className="ml-2 px-2 py-1 bg-gray-100 rounded">Enter</kbd> seleccionar
          <kbd className="ml-2 px-2 py-1 bg-gray-100 rounded">Esc</kbd> cerrar
        </div>
      )}
    </div>
  );
}
