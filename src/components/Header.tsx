/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Weather } from '../types';
import { SimulationEngine } from '../simulation';
import { Sun, CloudRain, CloudSnow, CloudLightning, Play, Pause, Zap, Flame, Wind } from 'lucide-react';

interface HeaderProps {
  engine: SimulationEngine;
  weather: Weather;
  onSetWeather: (w: Weather) => void;
  runSpeed: number;
  onSetRunSpeed: (speed: number) => void;
  timeString: string;
  dayCount: number;
  stats: SimulationEngine['stats'];
}

export const Header: React.FC<HeaderProps> = ({
  engine,
  weather,
  onSetWeather,
  runSpeed,
  onSetRunSpeed,
  timeString,
  dayCount,
  stats,
}) => {
  // Weather Styling configurations
  const getWeatherIcon = (w: Weather) => {
    switch (w) {
      case Weather.SUNNY:
        return <Sun className="w-5 h-5 text-amber-500 animate-spin-slow" />;
      case Weather.RAINY:
        return <CloudRain className="w-5 h-5 text-blue-400 animate-pulse" />;
      case Weather.SNOWY:
        return <CloudSnow className="w-5 h-5 text-slate-300 animate-bounce" />;
      case Weather.THUNDERSTORM:
        return <CloudLightning className="w-5 h-5 text-purple-400 animate-pulse" />;
    }
  };

  const getWeatherString = (w: Weather) => {
    switch (w) {
      case Weather.SUNNY:
        return 'Sunny Skies';
      case Weather.RAINY:
        return 'Gently Raining';
      case Weather.SNOWY:
        return 'Cold Snowfall';
      case Weather.THUNDERSTORM:
        return 'Severe Storm!';
    }
  };

  return (
    <header className="bg-[#7C9070] border-b-4 border-[#5E6D55] p-4 text-[#F5F5F0] flex flex-col md:flex-row md:items-center md:justify-between gap-4 select-none" id="sim-header">
      {/* Title & Brand logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#B46060] border-2 border-[#8E4B4B] rounded-sm flex items-center justify-center shadow-[4px_4px_0px_#4A4A4A] shrink-0">
          <div className="w-5 h-5 bg-[#FFB07C]" />
        </div>
        <div>
          <h1 className="font-sans font-bold text-lg tracking-tight text-[#F5F5F0] flex items-center gap-2 uppercase">
            Voxel Villager Simulation
          </h1>
          <p className="text-xs text-[#EAEAE3] font-mono opacity-80">Observer Camera active at 3000m</p>
        </div>
      </div>

      {/* Clock and Time representation */}
      <div className="flex items-center bg-[#5E6D55]/60 border border-[#5E6D55] rounded-xl px-4 py-2 gap-4 text-[#F5F5F0]">
        <div className="text-center font-mono border-r border-[#5E6D55] pr-4">
          <span className="text-[10px] uppercase text-[#EAEAE3]/80 block tracking-wider">In-Game Time</span>
          <span className="text-sm font-bold text-[#FFB07C]">{timeString}</span>
        </div>
        <div className="text-center font-mono">
          <span className="text-[10px] uppercase text-[#EAEAE3]/80 block tracking-wider font-semibold">Calendar</span>
          <span className="text-sm font-bold text-[#F5F5F0]">Day {dayCount}</span>
        </div>
        {/* Dynamic sun moon icon slider depending on daylight */}
        <div className="text-2xl ml-1 leading-none">
          {engine.isDaylight() ? '☀️' : '🌙'}
        </div>
      </div>

      {/* Weather Controller Panel */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-[#5E6D55]/60 border border-[#5E6D55] px-3 py-1.5 rounded-lg text-[#F5F5F0]">
          {getWeatherIcon(weather)}
          <span className="text-xs font-mono font-bold text-[#F5F5F0]">{getWeatherString(weather)}</span>
        </div>

        {/* Override Buttons */}
        <div className="flex gap-1 bg-[#5E6D55] p-1 rounded-lg border border-[#4d5a45] h-9 items-center">
          <button
            onClick={() => onSetWeather(Weather.SUNNY)}
            title="Force Sunny weather"
            className={`px-2 py-1 text-xs rounded font-sans transition-all ${
              weather === Weather.SUNNY
                ? 'bg-[#EAEAE3]/20 text-[#FFB07C] border border-[#FFB07C]/40 font-semibold'
                : 'text-[#EAEAE3] hover:text-white'
            }`}
          >
            ☀️
          </button>
          <button
            onClick={() => onSetWeather(Weather.RAINY)}
            title="Force Rainy weather"
            className={`px-2 py-1 text-xs rounded transition-all ${
              weather === Weather.RAINY
                ? 'bg-[#EAEAE3]/20 text-blue-300 border border-blue-300/40 font-semibold'
                : 'text-[#EAEAE3] hover:text-white'
            }`}
          >
            🌧️
          </button>
          <button
            onClick={() => onSetWeather(Weather.SNOWY)}
            title="Force Snowy weather"
            className={`px-2 py-1 text-xs rounded transition-all ${
              weather === Weather.SNOWY
                ? 'bg-[#EAEAE3]/20 text-slate-100 border border-slate-200/40 font-semibold'
                : 'text-[#EAEAE3] hover:text-white'
            }`}
          >
            ❄️
          </button>
          <button
            onClick={() => onSetWeather(Weather.THUNDERSTORM)}
            title="Force Severe Thunderstorm with Lightning"
            className={`px-2 py-1 text-xs rounded transition-all ${
              weather === Weather.THUNDERSTORM
                ? 'bg-[#EAEAE3]/20 text-[#FFB07C] border border-[#FFB07C]/40 font-semibold'
                : 'text-[#EAEAE3] hover:text-white'
            }`}
          >
            ⚡
          </button>
        </div>
      </div>

      {/* Speed dialer controllers */}
      <div className="flex items-center gap-1.5 bg-[#5E6D55] p-1 rounded-xl border border-[#4d5a45] pr-2">
        <button
          onClick={() => onSetRunSpeed(0)}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1 ${
            runSpeed === 0 ? 'bg-[#B46060] text-white font-bold border border-[#8E4B4B]' : 'text-[#EAEAE3] hover:text-white'
          }`}
          title="Pause simulation"
        >
          <Pause className="w-3.5 h-3.5" /> Pause
        </button>
        <button
          onClick={() => onSetRunSpeed(1)}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
            runSpeed === 1 ? 'bg-[#7C9070] text-[#F5F5F0] font-bold border border-[#5E6D55]' : 'text-[#EAEAE3] hover:text-white'
          }`}
          title="Normal simulation speed"
        >
          1x
        </button>
        <button
          onClick={() => onSetRunSpeed(2)}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
            runSpeed === 2 ? 'bg-[#7C9070] text-[#F5F5F0] font-bold border border-[#5E6D55]' : 'text-[#EAEAE3] hover:text-white'
          }`}
          title="Speed up (2x)"
        >
          2x
        </button>
        <button
          onClick={() => onSetRunSpeed(4)}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
            runSpeed === 4 ? 'bg-[#7C9070] text-[#F5F5F0] font-bold border border-[#5E6D55]' : 'text-[#EAEAE3] hover:text-white'
          }`}
          title="Hyper speed (4x)"
        >
          4x
        </button>
      </div>
    </header>
  );
};
