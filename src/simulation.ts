/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BlockType,
  Weather,
  Profession,
  VillagerState,
  Position3D,
  Villager,
  Pest,
  SimulationStats,
  LogMessage,
  WorldSize
} from './types';

// World constants
export const WORLD_SIZE: WorldSize = {
  width: 24,
  height: 10,
  depth: 24
};

// Indexing helper
export function getIndex(x: number, y: number, z: number): number {
  return x + y * WORLD_SIZE.width + z * WORLD_SIZE.width * WORLD_SIZE.height;
}

// Check boundaries
export function inBounds(x: number, y: number, z: number): boolean {
  return x >= 0 && x < WORLD_SIZE.width &&
         y >= 0 && y < WORLD_SIZE.height &&
         z >= 0 && z < WORLD_SIZE.depth;
}

// Construction blueprints (pre-defined relative coordinates for construction site project)
// The builder will place blocks at these absolute positions one-by-one from materials.
export const SHRINE_BLUEPRINT: { pos: Position3D; blockType: BlockType }[] = [
  // Pillars
  { pos: { x: 10, y: 2, z: 10 }, blockType: BlockType.BRICK },
  { pos: { x: 10, y: 3, z: 10 }, blockType: BlockType.BRICK },
  { pos: { x: 10, y: 4, z: 10 }, blockType: BlockType.BRICK },

  { pos: { x: 14, y: 2, z: 10 }, blockType: BlockType.BRICK },
  { pos: { x: 14, y: 3, z: 10 }, blockType: BlockType.BRICK },
  { pos: { x: 14, y: 4, z: 10 }, blockType: BlockType.BRICK },

  { pos: { x: 10, y: 2, z: 14 }, blockType: BlockType.BRICK },
  { pos: { x: 10, y: 3, z: 14 }, blockType: BlockType.BRICK },
  { pos: { x: 10, y: 4, z: 14 }, blockType: BlockType.BRICK },

  { pos: { x: 14, y: 2, z: 14 }, blockType: BlockType.BRICK },
  { pos: { x: 14, y: 3, z: 14 }, blockType: BlockType.BRICK },
  { pos: { x: 14, y: 4, z: 14 }, blockType: BlockType.BRICK },

  // Roof Arch Connectors
  { pos: { x: 11, y: 5, z: 10 }, blockType: BlockType.BRICK },
  { pos: { x: 12, y: 5, z: 10 }, blockType: BlockType.BRICK },
  { pos: { x: 13, y: 5, z: 10 }, blockType: BlockType.BRICK },

  { pos: { x: 11, y: 5, z: 14 }, blockType: BlockType.BRICK },
  { pos: { x: 12, y: 5, z: 14 }, blockType: BlockType.BRICK },
  { pos: { x: 13, y: 5, z: 14 }, blockType: BlockType.BRICK },

  { pos: { x: 10, y: 5, z: 11 }, blockType: BlockType.BRICK },
  { pos: { x: 10, y: 5, z: 12 }, blockType: BlockType.BRICK },
  { pos: { x: 10, y: 5, z: 13 }, blockType: BlockType.BRICK },

  { pos: { x: 14, y: 5, z: 11 }, blockType: BlockType.BRICK },
  { pos: { x: 14, y: 5, z: 12 }, blockType: BlockType.BRICK },
  { pos: { x: 14, y: 5, z: 13 }, blockType: BlockType.BRICK },

  // Centerpiece
  { pos: { x: 12, y: 2, z: 12 }, blockType: BlockType.GOLD_BLOCK },
];

export class SimulationEngine {
  public grid: Uint8Array;
  public villagers: Villager[] = [];
  public pests: Pest[] = [];
  public weather: Weather = Weather.SUNNY;
  public weatherTimer: number = 40; // Ticks until next weather shift
  public inGameTime: number = 480; // Starts at 08:00 AM (minutes of day, 0 to 1440)
  public dayCount: number = 1;
  public stats: SimulationStats = {
    wheatHarvested: 0,
    flourMilled: 0,
    bricksPlaced: 0,
    pestsDefeated: 0,
    lightningStrikes: 0,
  };
  public logs: LogMessage[] = [];
  public storedWheatAtMill: number = 0; // Windmill inventory reservoir

  constructor() {
    this.grid = new Uint8Array(WORLD_SIZE.width * WORLD_SIZE.height * WORLD_SIZE.depth);
    this.generateTerrain();
    this.spawnVillagers();
    this.addLog('Welcome to your Voxel Village Simulation. Active observers are online!', 'info');
  }

  // Generate initial voxel terrain map
  private generateTerrain() {
    // Fill layers
    for (let x = 0; x < WORLD_SIZE.width; x++) {
      for (let z = 0; z < WORLD_SIZE.depth; z++) {
        // Base rock
        this.grid[getIndex(x, 0, z)] = BlockType.STONE;
        this.grid[getIndex(x, 1, z)] = BlockType.DIRT;
        this.grid[getIndex(x, 2, z)] = BlockType.GRASS;
      }
    }

    // Generate natural water stream (Corner pond at bottom corner)
    // Runs from z = 0 to 8, x = 0 to 4
    for (let x = 0; x < 6; x++) {
      for (let z = 0; z < 6; z++) {
        const dist = Math.sqrt(x*x + z*z);
        if (dist < 5.5) {
          // Dig soil, place sand and water
          this.grid[getIndex(x, 1, z)] = BlockType.SAND;
          this.grid[getIndex(x, 2, z)] = BlockType.WATER;
        } else if (dist < 6.5) {
          this.grid[getIndex(x, 2, z)] = BlockType.SAND;
        }
      }
    }

    // Build Cottage 1 (Farmer & Miller Home)
    // Position: x = 15..19, z = 15..19
    this.buildHouse(15, 15, 4, 3, 4, BlockType.BRICK, BlockType.LEAVES, { x: 16, y: 2, z: 16 });
    this.grid[getIndex(17, 2, 17)] = BlockType.BED;

    // Build Cottage 2 (Guard & Builder Home)
    // Position: x = 8..12, z = 16..20
    this.buildHouse(8, 16, 4, 3, 4, BlockType.WOOD, BlockType.LEAVES, { x: 9, y: 2, z: 18 });
    this.grid[getIndex(10, 2, 17)] = BlockType.BED;

    // Build Guard Tower
    // Coordinate: x = 3, z = 20
    this.buildGuardTower(3, 20, 5);

    // Build Farm patches
    // Coordinate: x = 3..11, z = 3..11 (excluding river)
    for (let x = 3; x <= 10; x++) {
      for (let z = 4; z <= 10; z++) {
        if (!(x < 6 && z < 6)) { // Keep away from stream
          // Tilled soil grid
          this.grid[getIndex(x, 2, z)] = BlockType.TILLED_SOIL;
          
          // Seed some wheat initial growth, to populate the scene
          const rand = Math.random();
          if (rand < 0.25) {
            this.grid[getIndex(x, 3, z)] = BlockType.WHEAT_1;
          } else if (rand < 0.5) {
            this.grid[getIndex(x, 3, z)] = BlockType.WHEAT_2;
          } else if (rand < 0.7) {
            this.grid[getIndex(x, 3, z)] = BlockType.WHEAT_3;
          }
        }
      }
    }

    // Build Windmill Cylindrical tower
    // Centre x = 18, z = 5 (Ground y = 2)
    // Structure diameter = 4
    this.buildWindmill(18, 5, 6);
  }

  // Helper helper to build a brick/wooden house
  private buildHouse(x: number, z: number, w: number, h: number, d: number, wallType: BlockType, roofType: BlockType, bedPos: Position3D) {
    // Foundations and hollow interior
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        for (let dz = 0; dz < d; dz++) {
          const px = x + dx;
          const py = 2 + dy;
          const pz = z + dz;

          // Wall outlines
          const isEdgeX = dx === 0 || dx === w - 1;
          const isEdgeZ = dz === 0 || dz === d - 1;

          if (isEdgeX || isEdgeZ) {
            // Windows
            if (dy === 1 && ((dx === Math.floor(w/2) && isEdgeZ) || (dz === Math.floor(d/2) && isEdgeX))) {
              this.grid[getIndex(px, py, pz)] = BlockType.GLASS;
            } else {
              this.grid[getIndex(px, py, pz)] = wallType;
            }
          } else {
            this.grid[getIndex(px, py, pz)] = BlockType.AIR;
          }
        }
      }
    }

    // Doorway
    this.grid[getIndex(x + 1, 2, z)] = BlockType.AIR;
    this.grid[getIndex(x + 1, 3, z)] = BlockType.AIR;

    // Bed placing
    this.grid[getIndex(bedPos.x, bedPos.y, bedPos.z)] = BlockType.BED;

    // Roof peaks
    for (let dx = -1; dx <= w; dx++) {
      for (let dz = -1; dz <= d; dz++) {
        this.grid[getIndex(x + dx, 2 + h, z + dz)] = roofType;
      }
    }
  }

  private buildGuardTower(x: number, z: number, towerHeight: number) {
    // 3x3 Stone pillar
    for (let dy = 0; dy < towerHeight; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        for (let dz = 0; dz < 3; dz++) {
          const px = x + dx;
          const py = 2 + dy;
          const pz = z + dz;
          
          const isCenter = dx === 1 && dz === 1;
          if (isCenter && dy < towerHeight - 1) {
            this.grid[getIndex(px, py, pz)] = BlockType.AIR; // Hollow ladder shaft
          } else {
            this.grid[getIndex(px, py, pz)] = BlockType.STONE;
          }
        }
      }
    }

    // Lookout area
    const platformY = 2 + towerHeight;
    for (let dx = -1; dx <= 3; dx++) {
      for (let dz = -1; dz <= 3; dz++) {
        const px = x + dx;
        const py = platformY;
        const pz = z + dz;

        // Platform base
        this.grid[getIndex(px, py, pz)] = BlockType.STONE;

        // Fences/crenels
        const isBorders = dx === -1 || dx === 3 || dz === -1 || dz === 3;
        const isCorners = (dx === -1 && dz === -1) || (dx === 3 && dz === -1) || (dx === -1 && dz === 3) || (dx === 3 && dz === 3);
        if (isBorders && !isCorners) {
          this.grid[getIndex(px, py + 1, pz)] = BlockType.WOOD;
        }
      }
    }
  }

  private buildWindmill(cx: number, cz: number, millHeight: number) {
    // Circular brick hollow tower
    for (let dy = 0; dy < millHeight; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          const dist = Math.sqrt(dx*dx + dz*dz);
          const px = cx + dx;
          const py = 2 + dy;
          const pz = cz + dz;

          if (dist >= 1.4 && dist <= 2.2) {
            this.grid[getIndex(px, py, pz)] = BlockType.BRICK;
          } else if (dist < 1.4) {
            this.grid[getIndex(px, py, pz)] = BlockType.AIR;
          }
        }
      }
    }

    // Doorway
    this.grid[getIndex(cx, 2, cz + 2)] = BlockType.AIR;
    this.grid[getIndex(cx, 3, cz + 2)] = BlockType.AIR;

    // Grinder table placed inside center
    this.grid[getIndex(cx, 2, cz)] = BlockType.MILL_GRINDER;
  }

  // Populate active villagers
  private spawnVillagers() {
    this.villagers = [
      {
        id: 'hodge-farmer',
        name: 'Hodge',
        profession: Profession.FARMER,
        state: VillagerState.WANDERING,
        position: { x: 7, y: 3, z: 7 },
        targetPosition: null,
        path: [],
        energy: 100,
        inventory: { wheat: 0, flour: 0, bricks: 0 },
        assignedBed: { x: 16, y: 2, z: 16 }, // Inside cottage 1
        assignedWorkplace: { x: 6, y: 3, z: 6 }, // Farm patch
        thought: 'Sizing up the farmland today!',
        speed: 1.0,
        rotation: 0,
        gender: 'male',
        emotion: 'happy'
      },
      {
        id: 'elspeth-miller',
        name: 'Elspeth',
        profession: Profession.MILLER,
        state: VillagerState.WANDERING,
        position: { x: 18, y: 2, z: 6 }, // Inside windmill area
        targetPosition: null,
        path: [],
        energy: 100,
        inventory: { wheat: 0, flour: 0, bricks: 0 },
        assignedBed: { x: 17, y: 2, z: 17 }, // Bed 2 Cottage 1
        assignedWorkplace: { x: 18, y: 2, z: 5 }, // Grinder block at windmill center
        thought: 'Checking if the wind is optimal...',
        speed: 0.9,
        rotation: Math.PI,
        gender: 'female',
        emotion: 'neutral'
      },
      {
        id: 'garrick-guard',
        name: 'Garrick',
        profession: Profession.GUARD,
        state: VillagerState.PATROLLING,
        position: { x: 4, y: 7, z: 21 }, // On top of the guard tower
        targetPosition: null,
        path: [],
        energy: 100,
        inventory: { wheat: 0, flour: 0, bricks: 0 },
        assignedBed: { x: 10, y: 2, z: 17 }, // Cottage 2
        assignedWorkplace: { x: 4, y: 7, z: 21 }, // Top of guard tower
        thought: 'All clear on the horizon!',
        speed: 1.1,
        rotation: 0,
        gender: 'male',
        emotion: 'neutral'
      },
      {
        id: 'balthazar-builder',
        name: 'Balthazar',
        profession: Profession.BUILDER,
        state: VillagerState.WANDERING,
        position: { x: 12, y: 3, z: 12 },
        targetPosition: null,
        path: [],
        energy: 100,
        inventory: { wheat: 0, flour: 0, bricks: 0 },
        assignedBed: { x: 9, y: 2, z: 18 }, // Cottage 2 bed
        assignedWorkplace: { x: 12, y: 2, z: 12 }, // Shrine focal center site
        thought: 'Drafting the blueprint layout...',
        speed: 0.95,
        rotation: Math.PI / 2,
        gender: 'male',
        emotion: 'neutral'
      }
    ];
  }

  // Simple Breadcrumb BFS pathfinding to walk along surface voxels
  // Villagers can step if dy <= 1 between adjacent cells
  public findPath(start: Position3D, target: Position3D): Position3D[] {
    const sx = Math.floor(start.x);
    const sz = Math.floor(start.z);
    const tx = Math.floor(target.x);
    const tz = Math.floor(target.z);

    if (sx === tx && sz === tz) return [];

    const queue: { x: number; z: number; path: Position3D[] }[] = [];
    const visited = new Set<string>();

    queue.push({ x: sx, z: sz, path: [] });
    visited.add(`${sx},${sz}`);

    let safetyCounter = 0;
    while (queue.length > 0 && safetyCounter++ < 500) {
      const curr = queue.shift()!;
      if (curr.x === tx && curr.z === tz) {
        return curr.path;
      }

      // 4-way navigation
      const dirs = [
        { dx: 0, dz: 1 },
        { dx: 0, dz: -1 },
        { dx: 1, dz: 0 },
        { dx: -1, dz: 0 }
      ];

      for (const d of dirs) {
        const nx = curr.x + d.dx;
        const nz = curr.z + d.dz;
        const key = `${nx},${nz}`;

        if (nx >= 0 && nx < WORLD_SIZE.width && nz >= 0 && nz < WORLD_SIZE.depth && !visited.has(key)) {
          // Find surface height of current and next cells
          const curY = this.getSurfaceHeight(curr.x, curr.z);
          const nextY = this.getSurfaceHeight(nx, nz);

          // Voxel navigation rule: cannot climb walls higher than 1 block, cannot pass through deep water unless sand
          const heightDiff = Math.abs(curY - nextY);
          const isNextWater = this.grid[getIndex(nx, nextY, nz)] === BlockType.WATER;

          if (heightDiff <= 1 && !isNextWater) {
            visited.add(key);
            const nextPoint: Position3D = { x: nx, y: nextY, z: nz };
            queue.push({
              x: nx,
              z: nz,
              path: [...curr.path, nextPoint]
            });
          }
        }
      }
    }

    // Fallback direct ray vector path standard path to close gap if trapped
    return [{ x: tx, y: this.getSurfaceHeight(tx, tz), z: tz }];
  }

  // Find topmost solid block (excluding logs, leaves, windows etc for pure walking surface height)
  public getSurfaceHeight(x: number, z: number): number {
    for (let y = WORLD_SIZE.height - 1; y >= 0; y--) {
      const cell = this.grid[getIndex(x, y, z)];
      if (cell !== BlockType.AIR && cell !== BlockType.WATER && cell !== BlockType.LEAVES) {
        // Upper boundaries
        return y + 1;
      }
    }
    return 2; // Default grass level
  }

  // Core Simulation Tick (Executed on time interval in component)
  public tick() {
    // 1. Advance in-game time (1 tick = 12 minutes in-game)
    this.inGameTime = (this.inGameTime + 12) % 1440;
    if (this.inGameTime === 0) {
      this.dayCount++;
      this.addLog(`Day ${this.dayCount} has begun. Good morning villagers!`, 'info');
    }

    // 2. Weather updates
    this.weatherTimer--;
    if (this.weatherTimer <= 0) {
      const weathers = [Weather.SUNNY, Weather.RAINY, Weather.SNOWY, Weather.THUNDERSTORM];
      // Weighted weather probability (sunny is most common)
      const r = Math.random();
      let nextWeather = Weather.SUNNY;
      if (r < 0.45) nextWeather = Weather.SUNNY;
      else if (r < 0.70) nextWeather = Weather.RAINY;
      else if (r < 0.85) nextWeather = Weather.SNOWY;
      else nextWeather = Weather.THUNDERSTORM;

      if (this.weather !== nextWeather) {
        this.weather = nextWeather;
        this.addLog(`The weather is shifting to: ${nextWeather.toLowerCase()}`, 'weather');
      }
      this.weatherTimer = 40 + Math.floor(Math.random() * 30);
    }

    // Lightning Strike logic (during Thunderstorms only, 5% each tick)
    if (this.weather === Weather.THUNDERSTORM && Math.random() < 0.08) {
      const strikeX = Math.floor(Math.random() * WORLD_SIZE.width);
      const strikeZ = Math.floor(Math.random() * WORLD_SIZE.depth);
      const strikeY = this.getSurfaceHeight(strikeX, strikeZ) - 1;
      
      this.stats.lightningStrikes++;
      this.addLog(`⚡ Lightning struck the coordinates [X:${strikeX}, Z:${strikeZ}]!`, 'threat');
      
      // Ignite / blast block occasionally
      if (inBounds(strikeX, strikeY, strikeZ)) {
        const hitBlock = this.grid[getIndex(strikeX, strikeY, strikeZ)];
        if (hitBlock === BlockType.LEAVES || hitBlock === BlockType.WOOD) {
          this.grid[getIndex(strikeX, strikeY, strikeZ)] = BlockType.COAL; // Burnt wood
          this.addLog(`A strike scorched wood/foliage blocks into coal!`, 'action');
        }
      }
    }

    // 3. Wheat Crops growth simulation (during day, enhanced by rain/sunny, stopped by cold snow)
    if (this.isDaylight()) {
      const growthFactor = this.weather === Weather.RAINY ? 0.12 : (this.weather === Weather.SNOWY ? 0.01 : 0.07);
      for (let x = 3; x <= 10; x++) {
        for (let z = 4; z <= 10; z++) {
          const sY = 2; // Grass height
          const soilBlock = this.grid[getIndex(x, sY, z)];
          if (soilBlock === BlockType.TILLED_SOIL) {
            const cropY = 3;
            const cropBlock = this.grid[getIndex(x, cropY, z)];

            if (cropBlock === BlockType.AIR && Math.random() < 0.1) {
              // Auto sow seed by nature/farmer
              this.grid[getIndex(x, cropY, z)] = BlockType.WHEAT_1;
            } else if (cropBlock === BlockType.WHEAT_1 && Math.random() < growthFactor) {
              this.grid[getIndex(x, cropY, z)] = BlockType.WHEAT_2;
            } else if (cropBlock === BlockType.WHEAT_2 && Math.random() < growthFactor) {
              this.grid[getIndex(x, cropY, z)] = BlockType.WHEAT_3;
            }
          }
        }
      }
    }

    // 4. Pest Rabbit Simulation
    // Spawns with 12% probability per tick if sunny/rainy, eats fully grown wheat!
    if (this.pests.length < 3 && (this.weather === Weather.SUNNY || this.weather === Weather.RAINY) && Math.random() < 0.15) {
      const spawnX = Math.random() < 0.5 ? 0 : WORLD_SIZE.width - 2;
      const spawnZ = Math.floor(Math.random() * WORLD_SIZE.depth);
      const spawnY = this.getSurfaceHeight(spawnX, spawnZ);
      const newPest: Pest = {
        id: `pest-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        position: { x: spawnX, y: spawnY, z: spawnZ },
        targetPosition: null,
        state: 'wandering',
        speed: 1.2,
        rotation: Math.random() * Math.PI * 2,
        eatTimer: 0
      };
      this.pests.push(newPest);
      this.addLog(`🐇 A wild crop miner pest rabbit has arrived from the borders!`, 'threat');
    }

    // Update Pests State
    this.pests = this.pests.filter(pest => {
      // If escaping/finished
      if (pest.state === 'escaping' && pest.position.x <= 0.5) {
        return false; // Leave game
      }

      // Check coordinates
      const px = Math.floor(pest.position.x);
      const pz = Math.floor(pest.position.z);

      if (pest.state === 'wandering') {
        // Find nearest wheat block to raid
        const targetCrop = this.findNearestBlock(pest.position, BlockType.WHEAT_3);
        if (targetCrop) {
          pest.state = 'eating_crop';
          pest.targetPosition = targetCrop;
        } else {
          // Wander randomly
          if (!pest.targetPosition || this.dist3D(pest.position, pest.targetPosition) < 0.5) {
            const rx = Math.max(1, Math.min(WORLD_SIZE.width - 2, px + (Math.random() < 0.5 ? -3 : 3)));
            const rz = Math.max(1, Math.min(WORLD_SIZE.depth - 2, pz + (Math.random() < 0.5 ? -3 : 3)));
            pest.targetPosition = { x: rx, y: this.getSurfaceHeight(rx, rz), z: rz };
          }
        }
      } else if (pest.state === 'eating_crop') {
        if (pest.targetPosition) {
          const dist = this.dist3D(pest.position, pest.targetPosition);
          if (dist < 1.0) {
            pest.eatTimer++;
            if (pest.eatTimer >= 3) {
              // Consume crop
              const cx = Math.floor(pest.targetPosition.x);
              const cy = Math.floor(pest.targetPosition.y);
              const cz = Math.floor(pest.targetPosition.z);
              if (inBounds(cx, cy, cz) && this.grid[getIndex(cx, cy, cz)] === BlockType.WHEAT_3) {
                this.grid[getIndex(cx, cy, cz)] = BlockType.AIR; // Eat crop
                this.addLog(`⚠️ A pest rabbit nibbled away a patch of mature wheat!`, 'threat');
              }
              pest.state = 'wandering';
              pest.targetPosition = null;
              pest.eatTimer = 0;
            }
          } else {
            // Path towards it
            this.moveEntitySmoothly(pest, pest.targetPosition, 0.4);
          }
        } else {
          pest.state = 'wandering';
        }
      }

      // Move pest if has target
      if (pest.targetPosition) {
        this.moveEntitySmoothly(pest, pest.targetPosition, 0.45);
      }
      return true;
    });

    // 5. Update Villagers Decision logic
    this.villagers.forEach(v => {
      this.updateVillagerBehavior(v);
    });
  }

  // Smooth floating motion towards target step
  private moveEntitySmoothly(entity: { position: Position3D; rotation: number }, target: Position3D, stepSpeed: number) {
    const dx = target.x - entity.position.x;
    const dz = target.z - entity.position.z;
    const distance = Math.sqrt(dx*dx + dz*dz);

    if (distance > 0.05) {
      entity.position.x += (dx / distance) * stepSpeed;
      entity.position.z += (dz / distance) * stepSpeed;
      entity.rotation = Math.atan2(dx, dz);
    }
    // Snap height smoothly
    const currH = this.getSurfaceHeight(Math.floor(entity.position.x), Math.floor(entity.position.z));
    entity.position.y = entity.position.y * 0.7 + currH * 0.3;
  }

  // Calculate high-detailed action states per villager
  private updateVillagerBehavior(v: Villager) {
    const hour = this.inGameTime / 60;
    const isNight = hour >= 21.0 || hour < 6.0; // 9:00 PM to 6:00 AM
    const isStormShelterNecessary = this.weather === Weather.THUNDERSTORM || (this.weather === Weather.RAINY && Math.random() < 0.6);

    // Energy recovery cycle
    if (v.state === VillagerState.SLEEPING) {
      v.energy = Math.min(100, v.energy + 15);
      v.emotion = 'happy';
    } else {
      v.energy = Math.max(0, v.energy - 1);
    }

    // Exhaustion overrides work behavior
    if (v.energy <= 10 && v.state !== VillagerState.SLEEPING) {
      v.state = VillagerState.RESTING;
      v.thought = `Phew! Completely exhausted, heading to bed early.`;
      v.targetPosition = v.assignedBed;
      v.emotion = 'tired';
      
      if (this.dist3D(v.position, v.assignedBed) < 1.1) {
        v.state = VillagerState.SLEEPING;
        v.position = { ...v.assignedBed }; // Snap to bed
        v.thought = 'Zzz... Sleeping early due to exhaustion.';
      } else {
        this.setPathToTarget(v, v.assignedBed);
      }
      this.advancePathing(v);
      return;
    }

    // Nighttime Sleep schedule: Bed time!
    if (isNight) {
      if (v.state !== VillagerState.SLEEPING) {
        if (this.dist3D(v.position, v.assignedBed) < 1.1) {
          v.state = VillagerState.SLEEPING;
          v.position = { ...v.assignedBed }; // Snap to bed
          v.thought = 'Zzz... Sleeping soundly.';
        } else {
          v.state = VillagerState.WANDERING;
          v.thought = 'Very dark out. Retreating back to my bedroom.';
          this.setPathToTarget(v, v.assignedBed);
        }
      }
      this.advancePathing(v);
      return; // Stop other behaviors
    } else if (v.state === VillagerState.SLEEPING) {
      if (v.energy < 100) {
        // Keep sleeping during the day if energy not fully restored
        return;
      }
      // Wake up time!
      v.state = VillagerState.WANDERING;
      v.thought = 'Yawn! Rise and shine village is beautiful!';
      v.emotion = 'happy';
    }

    // Weather shelter overrides workday
    if (isStormShelterNecessary && v.profession !== Profession.GUARD) {
      v.state = VillagerState.SEEKING_SHELTER;
      v.emotion = 'scared';
      v.thought = 'Thunderstorm! Running indoors to dry off!';
      
      const shelterPoint = v.assignedBed; // Go home
      if (this.dist3D(v.position, shelterPoint) < 1.2) {
        v.thought = 'Warm and safe indoors until weather clears.';
        v.path = [];
      } else {
        this.setPathToTarget(v, shelterPoint);
      }
      this.advancePathing(v);
      return;
    }

    // --- Profession State Machines ---
    switch (v.profession) {
      case Profession.FARMER:
        this.runFarmerLogic(v);
        break;
      case Profession.MILLER:
        this.runMillerLogic(v);
        break;
      case Profession.GUARD:
        this.runGuardLogic(v);
        break;
      case Profession.BUILDER:
        this.runBuilderLogic(v);
        break;
    }

    // Execute active movement pathing
    this.advancePathing(v);
  }

  // --- Farmer Routine ---
  private runFarmerLogic(v: Villager) {
    // 1. If has harvested wheat, deliver to Miller pile (windmill grinder block at 18, 2, 5)
    if (v.inventory.wheat >= 3) {
      v.state = VillagerState.DELIVERING;
      v.thought = 'Sack of grain is full, delivering to the Windmill!';
      const deliveryTarget = { x: 18, y: 2, z: 6 };
      
      if (this.dist3D(v.position, deliveryTarget) < 1.2) {
        // Delivered!
        this.storedWheatAtMill += v.inventory.wheat;
        v.inventory.wheat = 0;
        this.addLog(`🌾 Hodge handed over wheat bundles to the mill reservoir.`, 'action');
        v.state = VillagerState.WANDERING;
        v.thought = 'Delivery complete. Returning to farms.';
      } else {
        this.setPathToTarget(v, deliveryTarget);
      }
      return;
    }

    // 2. Scan for fully mature wheat crops and harvest them
    const targetCrop = this.findNearestBlock(v.position, BlockType.WHEAT_3);
    if (targetCrop) {
      v.state = VillagerState.WORKING;
      v.thought = 'Harvesting ripe, golden wheat stalks!';
      
      if (this.dist3D(v.position, targetCrop) < 1.2) {
        // Harvest wheat block
        const cx = Math.floor(targetCrop.x);
        const cy = Math.floor(targetCrop.y);
        const cz = Math.floor(targetCrop.z);
        if (inBounds(cx, cy, cz) && this.grid[getIndex(cx, cy, cz)] === BlockType.WHEAT_3) {
          this.grid[getIndex(cx, cy, cz)] = BlockType.TILLED_SOIL; // Return to tilled soil
          v.inventory.wheat++;
          this.stats.wheatHarvested++;
          v.emotion = 'happy';
          v.thought = 'Harvested a bunch! This batch looks excellent!';
        }
      } else {
        this.setPathToTarget(v, targetCrop);
      }
      return;
    }

    // 3. Scan for empty tilled soil and plant wheat sprouts
    const vacantSoil = this.findNearestBlock(v.position, BlockType.TILLED_SOIL, true); // true = check empty top
    if (vacantSoil) {
      v.state = VillagerState.WORKING;
      v.thought = 'Sowing a fresh line of handpicked wheat seeds.';
      
      if (this.dist3D(v.position, vacantSoil) < 1.2) {
        // Plant seeds
        const cx = Math.floor(vacantSoil.x);
        const cy = Math.floor(vacantSoil.y) + 1; // 1 block above soil
        const cz = Math.floor(vacantSoil.z);
        if (inBounds(cx, cy, cz) && this.grid[getIndex(cx, cy, cz)] === BlockType.AIR) {
          this.grid[getIndex(cx, cy, cz)] = BlockType.WHEAT_1; // Plant sprout
          v.thought = 'Placed sprout. Growing nicely!';
        }
      } else {
        this.setPathToTarget(v, vacantSoil);
      }
      return;
    }

    // 4. Default: wanders around farm patch peacefully
    v.state = VillagerState.WANDERING;
    v.thought = 'Tending to the soil beds and inspecting for pests.';
    v.emotion = 'neutral';
    if (!v.targetPosition || this.dist3D(v.position, v.targetPosition) < 0.6) {
      const rx = Math.floor(4 + Math.random() * 6);
      const rz = Math.floor(4 + Math.random() * 6);
      v.targetPosition = { x: rx, y: this.getSurfaceHeight(rx, rz), z: rz };
      v.path = [];
    }
  }

  // --- Miller Routine ---
  private runMillerLogic(v: Villager) {
    const millStation = { x: 18, y: 2, z: 5 }; // Location of millstone

    // 1. If we have flour stored in hand, place in bakery chest (bed 15,15 inside Cottage)
    if (v.inventory.flour >= 3) {
      v.state = VillagerState.DELIVERING;
      v.thought = 'Placing fresh flour bags in the pantry storage chest.';
      const deliveryTarget = { x: 16, y: 2, z: 16 }; // Inside cottage
      
      if (this.dist3D(v.position, deliveryTarget) < 1.1) {
        this.stats.flourMilled += v.inventory.flour;
        v.inventory.flour = 0;
        v.state = VillagerState.WANDERING;
        v.thought = 'Flour delivered. Heading back to the mill!';
        this.addLog(`🍞 Elspeth stockpiled ground flour sacks in the food chest.`, 'action');
      } else {
        this.setPathToTarget(v, deliveryTarget);
      }
      return;
    }

    // 2. Grinding wheat if mill reservoir holds grain
    if (this.storedWheatAtMill > 0) {
      v.state = VillagerState.WORKING;
      v.thought = `Active grinding! Stocks left: ${this.storedWheatAtMill} wheat bushels.`;
      
      if (this.dist3D(v.position, millStation) < 1.1) {
        // Convert wheat to flour! Takes a few ticks
        this.storedWheatAtMill--;
        v.inventory.flour++;
        v.emotion = 'happy';
        this.addLog(`⚙️ Elspeth is grinding golden wheat into fine bakery flour!`, 'action');
      } else {
        this.setPathToTarget(v, millStation);
      }
      return;
    }

    // 3. Requesting crop: If farmer is nearby, she walks to Farmer to converse
    const farmer = this.villagers.find(o => o.profession === Profession.FARMER);
    if (farmer && farmer.inventory.wheat > 0) {
      v.state = VillagerState.SOCIALIZING;
      v.thought = 'Asking Hodge the farmer for wheat to keep millstones spinning.';
      if (this.dist3D(v.position, farmer.position) < 1.5) {
        // Chat interaction
        farmer.thought = 'Giving Miller my spare harvest grain!';
        v.thought = 'Yum grain received! Thank you Hodge.';
        v.inventory.flour += Math.min(3, farmer.inventory.wheat);
        farmer.inventory.wheat = Math.max(0, farmer.inventory.wheat - 3);
      } else {
        this.setPathToTarget(v, farmer.position);
      }
      return;
    }

    // 4. Standby: Rest inside mill/enjoy view
    v.state = VillagerState.WANDERING;
    v.thought = 'Waiting for the crop harvests. Listening to the mill sails.';
    if (!v.targetPosition || this.dist3D(v.position, v.targetPosition) < 0.6) {
      const rx = Math.floor(16 + Math.random() * 4);
      const rz = Math.floor(4 + Math.random() * 3);
      v.targetPosition = { x: rx, y: this.getSurfaceHeight(rx, rz), z: rz };
      v.path = [];
    }
  }

  // --- Guard Routine ---
  private runGuardLogic(v: Villager) {
    // 1. Highest priority: Protect crops by chasing pest rabbits
    if (this.pests.length > 0) {
      // Find closest pest
      let closestPest = this.pests[0];
      let minDist = this.dist3D(v.position, closestPest.position);
      for (const p of this.pests) {
        const d = this.dist3D(v.position, p.position);
        if (d < minDist) {
          minDist = d;
          closestPest = p;
        }
      }

      v.state = VillagerState.CHASING_PEST;
      v.emotion = 'neutral';
      v.thought = '⚔️ Spied crop-mining pest rabbit! Advancing to protect farmland!';
      
      if (minDist < 1.1) {
        // Strike pest
        this.pests = this.pests.filter(o => o.id !== closestPest.id);
        this.addLog(`⚔️ Garrick slashed and chased away a crop pest rabbit!`, 'action');
        this.stats.pestsDefeated++;
        v.thought = 'Scared them off! Returning to standard patrol vectors.';
        v.emotion = 'happy';
        v.state = VillagerState.PATROLLING;
      } else {
        // Sprint to pest
        this.setPathToTarget(v, closestPest.position);
      }
      return;
    }

    // 2. Standard patrol sequence
    v.state = VillagerState.PATROLLING;
    v.thought = 'Heavy armor patrols. Security perimeter is fully secure.';
    
    // Choose landmarks: Guard tower spire (3,7,20), Southern gate (12, 2, 22), Crop borders (8, 2, 8)
    const patrolPoints = [
      { x: 4, y: 7, z: 21 }, // Spire platform
      { x: 12, y: 2, z: 21 }, // Residential gate
      { x: 8, y: 2, z: 8 },  // Farm intersection
      { x: 17, y: 2, z: 9 }   // Windmill borders
    ];

    const isAtTarget = v.targetPosition && 
      this.dist2D(v.position, v.targetPosition) < 0.6 && 
      Math.abs(v.position.y - v.targetPosition.y) < 1.5;

    if (!v.targetPosition || isAtTarget) {
      const nextPatrol = patrolPoints[Math.floor(Math.random() * patrolPoints.length)];
      this.setPathToTarget(v, nextPatrol);
    }
  }

  // --- Builder Routine (Brick-by-brick constructing shrine site) ---
  private runBuilderLogic(v: Villager) {
    // Locate construction site blueprint project
    const currentCompleted = this.stats.bricksPlaced;
    const blueprintCount = SHRINE_BLUEPRINT.length;

    // Checks if project is completed
    if (currentCompleted >= blueprintCount) {
      v.state = VillagerState.WANDERING;
      v.thought = 'The Golden Shrine is complete! Magnificent architectural work!';
      v.emotion = 'happy';

      // Leisure walks near shrine center (12, 12)
      if (!v.targetPosition || this.dist3D(v.position, v.targetPosition) < 0.6) {
        const rx = Math.floor(10 + Math.random() * 5);
        const rz = Math.floor(10 + Math.random() * 5);
        v.targetPosition = { x: rx, y: this.getSurfaceHeight(rx, rz), z: rz };
        v.path = [];
      }
      return;
    }

    // 1. If builder has brick materials in hand, travel to shrine and place block
    if (v.inventory.bricks > 0) {
      v.state = VillagerState.WORKING;
      const blueprintTarget = SHRINE_BLUEPRINT[currentCompleted];
      v.thought = `Carrying materials to place on block #${currentCompleted + 1}.`;

      if (this.dist2D(v.position, blueprintTarget.pos) < 1.6 && Math.abs(v.position.y - blueprintTarget.pos.y) < 3.5) {
        // Place brick block in the world grid!
        const b = blueprintTarget.pos;
        if (inBounds(b.x, b.y, b.z)) {
          this.grid[getIndex(b.x, b.y, b.z)] = blueprintTarget.blockType;
          v.inventory.bricks--;
          this.stats.bricksPlaced++;
          this.addLog(`🔨 Balthazar placed a brick at [${b.x}, ${b.y}, ${b.z}] for the shrine!`, 'action');
          v.thought = 'Block fitted perfectly! High masonry craftmanship.';
        }
      } else {
        this.setPathToTarget(v, blueprintTarget.pos);
      }
      return;
    }

    // 2. Otherwise: Builder goes near cottage storage crates (11, 2, 15) to replenish material
    const materialDepot = { x: 10, y: 2, z: 15 };
    v.state = VillagerState.WANDERING;
    v.thought = 'Heading to the construction supply crates for bricks...';

    if (this.dist3D(v.position, materialDepot) < 1.1) {
      v.inventory.bricks = 3; // Refill
      v.thought = 'Stocked with 3 sturdy clay bricks. Returning to site.';
      v.emotion = 'happy';
    } else {
      this.setPathToTarget(v, materialDepot);
    }
  }

  // Set vector logic pathfinders
  private setPathToTarget(v: Villager, target: Position3D) {
    const curTargetX = v.targetPosition ? Math.floor(v.targetPosition.x) : -1;
    const curTargetZ = v.targetPosition ? Math.floor(v.targetPosition.z) : -1;
    const nTargetX = Math.floor(target.x);
    const nTargetZ = Math.floor(target.z);

    if (curTargetX !== nTargetX || curTargetZ !== nTargetZ) {
      v.targetPosition = target;
      v.path = this.findPath(v.position, target);
    }
  }

  // Move along navigation breadcrumbs
  private advancePathing(v: Villager) {
    if (v.path.length > 0) {
      const nextStep = v.path[0];
      const dist = this.dist2D(v.position, nextStep);

      if (dist < 0.25) {
        // Arrived at waypoint
        v.position.x = nextStep.x;
        v.position.z = nextStep.z;
        v.position.y = nextStep.y;
        v.path.shift();
      } else {
        // Step forward smoothly
        this.moveEntitySmoothly(v, nextStep, v.speed * 0.2);
      }
    } else if (v.targetPosition) {
      // Small adjust final gap (use 2D distance and height tolerance to prevent getting stuck due to offset)
      const dist2D = this.dist2D(v.position, v.targetPosition);
      const heightDiff = Math.abs(v.position.y - v.targetPosition.y);
      if (dist2D < 0.5 && heightDiff < 1.5) {
        v.targetPosition = null;
      } else {
        this.moveEntitySmoothly(v, v.targetPosition, v.speed * 0.15);
      }
    }
  }

  // Search nearest block type
  private findNearestBlock(pos: Position3D, block: BlockType, mustBeEmptyAbove: boolean = false): Position3D | null {
    let closest: Position3D | null = null;
    let minDist = 99999;

    for (let x = 0; x < WORLD_SIZE.width; x++) {
      for (let z = 0; z < WORLD_SIZE.depth; z++) {
        for (let y = 0; y < WORLD_SIZE.height; y++) {
          if (this.grid[getIndex(x, y, z)] === block) {
            if (mustBeEmptyAbove && y + 1 < WORLD_SIZE.height && this.grid[getIndex(x, y + 1, z)] !== BlockType.AIR) {
              continue;
            }
            const d = this.dist3D(pos, { x, y, z });
            if (d < minDist) {
              minDist = d;
              closest = { x, y, z };
            }
          }
        }
      }
    }
    return closest;
  }

  // --- Observational Devine Interactions (Player tool actions) ---
  public placeBlock(x: number, y: number, z: number, type: BlockType): boolean {
    if (!inBounds(x, y, z)) return false;
    this.grid[getIndex(x, y, z)] = type;
    this.addLog(`Divine observer placed ${BlockType[type]} at coordinates [${x}, ${y}, ${z}].`, 'action');
    return true;
  }

  public breakBlock(x: number, y: number, z: number): boolean {
    if (!inBounds(x, y, z)) return false;
    const oldType = this.grid[getIndex(x, y, z)];
    this.grid[getIndex(x, y, z)] = BlockType.AIR;
    this.addLog(`Divine observer crushed ${BlockType[oldType] || 'block'} at coordinates [${x}, ${y}, ${z}].`, 'action');
    return true;
  }

  public strikeLightningAt(x: number, z: number) {
    const y = this.getSurfaceHeight(x, z) - 1;
    this.stats.lightningStrikes++;
    this.addLog(`⚡ Divine Lightning struck coordinates [${x}, ${z}] by user request!`, 'threat');
    if (inBounds(x, y, z)) {
      this.grid[getIndex(x, y, z)] = BlockType.COAL; // Blast into coal
    }
  }

  public triggerSpawnPest() {
    const rX = Math.floor(Math.random() * WORLD_SIZE.width);
    const rZ = Math.floor(Math.random() * WORLD_SIZE.depth);
    const newPest: Pest = {
      id: `pest-${Date.now()}-${Math.floor(Math.random()*2000)}`,
      position: { x: rX, y: this.getSurfaceHeight(rX, rZ), z: rZ },
      targetPosition: null,
      state: 'wandering',
      speed: 1.15,
      rotation: Math.random() * Math.PI,
      eatTimer: 0
    };
    this.pests.push(newPest);
    this.addLog(`🐇 Spawned pest rabbit. Guards notified!`, 'threat');
  }

  // --- Clock formatting helpers ---
  public isDaylight(): boolean {
    const hour = this.inGameTime / 60;
    return hour >= 6.0 && hour < 20.0;
  }

  public getFormattedTime(): string {
    const hour24 = Math.floor(this.inGameTime / 60);
    const minVal = Math.floor(this.inGameTime % 60);
    const minStr = minVal < 10 ? `0${minVal}` : `${minVal}`;
    const period = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return `${hour12}:${minStr} ${period}`;
  }

  public getSkyColor(): string {
    const hour = this.inGameTime / 60;
    // Dynamic skies
    if (this.weather === Weather.THUNDERSTORM) return '#20202F'; // Dark grim skies
    if (hour >= 20.0 || hour < 5.0) return '#050515';           // Midnight star navy
    if (hour >= 5.0 && hour < 7.0) return '#C87860';            // Warm pink sunrise sunset
    if (hour >= 18.0 && hour < 20.0) return '#D3754E';          // Reddish sunset glow
    if (this.weather === Weather.RAINY) return '#4A5060';       // Rainy grey clouds
    if (this.weather === Weather.SNOWY) return '#6C7A89';       // Snowy mist silver grey
    return '#4090E0';                                           // Rich sunny summer blue
  }

  // Log adding
  public addLog(text: string, type: 'info' | 'weather' | 'action' | 'threat') {
    const formatted = this.getFormattedTime();
    this.logs.unshift({
      id: `${Date.now()}-${Math.floor(Math.random()*10000)}`,
      time: formatted,
      text,
      type
    });
    // Truncate logs to avoid overflowing
    if (this.logs.length > 50) this.logs.pop();
  }

  // Vectors standard mathematics
  private dist3D(a: Position3D, b: Position3D): number {
    return Math.sqrt((a.x - b.x)**2 + (a.y - b.y)**2 + (a.z - b.z)**2);
  }

  private dist2D(a: Position3D, b: Position3D): number {
    return Math.sqrt((a.x - b.x)**2 + (a.z - b.z)**2);
  }
}
