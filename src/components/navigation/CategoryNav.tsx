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

  useEffect(() => {
    loadCategories();
  }, [currentGender]);

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/categories/${currentGender}`);
      const data = await response.json();
      
      // Organizar en árbol
      const tree: CategoryTree[] = [];
      const mainCategories = data.categories.filter((c: Category) => c.level === 1);
      
      mainCategories.forEach((main: Category) => {
        const subcategories = data.categories.filter(
          (c: Category) => c.parent_id === main.id
        );
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
      <nav className="w-full lg:w-64 bg-white border-r border-gray-200 min-h-screen">
        <div className="p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-8 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="w-full lg:w-64 bg-white border-r border-gray-200 min-h-screen">
      <div className="sticky top-20 overflow-y-auto max-h-[calc(100vh-5rem)]">
        {/* Header del menú */}
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-light text-gray-900 uppercase tracking-wider">
            {currentGender === 'mujer' ? 'Mujer' : 'Hombre'}
          </h2>
        </div>

        {/* Categorías */}
        <div className="py-4">
          {categories.map(({ main, subcategories }) => (
            <div key={main.id} className="mb-2">
              {/* Categoría principal */}
              <button
                onClick={() => {
                  if (subcategories.length > 0) {
                    toggleCategory(main.id);
                  } else {
                    window.location.href = `/${currentGender}/${main.slug}`;
                  }
                }}
                className={`w-full flex items-center justify-between px-6 py-3 text-left transition-colors group ${
                  isActive(main.slug)
                    ? 'bg-gray-100 text-brand-navy font-medium'
                    : 'text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className={`text-sm uppercase tracking-wide ${
                  main.category_type === 'main' && main.display_order <= 2
                    ? 'font-semibold text-red-600'
                    : ''
                }`}>
                  {main.name}
                </span>
                
                {subcategories.length > 0 && (
                  <svg
                    className={`w-4 h-4 transition-transform ${
                      expandedCategories.has(main.id) ? 'rotate-180' : ''
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

              {/* Subcategorías */}
              {subcategories.length > 0 && expandedCategories.has(main.id) && (
                <div className="bg-gray-50">
                  <ul className="py-2">
                    {subcategories.map(sub => (
                      <li key={sub.id}>
                        <a
                          href={`/${currentGender}/${main.slug}/${sub.slug}`}
                          className={`block px-10 py-2 text-sm transition-colors ${
                            isActive(sub.slug)
                              ? 'text-brand-navy font-medium bg-gray-100'
                              : 'text-gray-700 hover:text-brand-navy hover:bg-gray-100'
                          }`}
                        >
                          {sub.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer del menú */}
        <div className="p-6 border-t border-gray-200 mt-4">
          <div className="space-y-2 text-sm text-gray-600">
            <a
              href={`/${currentGender}/tarjetas-regalo`}
              className="block hover:text-brand-navy transition-colors"
            >
              Tarjetas regalo
            </a>
            <a
              href="/guia-tallas"
              className="block hover:text-brand-navy transition-colors"
            >
              Guía de tallas
            </a>
            <a
              href="/envios"
              className="block hover:text-brand-navy transition-colors"
            >
              Envíos y devoluciones
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
