import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
);

interface DiscountCodeInputProps {
  cartTotal: number;
  onDiscountApplied: (discountData: DiscountValidation | null) => void;
}

interface DiscountValidation {
  valid: boolean;
  code?: string;
  discount_type?: string;
  discount_value?: number;
  discount_amount?: number;
  original_total?: number;
  final_total?: number;
  message?: string;
}

export default function DiscountCodeInput({ cartTotal, onDiscountApplied }: DiscountCodeInputProps) {
  const [code, setCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountValidation | null>(null);
  const [error, setError] = useState('');

  // Cargar descuento guardado al montar el componente
  useEffect(() => {
    const savedDiscount = sessionStorage.getItem('appliedDiscount');
    if (savedDiscount) {
      try {
        const discount = JSON.parse(savedDiscount);
        setAppliedDiscount(discount);
        setCode(discount.code || '');
        onDiscountApplied(discount);
      } catch (e) {
        console.error('Error al cargar descuento guardado:', e);
      }
    }
  }, []);

  // Recalcular el descuento si cambia el total del carrito
  useEffect(() => {
    if (appliedDiscount && appliedDiscount.code) {
      validateCode(appliedDiscount.code, true);
    }
  }, [cartTotal]);

  const validateCode = async (codeToValidate: string, silent = false) => {
    if (!codeToValidate.trim()) {
      setError('Por favor ingresa un código');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      const { data, error: rpcError } = await supabase.rpc('validate_discount_code', {
        p_code: codeToValidate.toUpperCase(),
        p_cart_total: cartTotal / 100 // Convertir de centavos a euros
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      const result = data as DiscountValidation;

      if (result.valid) {
        // Convertir valores de euros a centavos para mantener consistencia con el carrito
        const resultInCents = {
          ...result,
          discount_amount: result.discount_amount ? result.discount_amount * 100 : 0,
          original_total: result.original_total ? result.original_total * 100 : 0,
          final_total: result.final_total ? result.final_total * 100 : 0
        };
        
        setAppliedDiscount(resultInCents);
        sessionStorage.setItem('appliedDiscount', JSON.stringify(resultInCents));
        sessionStorage.setItem('discountCode', result.code || '');
        onDiscountApplied(resultInCents);
        if (!silent) {
          setError('');
        }
      } else {
        setAppliedDiscount(null);
        sessionStorage.removeItem('appliedDiscount');
        sessionStorage.removeItem('discountCode');
        onDiscountApplied(null);
        setError(result.message || 'Código no válido');
      }
    } catch (err: any) {
      console.error('Error al validar código:', err);
      setError('Error al validar el código. Inténtalo de nuevo.');
      setAppliedDiscount(null);
      sessionStorage.removeItem('appliedDiscount');
      sessionStorage.removeItem('discountCode');
      onDiscountApplied(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleApplyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    await validateCode(code);
  };

  const handleRemoveDiscount = () => {
    setCode('');
    setAppliedDiscount(null);
    setError('');
    sessionStorage.removeItem('appliedDiscount');
    sessionStorage.removeItem('discountCode');
    onDiscountApplied(null);
  };

  return (
    <div className="border-t pt-4 space-y-3">
      {!appliedDiscount ? (
        <form onSubmit={handleApplyCode} className="space-y-2">
          <label className="block text-sm font-medium text-brand-charcoal">
            ¿Tienes un código de descuento?
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CODIGO"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-transparent uppercase text-sm"
              disabled={isValidating}
            />
            <button
              type="submit"
              disabled={isValidating || !code.trim()}
              className="px-4 py-2 bg-brand-navy text-white rounded-md hover:bg-brand-charcoal transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {isValidating ? 'Validando...' : 'Aplicar'}
            </button>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-xs">
              {error}
            </div>
          )}
        </form>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-green-800">
                Código aplicado: <strong>{appliedDiscount.code}</strong>
              </span>
            </div>
            <button
              onClick={handleRemoveDiscount}
              className="text-xs text-green-700 hover:text-green-900 underline"
            >
              Quitar
            </button>
          </div>
          <div className="text-sm text-green-700">
            Descuento: <strong>-{((appliedDiscount.discount_amount || 0) / 100).toFixed(2)}€</strong>
            {appliedDiscount.discount_type === 'percentage' && (
              <span className="ml-1">({appliedDiscount.discount_value}%)</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
