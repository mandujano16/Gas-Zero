import { useEffect, useState } from 'react';
import { Info, ShieldAlert, Sparkles } from 'lucide-react';
import type { GasConfig } from '../types/gas';

interface TipsViewProps {
  gasConfig: GasConfig;
  autonomyDays: number | null;
}

export function TipsView({ gasConfig, autonomyDays }: TipsViewProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [gasConfig.code]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % gasConfig.tips.length);
    }, 6500);
    return () => window.clearInterval(id);
  }, [gasConfig.tips.length]);

  return (
    <div className="gz-view-stack">
      <section className="gz-panel gz-tip-hero">
        <div className="gz-tip-hero-head">
          <span className="gz-tip-badge">
            <Sparkles size={14} />
            Sugerencia para {gasConfig.name} ({gasConfig.symbol})
          </span>
          <div className="gz-tip-dots" role="tablist" aria-label="Sugerencias rotativas">
            {gasConfig.tips.map((_, idx) => (
              <button
                key={idx}
                type="button"
                role="tab"
                aria-selected={idx === activeIndex}
                aria-label={`Consejo ${idx + 1}`}
                className={`gz-tip-dot ${idx === activeIndex ? 'is-active' : ''}`}
                onClick={() => setActiveIndex(idx)}
              />
            ))}
          </div>
        </div>

        <p className="gz-tip-hero-text">{gasConfig.tips[activeIndex]}</p>
      </section>

      <section className="gz-panel">
        <div className="gz-panel-head">
          <h2>Guía de eficiencia · {gasConfig.name}</h2>
          <span className="gz-muted-count">{gasConfig.category}</span>
        </div>

        <ol className="gz-tip-list">
          {gasConfig.tips.map((tip, idx) => (
            <li
              key={idx}
              className={`gz-tip-row ${idx === activeIndex ? 'is-highlighted' : ''}`}
              onClick={() => setActiveIndex(idx)}
            >
              <span className="gz-tip-index">{String(idx + 1).padStart(2, '0')}</span>
              <p>{tip}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="gz-panel gz-safety-card">
        <div className="gz-safety-icon">
          <ShieldAlert size={18} />
        </div>
        <div>
          <h3>Seguridad operativa ({gasConfig.symbol})</h3>
          <p>{gasConfig.safetyNote}</p>
        </div>
      </section>

      <div className="gz-autonomy-footer">
        <Info size={16} />
        <p>
          Con el consumo actual, este cilindro rinde aproximadamente{' '}
          <strong>{autonomyDays !== null ? `${autonomyDays.toFixed(1)} días` : '— días'}</strong>{' '}
          antes de necesitar recarga.
        </p>
      </div>
    </div>
  );
}
