/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BlockType, Profession, Villager, VillagerState, Weather } from '../types';
import { SimulationEngine, SHRINE_BLUEPRINT } from '../simulation';
import {
  Users,
  Compass,
  Hammer,
  FileText,
  Flame,
  Zap,
  Trash2,
  Lock,
  PlusCircle,
  TrendingUp,
  Award
} from 'lucide-react';

interface SidebarProps {
  engine: SimulationEngine;
  selectedVillagerId: string | null;
  onSelectVillager: (id: string | null) => void;
  editorMode: 'view' | 'place' | 'break' | 'lightning' | 'spawn';
  onSetEditorMode: (mode: 'view' | 'place' | 'break' | 'lightning' | 'spawn') => void;
  editorBlockType: BlockType;
  onSetEditorBlockType: (b: BlockType) => void;
  logs: SimulationEngine['logs'];
  onClearLogs: () => void;
  stats: SimulationEngine['stats'];
  onManualSpawnPest: () => void;
}

const BLOCK_LABELS: Record<BlockType, string> = {
  [BlockType.AIR]: 'Air',
  [BlockType.GRASS]: 'Grass Block',
  [BlockType.DIRT]: 'Dirt Block',
  [BlockType.STONE]: 'Stone Column',
  [BlockType.WOOD]: 'Wood Plank',
  [BlockType.LEAVES]: 'Leaves Foliage',
  [BlockType.BRICK]: 'Clay Brick Overlay',
  [BlockType.SAND]: 'River Sand',
  [BlockType.WATER]: 'Fresh Water',
  [BlockType.GLASS]: 'Glass Window',
  [BlockType.TILLED_SOIL]: 'Tilled Soil',
  [BlockType.WHEAT_1]: 'Wheat (Sprouts)',
  [BlockType.WHEAT_2]: 'Wheat (Growing)',
  [BlockType.WHEAT_3]: 'Wheat (Mature)',
  [BlockType.MILL_GRINDER]: 'Industrial Grinder',
  [BlockType.BED]: 'Sleeping Bed',
  [BlockType.GOLD_BLOCK]: 'Golden Shrine Base',
  [BlockType.COAL]: 'Carbonized Coal',
};

const BLOCK_COLORS: Record<number, string> = {
  [BlockType.GRASS]: 'bg-[#55a630]',
  [BlockType.DIRT]: 'bg-[#8d6e63]',
  [BlockType.STONE]: 'bg-[#9e9e9e]',
  [BlockType.WOOD]: 'bg-[#5d4037]',
  [BlockType.LEAVES]: 'bg-[#388e3c]',
  [BlockType.BRICK]: 'bg-[#b23b1e]',
  [BlockType.SAND]: 'bg-[#ffee58]',
  [BlockType.WATER]: 'bg-[#1e88e5]',
  [BlockType.GLASS]: 'bg-[#e2f9fd]',
  [BlockType.TILLED_SOIL]: 'bg-[#4e342e]',
  [BlockType.GOLD_BLOCK]: 'bg-[#ffca28]',
};

export const Sidebar: React.FC<SidebarProps> = ({
  engine,
  selectedVillagerId,
  onSelectVillager,
  editorMode,
  onSetEditorMode,
  editorBlockType,
  onSetEditorBlockType,
  logs,
  onClearLogs,
  stats,
  onManualSpawnPest,
}) => {
  const [activeTab, setActiveTab] = useState<'villagers' | 'sandbox' | 'logs'>('villagers');

  // Convert status back to text
  const getStatusLabel = (state: VillagerState) => {
    switch (state) {
      case VillagerState.WANDERING: return 'Wandering';
      case VillagerState.WORKING: return 'Working';
      case VillagerState.SEEKING_SHELTER: return 'Seeking Shelter 🌧️';
      case VillagerState.SLEEPING: return 'Zzz... Sleeping';
      case VillagerState.SOCIALIZING: return 'Socializing';
      case VillagerState.RESTING: return 'Exhausted Rest 💤';
      case VillagerState.DELIVERING: return 'Delivering Cargo 🎒';
      case VillagerState.PATROLLING: return 'Guard Patrol ⚙️';
      case VillagerState.CHASING_PEST: return 'DEFENDING VILLAGE ⚔️';
    }
  };

  // Convert profession to custom graphic titles
  const getProfBadge = (prof: Profession) => {
    switch (prof) {
      case Profession.FARMER: return { t: 'Farmer', c: 'bg-[#7C9070] text-[#F5F5F0] border-[#5E6D55]', icon: '🌾' };
      case Profession.MILLER: return { t: 'Miller', c: 'bg-[#B46060] text-[#F5F5F0] border-[#8E4B4B]', icon: '⚙️' };
      case Profession.GUARD: return { t: 'Guard', c: 'bg-[#4F4A45] text-[#F5F5F0] border-[#333]', icon: '🛡️' };
      case Profession.BUILDER: return { t: 'Builder', c: 'bg-[#FFB07C] text-slate-900 border-[#FFB07C]', icon: '🔨' };
    }
  };

  const currentCompleted = stats.bricksPlaced;
  const blueprintMax = SHRINE_BLUEPRINT.length;
  const buildPct = Math.min(100, Math.round((currentCompleted / blueprintMax) * 100));

  return (
    <aside className="w-full lg:w-96 bg-[#F5F5F0] border-t lg:border-t-0 lg:border-l-4 border-[#7C9070] flex flex-col h-full text-[#4F4A45] select-none pb-4" id="sim-sidebar">
      {/* Mini Tabs navigation Row */}
      <div className="flex border-b-2 border-[#E0E0DA] bg-[#EAEAE3] p-2 gap-1 font-sans">
        <button
          onClick={() => setActiveTab('villagers')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'villagers'
              ? 'bg-[#7C9070] text-white border border-[#5E6D55] font-bold shadow'
              : 'text-[#5E6D55] hover:bg-[#D4D4CC] hover:text-[#4F4A45]'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Villagers
        </button>
        <button
          onClick={() => setActiveTab('sandbox')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'sandbox'
              ? 'bg-[#7C9070] text-white border border-[#5E6D55] font-bold shadow'
              : 'text-[#5E6D55] hover:bg-[#D4D4CC] hover:text-[#4F4A45]'
          }`}
        >
          <Compass className="w-3.5 h-3.5" /> Divine Sandbox
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all relative ${
            activeTab === 'logs'
              ? 'bg-[#7C9070] text-white border border-[#5E6D55] font-bold shadow'
              : 'text-[#5E6D55] hover:bg-[#D4D4CC] hover:text-[#4F4A45]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Chronicles
          {logs.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-[#B46060] text-[9px] text-white font-bold h-4 w-4 rounded-full flex items-center justify-center border border-[#8E4B4B] animate-pulse">
              {Math.min(9, logs.length)}
            </span>
          )}
        </button>
      </div>

      {/* Primary tab content panes */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 min-h-[300px]">
        {/* --- VILLAGERS TAB --- */}
        {activeTab === 'villagers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-[#E0E0DA]">
              <span className="text-xs font-black text-[#5E6D55] uppercase tracking-widest">Villager Census ({engine.villagers.length})</span>
              {selectedVillagerId && (
                <button
                  onClick={() => onSelectVillager(null)}
                  className="text-[10px] font-bold font-mono text-[#B46060] hover:underline"
                >
                  Clear Spectator Camera
                </button>
              )}
            </div>

            <div className="space-y-3.5">
              {engine.villagers.map((v) => {
                const badge = getProfBadge(v.profession);
                const isSelected = selectedVillagerId === v.id;

                return (
                  <div
                    key={v.id}
                    onClick={() => onSelectVillager(v.id)}
                    className={`p-3.5 rounded-lg border-b-4 transition-all cursor-pointer flex flex-col gap-2.5 ${
                      isSelected
                        ? 'bg-[#EAEAE3] border-2 border-b-4 border-[#7C9070] shadow-md transform scale-[1.01]'
                        : 'bg-[#EAEAE3] border border-b-4 border-[#D4D4CC] hover:bg-[#E2E2D9]'
                    }`}
                  >
                    {/* Header line info */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{badge.icon}</span>
                        <div>
                          <h3 className="text-sm font-bold text-[#4F4A45] leading-tight flex items-center gap-1">
                            {v.name}
                            <span className="text-[10px] text-slate-500 font-normal">({v.gender})</span>
                          </h3>
                          <span className={`text-[9px] font-mono border px-1.5 py-0.5 rounded uppercase font-bold ${badge.c}`}>
                            {badge.t}
                          </span>
                        </div>
                      </div>

                      {/* Select state target identifier */}
                      <span className={`text-[9px] px-2 py-0.5 rounded font-black font-mono transition-all ${
                        isSelected ? 'bg-[#7C9070] text-white border border-[#5E6D55]' : 'bg-[#D4D4CC] text-[#5E6D55] hover:bg-[#C2C2B9]'
                      }`}>
                        {isSelected ? '📷 SPECTATING' : 'SPECTATE'}
                      </span>
                    </div>

                    {/* Energy Bar indicator */}
                    <div>
                      <div className="flex justify-between items-center text-[10px] mb-1 font-mono text-[#5E6D55]">
                        <span className="font-semibold">Energy / Vigor</span>
                        <span className={v.energy <= 25 ? 'text-[#B46060] animate-pulse font-bold' : 'text-[#4F4A45] font-bold'}>
                          {v.energy}%
                        </span>
                      </div>
                      <div className="w-full bg-[#D4D4CC] h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            v.energy <= 20
                              ? 'bg-[#B46060]'
                              : v.energy <= 50
                              ? 'bg-[#FFB07C]'
                              : 'bg-[#7C9070]'
                          }`}
                          style={{ width: `${v.energy}%` }}
                        />
                      </div>
                    </div>

                    {/* Voxel Location coord metrics */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-[#F5F5F0]/80 p-2 rounded-lg border border-[#D4D4CC] text-[#5E6D55]">
                      <div>
                        <span className="text-[#8E8E85] block font-semibold">Position</span>
                        <span className="text-[#4F4A45] font-bold">
                          [{Math.floor(v.position.x)}, {Math.floor(v.position.y)}, {Math.floor(v.position.z)}]
                        </span>
                      </div>
                      <div>
                        <span className="text-[#8E8E85] block font-semibold">Schedule State</span>
                        <span className="text-[#4F4A45] font-sans truncate font-bold">{getStatusLabel(v.state)}</span>
                      </div>
                    </div>

                    {/* Custom Inventory Items list representation */}
                    <div className="flex gap-2 text-[10px] font-mono border-t border-[#D4D4CC] pt-2 flex-wrap text-[#5E6D55]">
                      {v.profession === Profession.FARMER && (
                        <span>🌾 Crop Cargo: <strong className="text-[#4F4A45] font-black">{v.inventory.wheat} / 3</strong></span>
                      )}
                      {v.profession === Profession.MILLER && (
                        <span>🍞 Bakery Flour: <strong className="text-[#4F4A45] font-black">{v.inventory.flour} / 3</strong></span>
                      )}
                      {v.profession === Profession.BUILDER && (
                        <span>🧱 Bricks Carried: <strong className="text-[#4F4A45] font-black">{v.inventory.bricks} / 3</strong></span>
                      )}
                      <span>❤️ Feels: <span className="capitalize text-[#4F4A45] font-semibold">{v.emotion}</span></span>
                    </div>

                    {/* Speech bubble for villager thoughts */}
                    <div className="bg-white text-[11px] px-3 py-2 rounded-xl mt-1 text-[#4F4A45] border-2 border-[#D4D4CC] italic relative flex items-center gap-1.5 before:content-[''] before:absolute before:-top-2.5 before:left-6 before:border-8 before:border-transparent before:border-b-white">
                      <span className="text-[#B46060] font-bold shrink-0">💬</span>
                      "{v.thought}"
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- DIVINE SANDBOX TAB (BLOCK EDITOR) --- */}
        {activeTab === 'sandbox' && (
          <div className="space-y-4">
            <div className="pb-2 border-b border-[#E0E0DA]">
              <h2 className="text-sm font-black text-[#5E6D55] uppercase tracking-wide mb-1 flex items-center gap-1 border-none">
                <Compass className="w-4 h-4 text-[#7C9070]" /> Divine Observer Tools
              </h2>
              <p className="text-xs text-[#5E6D55] leading-relaxed">
                As a flying cloud observer, you have the celestial power to place blocks, strike lightning, and manipulate the terrain click-by-click.
              </p>
            </div>

            {/* Editing mode selection buttons */}
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold text-[#8E8E85] uppercase tracking-wider block">Observer Mode</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onSetEditorMode('view')}
                  className={`p-2.5 rounded-lg text-xs font-bold border-b-4 flex items-center justify-center gap-1.5 transition-all ${
                    editorMode === 'view'
                      ? 'bg-[#7C9070] text-white border-2 border-b-4 border-[#5E6D55]'
                      : 'bg-[#EAEAE3] text-[#5E6D55] border-[#D4D4CC] hover:bg-[#D4D4CC]'
                  }`}
                >
                  🔍 Spectate
                </button>
                <button
                  onClick={() => onSetEditorMode('break')}
                  className={`p-2.5 rounded-lg text-xs font-bold border-b-4 flex items-center justify-center gap-1.5 transition-all ${
                    editorMode === 'break'
                      ? 'bg-[#B46060] text-white border-2 border-b-4 border-[#8E4B4B]'
                      : 'bg-[#EAEAE3] text-[#5E6D55] border-[#D4D4CC] hover:bg-[#D4D4CC]'
                  }`}
                >
                  ⛏️ Break Voxel
                </button>
                <button
                  onClick={() => onSetEditorMode('place')}
                  className={`p-2.5 rounded-lg text-xs font-bold border-b-4 flex items-center justify-center gap-1.5 transition-all ${
                    editorMode === 'place'
                      ? 'bg-[#7C9070] text-white border-2 border-b-4 border-[#5E6D55]'
                      : 'bg-[#EAEAE3] text-[#5E6D55] border-[#D4D4CC] hover:bg-[#D4D4CC]'
                  }`}
                >
                  🧱 Place Voxel
                </button>
                <button
                  onClick={() => onSetEditorMode('lightning')}
                  className={`p-2.5 rounded-lg text-xs font-bold border-b-4 flex items-center justify-center gap-1.5 transition-all ${
                    editorMode === 'lightning'
                      ? 'bg-[#FFB07C] text-slate-900 border-2 border-b-4 border-[#B46060]'
                      : 'bg-[#EAEAE3] text-[#5E6D55] border-[#D4D4CC] hover:bg-[#D4D4CC]'
                  }`}
                >
                  ⚡ Lightning Bolt
                </button>
              </div>
            </div>

            {/* Place Block Type subselection details */}
            {editorMode === 'place' && (
              <div className="space-y-2 border-t border-[#D4D4CC] pt-3">
                <span className="text-xs font-mono font-bold text-[#8E8E85] uppercase tracking-wider block">Voxel Block Palette</span>
                <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
                  {[
                    BlockType.BRICK,
                    BlockType.GLASS,
                    BlockType.WOOD,
                    BlockType.LEAVES,
                    BlockType.STONE,
                    BlockType.DIRT,
                    BlockType.SAND,
                    BlockType.WATER,
                    BlockType.TILLED_SOIL,
                    BlockType.GOLD_BLOCK,
                  ].map((block) => {
                    const isSelected = editorBlockType === block;
                    return (
                      <button
                        key={block}
                        onClick={() => onSetEditorBlockType(block)}
                        className={`p-2 rounded-lg text-[11px] border-b-2 flex items-center gap-2 text-left transition-all ${
                          isSelected
                            ? 'bg-[#7C9070] text-white border-2 border-b-4 border-[#5E6D55] font-bold'
                            : 'bg-[#EAEAE3] text-[#5E6D55] border-[#D4D4CC] hover:bg-[#D4D4CC]'
                        }`}
                      >
                        <span className={`w-3 h-3 rounded shrink-0 ${BLOCK_COLORS[block] || 'bg-[#55a630]'}`} />
                        <span className="truncate font-medium">{BLOCK_LABELS[block]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Helpful interactive action indicators */}
            <div className="bg-[#EAEAE3] border-b-4 border-[#D4D4CC] p-3 rounded-xl space-y-2 text-[#4F4A45]">
              <span className="text-[10px] font-mono font-bold text-[#B46060] uppercase block">Instructions</span>
              <p className="text-xs text-[#5E6D55] leading-relaxed">
                {editorMode === 'view' && 'Drag on the Map scene to orbit. Use the WASD keys or arrows to fly pan. Hover over villagers to see their activities. Zoom with the mouse wheel.'}
                {editorMode === 'break' && 'Click directly on any voxel block inside the 3D grid area to instantly crush/destroy it. Remember, bedrocks on layer 0 are infinite!'}
                {editorMode === 'place' && `Select a block type above, then click on any top or side face of an existing voxel block to append it as a neighbor.`}
                {editorMode === 'lightning' && 'Unleash divine wrath! Click on any block to strike it with high-voltage lightning, scorch the surrounding wood blocks, and play a spark flash effect!'}
                {editorMode === 'spawn' && 'Spawn crop devourer pest rabbits on the border cliffs to challenge Garrick the guard and test his patrol responses!'}
              </p>

              {/* Spawn Rabbit Shortcut Button */}
              <button
                onClick={onManualSpawnPest}
                className="w-full mt-2 py-2 px-3 bg-[#B46060] hover:bg-[#8E4B4B] text-white rounded-lg text-xs font-bold font-sans flex items-center justify-center gap-1.5 transition-all border-b-4 border-[#8E4B4B]"
              >
                <PlusCircle className="w-3.5 h-3.5 text-white" /> Summon Crop Pest Rabbit
              </button>
            </div>
          </div>
        )}

        {/* --- CHRONICLES / HISTORY LOGS TAB --- */}
        {activeTab === 'logs' && (
          <div className="flex flex-col h-full space-y-3 pb-4">
            {/* Ancient Shrine erection progress metrics */}
            <div className="bg-[#EAEAE3] border-b-4 border-[#D4D4CC] p-3.5 rounded-xl space-y-3 text-[#4F4A45]">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-[#B46060]" />
                  <h3 className="text-xs font-bold text-[#5E6D55] font-sans uppercase tracking-wider block">Golden Shrine Project</h3>
                </div>
                <span className="text-xs font-mono font-black text-[#7C9070]">{buildPct}%</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#D4D4CC] h-2 rounded-full overflow-hidden">
                <div className="bg-[#7C9070] h-full rounded-full transition-all duration-700" style={{ width: `${buildPct}%` }} />
              </div>

              <div className="flex justify-between text-[11px] text-[#5E6D55] font-mono">
                <span>Clay Bricks Placed</span>
                <span className="text-[#4F4A45] font-bold">{currentCompleted} / {blueprintMax}</span>
              </div>
              <p className="text-[10px] text-[#8E8E85] leading-relaxed font-sans mt-1">
                {currentCompleted >= blueprintMax
                  ? '🏅 Success! Balthazar successfully assembled all columns and capped the final shrine with golden blocks!'
                  : '🔨 Masonry project active. Balthazar is sorting bricks to complete the columns and arches.'}
              </p>
            </div>

            {/* Live event lists logs header */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-mono font-bold uppercase text-[#5E6D55]">Village Chronicles</span>
              <button
                onClick={onClearLogs}
                title="Wipe Logs"
                className="text-[10px] font-bold text-[#B46060] hover:text-[#8E4B4B] hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Clear Chronicles
              </button>
            </div>

            {/* Scrollable logs logs output container */}
            <div className="flex-1 min-h-[300px] border-2 border-[#D4D4CC] rounded-xl bg-white p-2.5 overflow-y-auto space-y-2.5 max-h-[350px]">
              {logs.length === 0 ? (
                <div className="text-center py-10 text-xs text-[#8E8E85] italic">
                  Chronicles are empty. Watch as the days go by!
                </div>
              ) : (
                logs.map((log) => {
                  let textCol = 'text-[#4F4A45]';
                  let logTypeBadge = 'ℹ️';

                  if (log.type === 'weather') {
                    textCol = 'text-blue-600 font-bold';
                    logTypeBadge = '🌧️';
                  } else if (log.type === 'action') {
                    textCol = 'text-[#7C9070] font-bold';
                    logTypeBadge = '🔨';
                  } else if (log.type === 'threat') {
                    textCol = 'text-[#B46060] font-bold';
                    logTypeBadge = '⚠️';
                  }

                  return (
                    <div key={log.id} className="text-xs border-b border-[#EAEAE3] pb-1.5 last:border-0 leading-relaxed font-serif">
                      <div className="flex items-center justify-between text-[9px] font-mono text-[#8E8E85] mb-0.5">
                        <span className="flex items-center gap-1 font-semibold">
                          <span>{logTypeBadge}</span> {log.type.toUpperCase()}
                        </span>
                        <span>{log.time}</span>
                      </div>
                      <p className={textCol}>{log.text}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
