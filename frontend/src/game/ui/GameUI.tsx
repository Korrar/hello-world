import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from '../core/GameEngine';
import type { GameStats } from '../core/GameEngine';
import { GodPower, GOD_POWER_INFO } from '../utils/constants';

const GOD_POWERS = Object.values(GodPower);

const GOD_ICONS: Record<GodPower, string> = {
  [GodPower.ZEUS_LIGHTNING]: '⚡',
  [GodPower.POSEIDON_EARTHQUAKE]: '🌍',
  [GodPower.POSEIDON_FLOOD]: '🌊',
  [GodPower.HEPHAESTUS_FIRE]: '🔥',
  [GodPower.APOLLO_PLAGUE]: '☠️',
  [GodPower.ARES_METEOR]: '☄️',
  [GodPower.HADES_CHASM]: '🕳️',
};

export const GameUI: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [showHelp, setShowHelp] = useState(true);

  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new GameEngine();
    engineRef.current = engine;

    engine.init(canvasRef.current, (newStats) => {
      setStats({ ...newStats });
    });

    const handleResize = () => {
      engine.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Auto-hide help
    const helpTimer = setTimeout(() => setShowHelp(false), 8000);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(helpTimer);
      engine.destroy();
    };
  }, []);

  const selectPower = useCallback((power: GodPower) => {
    engineRef.current?.selectPower(power);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#000' }}>
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />

      {/* Top bar - City name and stats */}
      {stats && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          background: 'linear-gradient(180deg, rgba(62,39,35,0.95) 0%, rgba(62,39,35,0.7) 80%, transparent 100%)',
          padding: '12px 20px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          fontFamily: '"Palatino Linotype", "Book Antiqua", Palatino, serif',
          color: '#FFF8E1',
          pointerEvents: 'none',
        }}>
          <div>
            <h1 style={{
              margin: 0, fontSize: 28, fontWeight: 'bold',
              color: '#FFD54F',
              textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
              letterSpacing: 2,
            }}>
              🏛️ {stats.cityName}
            </h1>
            <div style={{ fontSize: 13, color: '#FFCC80', marginTop: 4 }}>
              Gniew Bogów — Zniszcz starożytne miasto
            </div>
          </div>

          <div style={{ display: 'flex', gap: 30, fontSize: 15 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#FFD54F' }}>{stats.score}</div>
              <div style={{ fontSize: 11, color: '#BCAAA4' }}>PUNKTY</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 'bold' }}>
                🏚️ {stats.buildingsDestroyed}/{stats.totalBuildings}
              </div>
              <div style={{ fontSize: 11, color: '#BCAAA4' }}>BUDYNKI</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 'bold' }}>
                💀 {stats.casualties}/{stats.totalPopulation}
              </div>
              <div style={{ fontSize: 11, color: '#BCAAA4' }}>OFIARY</div>
            </div>
          </div>
        </div>
      )}

      {/* God powers panel - bottom */}
      {stats && (
        <div style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(0deg, rgba(62,39,35,0.95) 0%, rgba(62,39,35,0.7) 80%, transparent 100%)',
          padding: '20px 20px 12px',
          borderRadius: '12px 12px 0 0',
          display: 'flex', gap: 8, alignItems: 'flex-end',
          fontFamily: '"Palatino Linotype", "Book Antiqua", Palatino, serif',
        }}>
          {GOD_POWERS.map((power, idx) => {
            const info = GOD_POWER_INFO[power];
            const isSelected = stats.selectedPower === power;
            return (
              <button
                key={power}
                onClick={() => selectPower(power)}
                title={`${info.name} — ${info.description}`}
                style={{
                  width: 72, height: isSelected ? 88 : 78,
                  background: isSelected
                    ? 'linear-gradient(180deg, #FFD54F 0%, #FF8F00 100%)'
                    : 'linear-gradient(180deg, #5D4037 0%, #3E2723 100%)',
                  border: isSelected ? '3px solid #FFD54F' : '2px solid #795548',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  padding: 4,
                  boxShadow: isSelected ? '0 0 20px rgba(255,213,79,0.5)' : '0 2px 8px rgba(0,0,0,0.3)',
                }}
              >
                <div style={{ fontSize: 26 }}>{GOD_ICONS[power]}</div>
                <div style={{
                  fontSize: 9,
                  fontWeight: 'bold',
                  color: isSelected ? '#3E2723' : '#FFD54F',
                  marginTop: 2,
                  textAlign: 'center',
                  lineHeight: 1.1,
                }}>
                  {info.god}
                </div>
                <div style={{
                  fontSize: 8,
                  color: isSelected ? '#5D4037' : '#BCAAA4',
                  textAlign: 'center',
                  lineHeight: 1.1,
                }}>
                  [{idx + 1}]
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected power tooltip */}
      {stats && (
        <div style={{
          position: 'absolute', bottom: 110, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(62,39,35,0.9)',
          border: '1px solid #795548',
          borderRadius: 8,
          padding: '8px 16px',
          fontFamily: '"Palatino Linotype", serif',
          color: '#FFF8E1',
          textAlign: 'center',
          pointerEvents: 'none',
          maxWidth: 300,
        }}>
          <div style={{ fontSize: 14, fontWeight: 'bold', color: '#FFD54F' }}>
            {GOD_ICONS[stats.selectedPower]} {GOD_POWER_INFO[stats.selectedPower].name}
          </div>
          <div style={{ fontSize: 11, color: '#BCAAA4', marginTop: 2 }}>
            {GOD_POWER_INFO[stats.selectedPower].description}
          </div>
          <div style={{ fontSize: 10, color: '#8D6E63', marginTop: 4 }}>
            Obrażenia: {GOD_POWER_INFO[stats.selectedPower].damage} | Zasięg: {GOD_POWER_INFO[stats.selectedPower].radius} | CD: {GOD_POWER_INFO[stats.selectedPower].cooldown / 1000}s
          </div>
        </div>
      )}

      {/* Help overlay */}
      {showHelp && (
        <div
          onClick={() => setShowHelp(false)}
          style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'rgba(62,39,35,0.95)',
            border: '2px solid #FFD54F',
            borderRadius: 12,
            padding: '24px 32px',
            fontFamily: '"Palatino Linotype", serif',
            color: '#FFF8E1',
            textAlign: 'center',
            cursor: 'pointer',
            maxWidth: 420,
            boxShadow: '0 0 40px rgba(0,0,0,0.5)',
          }}>
          <h2 style={{ margin: '0 0 12px', color: '#FFD54F', fontSize: 22 }}>⚡ Gniew Bogów ⚡</h2>
          <p style={{ margin: '0 0 12px', fontSize: 14, color: '#FFCC80' }}>
            Wciel się w bogów Olimpu i sprowadź zniszczenie na antyczne miasto greckie!
          </p>
          <div style={{ textAlign: 'left', fontSize: 13, lineHeight: 1.8 }}>
            <div>🖱️ <b>Lewy klik</b> — użyj mocy boga</div>
            <div>🖱️ <b>Prawy klik + przeciągnij</b> — przesuń kamerę</div>
            <div>🖱️ <b>Scroll</b> — przybliż / oddal</div>
            <div>⌨️ <b>Klawisze 1-7</b> — wybierz moc boga</div>
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: '#8D6E63' }}>
            Kliknij aby zamknąć
          </div>
        </div>
      )}
    </div>
  );
};
