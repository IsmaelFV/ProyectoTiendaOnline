import { useState } from 'react';
import { customAlert } from '../../lib/notifications';

interface ReturnInfo {
  orderId: string;
  orderNumber: string;
  returnAddress: {
    name: string;
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  returnDeadlineDays: number;
  refundTimeframeDays: string;
}

interface CustomerReturnModalProps {
  orderNumber: string;
  orderId: string;
  onClose: () => void;
}

export default function CustomerReturnModal({ 
  orderNumber, 
  orderId, 
  onClose 
}: CustomerReturnModalProps) {
  const [step, setStep] = useState<'info' | 'request' | 'success'>('info');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Información de devolución (normalmente vendría de la API)
  const returnInfo: ReturnInfo = {
    orderId,
    orderNumber,
    returnAddress: {
      name: 'FashionStore - Centro de Devoluciones',
      street: 'Calle Comercio, 123',
      city: 'Madrid',
      postalCode: '28001',
      country: 'España'
    },
    returnDeadlineDays: 14,
    refundTimeframeDays: '5-10'
  };

  const returnReasons = [
    'Talla incorrecta',
    'No me gusta el producto',
    'Producto dañado o defectuoso',
    'No coincide con la descripción',
    'Error en el pedido',
    'Otro motivo'
  ];

  const handleSubmitReturn = async () => {
    if (!reason) {
      setError('Por favor selecciona un motivo de devolución');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/returns/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          reason
        })
      });

      const result = await response.json();

      if (result.success) {
        setStep('success');
      } else {
        setError(result.error || 'Error al procesar la solicitud');
      }
    } catch (err) {
      setError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            Devolución - Pedido #{orderNumber}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'info' && (
            <div className="space-y-6">
              {/* Información sobre devoluciones */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">
                  📦 Política de Devoluciones
                </h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Tienes <strong>{returnInfo.returnDeadlineDays} días</strong> para devolver tu pedido</li>
                  <li>• El producto debe estar sin usar y con etiquetas</li>
                  <li>• Reembolso en <strong>{returnInfo.refundTimeframeDays} días hábiles</strong> tras recibir el producto</li>
                </ul>
              </div>

              {/* Dirección de devolución */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Dirección de Envío
                </h3>
                <div className="text-sm text-gray-700 space-y-1">
                  <p className="font-medium">{returnInfo.returnAddress.name}</p>
                  <p>{returnInfo.returnAddress.street}</p>
                  <p>{returnInfo.returnAddress.postalCode} {returnInfo.returnAddress.city}</p>
                  <p>{returnInfo.returnAddress.country}</p>
                </div>
                <button
                  onClick={() => {
                    const address = `${returnInfo.returnAddress.name}\n${returnInfo.returnAddress.street}\n${returnInfo.returnAddress.postalCode} ${returnInfo.returnAddress.city}\n${returnInfo.returnAddress.country}`;
                    navigator.clipboard.writeText(address);
                    customAlert('Dirección copiada al portapapeles', 'success');
                  }}
                  className="mt-3 text-sm text-brand-navy hover:text-brand-gold flex items-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copiar dirección
                </button>
              </div>

              {/* Pasos a seguir */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">📋 Pasos para Devolver</h3>
                <ol className="text-sm text-gray-700 space-y-2">
                  <li className="flex items-start">
                    <span className="bg-brand-navy text-white w-6 h-6 rounded-full flex items-center justify-center text-xs mr-3 flex-shrink-0">1</span>
                    <span>Empaqueta el producto en su embalaje original</span>
                  </li>
                  <li className="flex items-start">
                    <span className="bg-brand-navy text-white w-6 h-6 rounded-full flex items-center justify-center text-xs mr-3 flex-shrink-0">2</span>
                    <span>Incluye el albarán de devolución dentro del paquete</span>
                  </li>
                  <li className="flex items-start">
                    <span className="bg-brand-navy text-white w-6 h-6 rounded-full flex items-center justify-center text-xs mr-3 flex-shrink-0">3</span>
                    <span>Envía el paquete a la dirección indicada</span>
                  </li>
                  <li className="flex items-start">
                    <span className="bg-brand-navy text-white w-6 h-6 rounded-full flex items-center justify-center text-xs mr-3 flex-shrink-0">4</span>
                    <span>Recibirás el reembolso una vez verificado el producto</span>
                  </li>
                </ol>
              </div>

              {/* Botón para solicitar */}
              <button
                onClick={() => setStep('request')}
                className="w-full py-3 bg-brand-navy text-white rounded-lg font-medium hover:bg-brand-navy/90 transition-colors"
              >
                Solicitar Devolución
              </button>
            </div>
          )}

          {step === 'request' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo de la devolución *
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-navy focus:border-brand-navy"
                >
                  <option value="">Selecciona un motivo</option>
                  {returnReasons.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('info')}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Volver
                </button>
                <button
                  onClick={handleSubmitReturn}
                  disabled={loading}
                  className="flex-1 py-3 bg-brand-navy text-white rounded-lg font-medium hover:bg-brand-navy/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Procesando...' : 'Confirmar Solicitud'}
                </button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                ¡Solicitud Recibida!
              </h3>
              <p className="text-gray-600 mb-6">
                Hemos registrado tu solicitud de devolución. Recibirás un email con las instrucciones detalladas.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-brand-navy text-white rounded-lg font-medium hover:bg-brand-navy/90 transition-colors"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
