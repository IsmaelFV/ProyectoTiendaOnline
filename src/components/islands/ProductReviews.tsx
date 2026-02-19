import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Review {
  id: string;
  product_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  title: string | null;
  comment: string | null;
  created_at: string;
}

interface ReviewStats {
  total: number;
  average: number;
  distribution: number[];
}

interface Props {
  productId: string;
}

function StarRating({ rating, size = 'md', interactive = false, onChange }: {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onChange?: (r: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const sizeClass = size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => interactive && setHovered(star)}
          onMouseLeave={() => interactive && setHovered(0)}
          className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
        >
          <svg
            className={`${sizeClass} ${(hovered || rating) >= star ? 'text-amber-400' : 'text-gray-600'} transition-colors`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semana${Math.floor(diffDays / 7) > 1 ? 's' : ''}`;
  if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} mes${Math.floor(diffDays / 30) > 1 ? 'es' : ''}`;
  return `Hace ${Math.floor(diffDays / 365)} año${Math.floor(diffDays / 365) > 1 ? 's' : ''}`;
}

export default function ProductReviews({ productId }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats>({ total: 0, average: 0, distribution: [0, 0, 0, 0, 0] });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formRating, setFormRating] = useState(0);
  const [formTitle, setFormTitle] = useState('');
  const [formComment, setFormComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editingReview, setEditingReview] = useState<Review | null>(null);

  const fetchReviews = async () => {
    try {
      const res = await fetch(`/api/reviews?product_id=${productId}`);
      const data = await res.json();
      if (res.ok) {
        setReviews(data.reviews);
        setStats(data.stats);
      }
    } catch (err) {
      console.error('[REVIEWS] Error loading reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  // Obtener el usuario actual desde la sesión
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setCurrentUserId(session?.user?.id || null);
      } catch (err) {
        console.error('[REVIEWS] Error checking user session:', err);
      }
    };
    checkUser();
  }, []);

  useEffect(() => { fetchReviews(); }, [productId]);

  const startEditing = (review: Review) => {
    setEditingReview(review);
    setFormRating(review.rating);
    setFormTitle(review.title || '');
    setFormComment(review.comment || '');
    setShowForm(true);
    setError('');
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingReview(null);
    setFormRating(0);
    setFormTitle('');
    setFormComment('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formRating === 0) { setError('Selecciona una valoración'); return; }
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          rating: formRating,
          title: formTitle || null,
          comment: formComment || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccess(editingReview ? '¡Reseña actualizada!' : '¡Reseña publicada! Gracias por tu opinión.');
      cancelForm();
      fetchReviews();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar la reseña');
    }
    setSubmitting(false);
  };

  // Verificar si el usuario actual ya tiene una reseña
  const userReview = currentUserId ? reviews.find(r => r.user_id === currentUserId) : null;

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 border-t border-white/5">
      <h2 className="font-serif text-xl sm:text-2xl font-bold text-white mb-8">
        Opiniones de clientes
      </h2>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Panel izquierdo: resumen */}
          <div className="lg:col-span-1">
            <div className="bg-white/[0.02] rounded-2xl border border-white/5 p-6 sticky top-24">
              {stats.total > 0 ? (
                <>
                  <div className="text-center mb-5">
                    <span className="text-5xl font-bold text-white font-serif">{stats.average}</span>
                    <span className="text-lg text-gray-500 ml-1">/5</span>
                    <div className="flex justify-center mt-2">
                      <StarRating rating={Math.round(stats.average)} size="md" />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      {stats.total} opinión{stats.total !== 1 ? 'es' : ''}
                    </p>
                  </div>
                  {/* Distribución */}
                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = stats.distribution[star - 1];
                      const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                      return (
                        <div key={star} className="flex items-center gap-2 text-xs">
                          <span className="text-gray-400 w-6 text-right">{star}</span>
                          <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-400 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            ></div>
                          </div>
                          <span className="text-gray-500 w-7 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="flex justify-center mb-3">
                    <StarRating rating={0} size="lg" />
                  </div>
                  <p className="text-sm text-gray-400">Aún no hay opiniones</p>
                  <p className="text-xs text-gray-600 mt-1">Sé el primero en opinar</p>
                </div>
              )}

              {/* Botón escribir/editar reseña */}
              {userReview && !showForm ? (
                <button
                  onClick={() => startEditing(userReview)}
                  className="w-full mt-5 px-4 py-2.5 text-sm font-medium bg-amber-400/10 text-amber-400 rounded-xl border border-amber-400/20 hover:bg-amber-400/20 transition-all"
                >
                  ✏️ Editar mi opinión
                </button>
              ) : (
                <button
                  onClick={() => showForm ? cancelForm() : setShowForm(true)}
                  className="w-full mt-5 px-4 py-2.5 text-sm font-medium bg-amber-400/10 text-amber-400 rounded-xl border border-amber-400/20 hover:bg-amber-400/20 transition-all"
                >
                  {showForm ? 'Cancelar' : 'Escribir una opinión'}
                </button>
              )}
            </div>
          </div>

          {/* Panel derecho: formulario + lista de reseñas */}
          <div className="lg:col-span-2 space-y-6">
            {/* Mensajes */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 text-red-400 text-sm border border-red-500/20">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm border border-emerald-500/20">
                {success}
              </div>
            )}

            {/* Formulario */}
            {showForm && (
              <form onSubmit={handleSubmit} className="bg-white/[0.02] rounded-2xl border border-white/5 p-6 space-y-4">
                <h3 className="text-sm font-semibold text-white">
                  {editingReview ? 'Editar tu opinión' : 'Tu opinión'}
                </h3>
                
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Valoración *</label>
                  <StarRating rating={formRating} size="lg" interactive onChange={setFormRating} />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Título (opcional)</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    maxLength={150}
                    placeholder="Resume tu experiencia..."
                    className="w-full px-3 py-2 text-sm bg-black/30 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:ring-1 focus:ring-amber-400/50 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Comentario (opcional)</label>
                  <textarea
                    value={formComment}
                    onChange={(e) => setFormComment(e.target.value)}
                    rows={3}
                    placeholder="Cuéntanos más sobre tu experiencia con el producto..."
                    className="w-full px-3 py-2 text-sm bg-black/30 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:ring-1 focus:ring-amber-400/50 focus:border-transparent outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || formRating === 0}
                  className="px-6 py-2.5 text-sm font-medium bg-amber-400 text-gray-900 rounded-xl hover:bg-amber-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Enviando...' : editingReview ? 'Actualizar opinión' : 'Publicar opinión'}
                </button>
              </form>
            )}

            {/* Lista de reseñas */}
            {reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map((review) => {
                  const initials = (review.user_name || 'AN')
                    .split(' ')
                    .filter(Boolean)
                    .map(w => w[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();
                  const isOwn = currentUserId === review.user_id;

                  return (
                    <article
                      key={review.id}
                      className={`bg-white/[0.02] rounded-xl border p-5 ${isOwn ? 'border-amber-400/20' : 'border-white/5'}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-400/10 flex items-center justify-center">
                            <span className="text-amber-400 text-xs font-bold">
                              {initials}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">{review.user_name || 'Anónimo'}</span>
                              {isOwn && (
                                <span className="text-[10px] text-amber-400/60 bg-amber-400/10 px-1.5 py-0.5 rounded">Tu opinión</span>
                              )}
                            </div>
                            <StarRating rating={review.rating} size="sm" />
                            {review.title && (
                              <h4 className="text-sm font-medium text-white mt-1">{review.title}</h4>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isOwn && !showForm && (
                            <button
                              onClick={() => startEditing(review)}
                              className="text-[11px] text-amber-400/70 hover:text-amber-400 transition-colors"
                              title="Editar mi opinión"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                              </svg>
                            </button>
                          )}
                          <span className="text-[11px] text-gray-600 whitespace-nowrap">
                            {timeAgo(review.created_at)}
                          </span>
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-gray-400 leading-relaxed ml-11">
                          {review.comment}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : !showForm && (
              <div className="text-center py-12 bg-white/[0.01] rounded-2xl border border-white/5">
                <svg className="w-12 h-12 text-gray-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
                <p className="text-gray-400 text-sm">No hay opiniones todavía</p>
                <p className="text-gray-600 text-xs mt-1">¡Comparte tu experiencia con este producto!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
