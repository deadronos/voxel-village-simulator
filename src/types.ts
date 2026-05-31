/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  WOOD = 4,
  LEAVES = 5,
  BRICK = 6,
  SAND = 7,
  WATER = 8,
  GLASS = 9,
  TILLED_SOIL = 10,
  WHEAT_1 = 11, // Sprout
  WHEAT_2 = 12, // Medium
  WHEAT_3 = 13, // Mature
  MILL_GRINDER = 14,
  BED = 15,
  GOLD_BLOCK = 16, // For the builder's shrine
  COAL = 17,
}

export enum Weather {
  SUNNY = 'SUNNY',
  RAINY = 'RAINY',
  SNOWY = 'SNOWY',
  THUNDERSTORM = 'THUNDERSTORM'
}

export enum Profession {
  FARMER = 'FARMER',
  MILLER = 'MILLER',
  GUARD = 'GUARD',
  BUILDER = 'BUILDER'
}

export enum VillagerState {
  WANDERING = 'WANDERING',
  WORKING = 'WORKING',
  SEEKING_SHELTER = 'SEEKING_SHELTER',
  SLEEPING = 'SLEEPING',
  SOCIALIZING = 'SOCIALIZING',
  RESTING = 'RESTING',
  DELIVERING = 'DELIVERING',
  PATROLLING = 'PATROLLING',
  CHASING_PEST = 'CHASING_PEST'
}

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface Villager {
  id: string;
  name: string;
  profession: Profession;
  state: VillagerState;
  position: Position3D; // Float positions for smooth rendering pathing
  targetPosition: Position3D | null;
  path: Position3D[];
  energy: number; // 0 to 100
  inventory: {
    wheat: number;
    flour: number;
    bricks: number;
  };
  assignedBed: Position3D;
  assignedWorkplace: Position3D;
  thought: string;
  speed: number;
  rotation: number; // Y-axis rotation in radians
  gender: 'male' | 'female';
  emotion: 'happy' | 'neutral' | 'tired' | 'scared';
}

export interface Pest {
  id: string;
  position: Position3D;
  targetPosition: Position3D | null;
  state: 'wandering' | 'eating_crop' | 'escaping';
  speed: number;
  rotation: number;
  eatTimer: number;
}

export interface SimulationStats {
  wheatHarvested: number;
  flourMilled: number;
  bricksPlaced: number;
  pestsDefeated: number;
  lightningStrikes: number;
}

export interface LogMessage {
  id: string;
  time: string; // e.g., "08:15 AM"
  text: string;
  type: 'info' | 'weather' | 'action' | 'threat';
}

export interface WorldSize {
  width: number;  // X limit
  height: number; // Y limit
  depth: number;  // Z limit
}
