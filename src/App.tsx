/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { SimulationEngine } from './simulation';
import { VoxelCanvas } from './components/VoxelCanvas';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { BlockType, Weather, Position3D } from './types';
import { Info, HelpCircle, Shuffle, ShieldAlert } from 'lucide-react';

export default function App() {
  // Stable instantiation of the simulation engine across react cycles
  const engine = useMemo(() => new SimulationEngine(), []);

  // UI States synchronized with simulation engine
  const [tickCounter, setTickCounter] = useState(0);
  const [weatherState, setWeatherState] = useState<Weather>(Weather.SUNNY);
  const [runSpeed, setRunSpeed] = useState<number>(1); // 0 (pause), 1x, 2x, 4x
  const [selectedVillagerId, setSelectedVillagerId] = useState<string | null>(null);

  // Editor modes
  const [editorMode, setEditorMode] = useState<'view' | 'place' | 'break' | 'lightning' | 'spawn'>('view');
  const [editorBlockType, setEditorBlockType] = useState<BlockType>(BlockType.BRICK);
  const [hoveredBlockPos, setHoveredBlockPos] = useState<Position3D | null>(null);

  // Overlay guides
  const [showTutorial, setShowTutorial] = useState(true);

  // Synchronize state from engine to React variables
  const syncEngineStates = () => {
    setWeatherState(engine.weather);
    setTickCounter((prev) => prev + 1);
  };

  // Simulation loop timer
  useEffect(() => {
    if (runSpeed === 0) return;

    // Tick intervals: 1x -> 1600ms, 2x -> 800ms, 4x -> 400ms
    const intervalMs = runSpeed === 1 ? 1500 : runSpeed === 2 ? 800 : 400;

    const timer = setInterval(() => {
      engine.tick();
      syncEngineStates();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [runSpeed, engine]);

  // Initial Sync
  useEffect(() => {
    syncEngineStates();
  }, []);

  // Manual forces weather override
  const handleForceWeather = (w: Weather) => {
    engine.weather = w;
    engine.weatherTimer = 45; // Reset timer for next cycle
    engine.addLog(`Divine observer forced weather condition to: ${w.toLowerCase()}`, 'weather');
    syncEngineStates();
  };

  // Trigger manual crop pest rabbit
  const handleManualPestSpawn = () => {
    engine.triggerSpawnPest();
    syncEngineStates();
  };

  const handleClearLogs = () => {
    engine.logs = [];
    syncEngineStates();
  };

  // Catch block changes to force mesh updates
  const handleBlockAction = () => {
    setTickCounter((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col h-screen bg-[#3a3a3a] font-sans text-[#E4E3E0] overflow-hidden" id="voxel-app-root">
      {/* Dynamic Top Administration Header */}
      <Header
        engine={engine}
        weather={weatherState}
        onSetWeather={handleForceWeather}
        runSpeed={runSpeed}
        onSetRunSpeed={setRunSpeed}
        timeString={engine.getFormattedTime()}
        dayCount={engine.dayCount}
        stats={engine.stats}
      />

      {/* Main core layout: Canvas View on left, detailed control lists on right */}
      <div className="flex-1 flex flex-col lg:flex-row relative overflow-hidden">
        
        {/* Dynamic 3D Scene Viewroom container */}
        <div className="flex-1 relative bg-[#3C3C3C] h-[60vh] lg:h-full">
          <VoxelCanvas
            engine={engine}
            tickCounter={tickCounter}
            selectedVillagerId={selectedVillagerId}
            editorMode={editorMode}
            editorBlockType={editorBlockType}
            onBlockPlacedOrBroken={handleBlockAction}
            hoveredBlockPos={hoveredBlockPos}
            setHoveredBlockPos={setHoveredBlockPos}
            runSpeed={runSpeed}
          />

          {/* Floater overlay legends & HUD details */}
          <div className="absolute bottom-4 left-4 pointer-events-none space-y-2 select-none z-10">
            {/* Quick action helper bar */}
            <div className="bg-[#F5F5F0]/90 border-2 border-[#7C9070] backdrop-blur-md px-4 py-3 rounded-xl flex flex-col gap-1 shadow-2xl max-w-sm pointer-events-auto text-[#4F4A45]">
              <span className="text-[10px] font-mono font-bold tracking-widest text-[#B46060] uppercase">Observer Camera HUD</span>
              <div className="text-xs text-[#5E6D55] space-y-1">
                <p>🛰️ <strong className="text-[#4F4A45] font-black">Drag left-mouse</strong> to orbit around center point</p>
                <p>🛰️ <strong className="text-[#4F4A45] font-black">WASD or Arrow Keys</strong> to scan / fly pan terrain</p>
                <p>🛰️ <strong className="text-[#4F4A45] font-black">Mouse wheel</strong> to camera zoom in/out</p>
                <p>🛰️ <strong className="text-[#4F4A45] font-black">Click and Q/E keys</strong> to adjust vertical plane levels</p>
              </div>
            </div>

            {/* Coordinates pointer indicator */}
            {hoveredBlockPos && (
              <div className="bg-black/60 px-4 py-2 rounded-full text-[11px] font-mono text-[#7C9070] shadow-lg pointer-events-none flex gap-3">
                <span>📍 X: {hoveredBlockPos.x}</span>
                <span>Y: {hoveredBlockPos.y}</span>
                <span>Z: {hoveredBlockPos.z}</span>
              </div>
            )}
          </div>

          {/* Quick HUD Spectating Notice */}
          {selectedVillagerId && (
            <div className="absolute top-4 left-4 bg-[#B46060] text-white border-2 border-[#8E4B4B] backdrop-blur-md px-4 py-2 rounded-xl shadow-xl flex items-center justify-between gap-3 animate-pulse text-xs font-semibold z-10 pointer-events-auto select-none">
              <span className="flex items-center gap-1.5 uppercase font-bold tracking-wide">
                🎨 SPECTATING: {engine.villagers.find(o => o.id === selectedVillagerId)?.name}
              </span>
              <button
                onClick={() => setSelectedVillagerId(null)}
                className="bg-[#4F4A45] hover:bg-[#333] text-white border border-[#333] font-mono font-bold px-2 py-1 rounded text-[10px]"
              >
                RELEASE CAM
              </button>
            </div>
          )}

          {/* Quick Info Modal/Card overlay */}
          {showTutorial && (
            <div className="absolute top-4 right-4 bg-[#F5F5F0]/95 border-2 border-[#7C9070] max-w-md p-4 rounded-xl shadow-2xl space-y-3 z-20 pointer-events-auto select-none animate-fade-in text-[#4F4A45]">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 text-[#7C9070]">
                  <HelpCircle className="w-5 h-5 text-[#7C9070]" />
                  <h4 className="text-sm font-black text-[#5E6D55] font-sans uppercase tracking-wider">Village Simulation Guide</h4>
                </div>
                <button
                  onClick={() => setShowTutorial(false)}
                  className="text-[#B46060] hover:text-[#8E4B4B] text-sm font-black font-mono px-1.5"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-[#5E6D55] leading-relaxed font-sans space-y-2">
                <p>
                  You are observing a 3D Minecraft voxel settlement populated by 4 active, autonomous villagers:
                </p>
                <div className="space-y-1 text-[#4F4A45] border-l-2 border-[#7C9070] pl-3">
                  <p>🌾 <strong className="text-[#3A3A3A] font-bold">Farmer Hodge</strong> tills fields, plants crop seeds, and harvests wheat.</p>
                  <p>⚙️ <strong className="text-[#3A3A3A] font-bold">Miller Elspeth</strong> fetches wheat and grinds flour beside Windmill sails.</p>
                  <p>🧱 <strong className="text-[#3A3A3A] font-bold">Builder Balthazar</strong> drafts bricks and assembles a Golden Shrine.</p>
                  <p>🛡️ <strong className="text-[#3A3A3A] font-bold">Guard Garrick</strong> patrols tower spires and chases crop pests.</p>
                </div>
                <p className="pt-1 text-[#B46060] font-bold">
                  💡 Weather Reactions: During severe storms, villagers put down their tools immediately, run into cottages, and seek shelter until sun shines!
                </p>
              </div>
            </div>
          )}

          {!showTutorial && (
            <button
              onClick={() => setShowTutorial(true)}
              className="absolute top-4 right-4 bg-[#F5F5F0]/90 text-[#7C9070] border-2 border-[#7C9070] p-2.5 rounded-full shadow-lg z-10 transition-all pointer-events-auto hover:bg-[#EAEAE3]"
              title="Show Simulation Guide Help"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Responsive Right-Side detailed controls */}
        <Sidebar
          engine={engine}
          selectedVillagerId={selectedVillagerId}
          onSelectVillager={setSelectedVillagerId}
          editorMode={editorMode}
          onSetEditorMode={setEditorMode}
          editorBlockType={editorBlockType}
          onSetEditorBlockType={setEditorBlockType}
          logs={engine.logs}
          onClearLogs={handleClearLogs}
          stats={engine.stats}
          onManualSpawnPest={handleManualPestSpawn}
        />
      </div>

      {/* Bottom Global Actions Bar */}
      <footer className="h-12 bg-[#4F4A45] border-t-4 border-[#333] px-6 flex items-center justify-between text-white relative z-20 shrink-0 select-none">
        <div className="flex gap-4 items-center">
          <span className="text-[11px] uppercase font-bold text-[#7C9070]">Simulation Speed</span>
          <div className="flex gap-1">
            <div className={`w-2 h-2 ${runSpeed >= 1 ? 'bg-[#7C9070]' : 'bg-[#7C9070]/30'}`} />
            <div className={`w-2 h-2 ${runSpeed >= 2 ? 'bg-[#7C9070]' : 'bg-[#7C9070]/30'}`} />
            <div className={`w-2 h-2 ${runSpeed >= 4 ? 'bg-[#7C9070]' : 'bg-[#7C9070]/30'}`} />
          </div>
          <span className="text-[10px] font-mono text-[#EAEAE3] opacity-60">({runSpeed === 0 ? 'Paused' : `${runSpeed}x`})</span>
        </div>
        <div className="flex gap-6">
           <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase opacity-60 text-slate-300">Villagers:</span>
              <span className="text-sm font-bold text-[#EAEAE3]">{engine.villagers.length}</span>
           </div>
           <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase opacity-60 text-slate-300">Active Pests:</span>
              <span className="text-sm font-bold text-[#FFB07C]">{engine.pests.length}</span>
           </div>
           <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase opacity-60 text-slate-300">FPS:</span>
              <span className="text-sm font-bold text-green-400">60.0</span>
           </div>
        </div>
      </footer>
    </div>
  );
}
