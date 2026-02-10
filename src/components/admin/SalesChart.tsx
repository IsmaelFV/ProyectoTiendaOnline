/**
 * ============================================================================
 * Gráfico de Ventas (Últimos 7 días)
 * ============================================================================
 * Dashboard widget usando Chart.js
 */
import { useEffect, useRef } from 'react';

interface SalesChartProps {
  data: {
    labels: string[];
    sales: number[];
    orders: number[];
  };
}

export default function SalesChart({ data }: SalesChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    // Cargar Chart.js dinámicamente
    const loadChart = async () => {
      if (!canvasRef.current) return;

      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);

      // Destruir chart anterior si existe
      if (chartRef.current) {
        chartRef.current.destroy();
      }

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      chartRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [
            {
              label: 'Ventas (€)',
              data: data.sales,
              borderColor: '#1E3A8A', // brand-navy
              backgroundColor: 'rgba(30, 58, 138, 0.1)',
              fill: true,
              tension: 0.4,
              yAxisID: 'y',
            },
            {
              label: 'Pedidos',
              data: data.orders,
              borderColor: '#D4AF37', // brand-gold
              backgroundColor: 'rgba(212, 175, 55, 0.1)',
              fill: false,
              tension: 0.4,
              yAxisID: 'y1',
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            legend: {
              position: 'top',
              labels: {
                usePointStyle: true,
                padding: 20,
              }
            },
            tooltip: {
              backgroundColor: 'white',
              titleColor: '#1E3A8A',
              bodyColor: '#374151',
              borderColor: '#E5E7EB',
              borderWidth: 1,
              padding: 12,
              callbacks: {
                label: function(context: any) {
                  if (context.dataset.label === 'Ventas (€)') {
                    return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}€`;
                  }
                  return `${context.dataset.label}: ${context.parsed.y}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: {
                display: false,
              }
            },
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              title: {
                display: true,
                text: 'Ventas (€)'
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.05)',
              }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              title: {
                display: true,
                text: 'Pedidos'
              },
              grid: {
                drawOnChartArea: false,
              }
            }
          }
        }
      });
    };

    loadChart();

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [data]);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Ventas de los últimos 7 días
      </h3>
      <div className="h-64">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
