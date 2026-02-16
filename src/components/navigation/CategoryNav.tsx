/**
 * ============================================================================
 * CategoryNav - Menú de Navegación tipo H&M
 * ============================================================================
 * Menú lateral jerárquico con categorías, subcategorías y navegación clara
 * Diseño minimalista inspirado en H&M
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import type { Category } from '../../lib/supabase';

interface CategoryNavProps {
  currentGender: 'mujer' | 'hombre';
  currentCategory?: string; // Slug de categoría activa
}

interface CategoryTree {
  main: Category;
  subcategories: Category[];
}

export default function CategoryNav({ currentGender, currentCategory }: CategoryNavProps) {
  const [categories, setCategories] = useState<CategoryTree[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Función para limpiar el nombre de la categoría eliminando el sufijo del género
  const cleanCategoryName = (name: string): string => {
    const genderSuffix = currentGender === 'mujer' ? ' Mujer' : ' Hombre';
    return name.replace(new RegExp(genderSuffix + '$', 'i'), '');
  };

  useEffect(() => {
    loadCategories();
  }, [currentGender]);

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/categories/${currentGender}?t=${Date.now()}`);
      const data = await response.json();
      
      console.log('[CategoryNav] DATOS DEL API:', data);
      console.log('[CategoryNav] Total categorías recibidas:', data.categories.length);
      
      // Organizar en árbol
      const tree: CategoryTree[] = [];
      // Solo categorías principales (sin parent_id)
      const mainCategories = data.categories.filter((c: Category) => !c.parent_id);
      
      console.log('[CategoryNav] Categorías PRINCIPALES (sin parent_id):', mainCategories.map((c: Category) => ({
        name: c.name,
        slug: c.slug,
        level: c.level,
        has_parent: !!c.parent_id
      })));
      
      mainCategories.forEach((main: Category) => {
        const subcategories = data.categories.filter(
          (c: Category) => c.parent_id === main.id
        );
        console.log(`[CategoryNav] Subcategorías de "${main.name}":`, subcategories.map((s: Category) => s.name));
        tree.push({ main, subcategories });
      });
      
      setCategories(tree);
      
      // Auto-expandir categoría activa
      if (currentCategory) {
        const activeMain = tree.find(t => 
          t.main.slug === currentCategory || 
          t.subcategories.some(sub => sub.slug === currentCategory)
        );
        if (activeMain) {
          setExpandedCategories(new Set([activeMain.main.id]));
        }
      }
    } catch (error) {
      console.error('Error cargando categorías:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const isActive = (slug: string) => {
    return currentCategory === slug;
  };

  if (isLoading) {
    return (
      <nav className="w-full lg:w-64 bg-dark-surface border-r border-white/10 min-h-screen">
        <div className="p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-8 bg-white/5 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="w-full lg:w-64 bg-dark-surface border-r border-white/10 min-h-screen">
      <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-5rem)]">
        {/* Header del menú */}
        <div className="p-6 border-b border-white/10 bg-dark-surface">
          <h2 className="text-2xl font-light text-white uppercase tracking-wider">
            {currentGender === 'mujer' ? 'Mujer' : 'Hombre'}
          </h2>
        </div>

        {/* Categorías con scroll suave */}
        <div className="overflow-y-auto lg:max-h-[calc(100vh-16rem)] py-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {categories.map(({ main, subcategories }) => (
            <div key={main.id} className="mb-2">
              {/* Categoría principal */}
              <button
                onClick={() => {
                  if (subcategories.length > 0) {
                    toggleCategory(main.id);
                  } else {
                    window.location.href = `/productos?genero=${currentGender}&categoria=${main.slug}`;
                  }
                }}
                className={`w-full flex items-center justify-between px-6 py-3 text-left transition-all duration-200 ease-in-out group ${
                  isActive(main.slug)
                    ? 'bg-accent-gold/20 text-accent-gold font-medium'
                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`text-sm uppercase tracking-wide transition-colors duration-200 ${
                  main.slug.includes('rebajas')
                    ? 'font-semibold text-red-400 group-hover:text-red-300'
                    : main.slug.includes('novedades')
                    ? 'font-semibold text-emerald-400 group-hover:text-emerald-300'
                    : ''
                }`}>
                  {cleanCategoryName(main.name)}
                </span>
                
                {subcategories.length > 0 && (
                  <svg
                    className={`w-4 h-4 transition-transform duration-300 ease-out text-gray-500 group-hover:text-gray-400 ${
                      expandedCategories.has(main.id) ? 'rotate-180' : 'rotate-0'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                )}
              </button>

              {/* Subcategorías con animación suave */}
              <div 
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  expandedCategories.has(main.id) 
                    ? 'max-h-[500px] opacity-100' 
                    : 'max-h-0 opacity-0'
                }`}
              >
                <div className="bg-dark-card/30 backdrop-blur-sm">
                  <ul className="py-2">
                    {subcategories.map(sub => (
                      <li key={sub.id}>
                        <a
                          href={`/productos?genero=${currentGender}&categoria=${sub.slug}`}
                          className={`block px-10 py-2.5 text-sm transition-all duration-200 ${
                            isActive(sub.slug)
                              ? 'text-accent-gold font-medium bg-accent-gold/10 border-l-2 border-accent-gold'
                              : 'text-gray-400 hover:text-white hover:bg-white/5 hover:border-l-2 hover:border-white/20 border-l-2 border-transparent'
                          }`}
                        >
                          {cleanCategoryName(sub.name)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer del menú */}
        <div className="p-6 border-t border-white/10 mt-4 bg-dark-surface">
          <div className="space-y-2 text-sm text-gray-400">
            <a
              href={`/${currentGender}/tarjetas-regalo`}
              className="block hover:text-accent-gold transition-colors duration-200"
            >
              Tarjetas regalo
            </a>
            <a
              href="/guia-tallas"
              className="block hover:text-accent-gold transition-colors duration-200"
            >
              Guía de tallas
            </a>
            <a
              href="/envios"
              className="block hover:text-accent-gold transition-colors duration-200"
            >
              Envíos y devoluciones
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
