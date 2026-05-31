/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { BlockType, Position3D, Villager, Weather, Pest, Profession, VillagerState } from '../types';
import { SimulationEngine, getIndex, inBounds, WORLD_SIZE } from '../simulation';

interface VoxelCanvasProps {
  engine: SimulationEngine;
  tickCounter: number;
  selectedVillagerId: string | null;
  editorMode: 'view' | 'place' | 'break' | 'lightning' | 'spawn';
  editorBlockType: BlockType;
  onBlockPlacedOrBroken?: () => void;
  hoveredBlockPos: Position3D | null;
  setHoveredBlockPos: (pos: Position3D | null) => void;
  runSpeed: number;
}

// Materials definition helper matching block types
const BLOCK_COLORS: Record<number, string> = {
  [BlockType.GRASS]: '#55a630',
  [BlockType.DIRT]: '#8d6e63',
  [BlockType.STONE]: '#9e9e9e',
  [BlockType.WOOD]: '#5d4037',
  [BlockType.LEAVES]: '#388e3c',
  [BlockType.BRICK]: '#b23b1e',
  [BlockType.SAND]: '#ffee58',
  [BlockType.WATER]: '#1e88e5',
  [BlockType.GLASS]: '#b2ebf2',
  [BlockType.TILLED_SOIL]: '#4e342e',
  [BlockType.WHEAT_1]: '#9ccc65',
  [BlockType.WHEAT_2]: '#d4e157',
  [BlockType.WHEAT_3]: '#ffca28',
  [BlockType.MILL_GRINDER]: '#546e7a',
  [BlockType.BED]: '#e53935',
  [BlockType.GOLD_BLOCK]: '#ffb300',
  [BlockType.COAL]: '#263238',
};

export const VoxelCanvas: React.FC<VoxelCanvasProps> = ({
  engine,
  tickCounter,
  selectedVillagerId,
  editorMode,
  editorBlockType,
  onBlockPlacedOrBroken,
  hoveredBlockPos,
  setHoveredBlockPos,
  runSpeed,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SimulationEngine>(engine);
  const contextRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    instancedMeshes: Map<BlockType, THREE.InstancedMesh>;
    villagerMeshes: Map<string, THREE.Group>;
    pestMeshes: Map<string, THREE.Group>;
    rainParticles: THREE.Points | null;
    snowParticles: THREE.Points | null;
    orbitalTarget: THREE.Vector3;
    cameraOrbit: { theta: number; phi: number; radius: number };
    selectionBox: THREE.Mesh;
    ambientLight: THREE.AmbientLight;
    directionalLight: THREE.DirectionalLight;
    windmillSails: THREE.Group | null;
  } | null>(null);

  const dragStateRef = useRef<{ isDragging: boolean; startX: number; startY: number } | null>(null);

  // Sync latest engine ref
  useEffect(() => {
    engineRef.current = engine;
  }, [engine]);

  // Handle building scene
  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#4090E0');

    // Fog for Minecraft distance vibes
    scene.fog = new THREE.FogExp2('#4090E0', 0.02);

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );

    // Dynamic initial camera location looking at core village center (12, 2, 12)
    const orbitalTarget = new THREE.Vector3(12, 2, 12);
    const cameraOrbit = {
      theta: Math.PI / 4, // Horizontal rotation
      phi: Math.PI / 3,   // Vertical angle
      radius: 35          // Camera distance
    };

    const updateCameraPos = () => {
      const x = orbitalTarget.x + cameraOrbit.radius * Math.sin(cameraOrbit.phi) * Math.sin(cameraOrbit.theta);
      const y = orbitalTarget.y + cameraOrbit.radius * Math.cos(cameraOrbit.phi);
      const z = orbitalTarget.z + cameraOrbit.radius * Math.sin(cameraOrbit.phi) * Math.cos(cameraOrbit.theta);
      camera.position.set(x, y, z);
      camera.lookAt(orbitalTarget);
    };
    updateCameraPos();

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight('#ffffff', 0.8);
    directionalLight.position.set(20, 40, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.bias = -0.0005;
    scene.add(directionalLight);

    // Subtle helper ground grid borders
    const gridHelper = new THREE.GridHelper(24, 24, '#1b5e20', '#33691e');
    gridHelper.position.set(12, 1.95, 12);
    scene.add(gridHelper);

    // 5. Instanced Meshes maps init
    const instancedMeshes = new Map<BlockType, THREE.InstancedMesh>();
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

    // Generate InstancedMesh for each blockType
    Object.keys(BLOCK_COLORS).forEach((key) => {
      const type = parseInt(key) as BlockType;
      const colorStr = BLOCK_COLORS[type];

      // Material customization (translucent for fluid water/sheer glass)
      let material: THREE.Material;
      if (type === BlockType.WATER) {
        material = new THREE.MeshLambertMaterial({
          color: new THREE.Color(colorStr),
          transparent: true,
          opacity: 0.65,
        });
      } else if (type === BlockType.GLASS) {
        material = new THREE.MeshLambertMaterial({
          color: new THREE.Color(colorStr),
          transparent: true,
          opacity: 0.45,
        });
      } else if (type === BlockType.LEAVES) {
        material = new THREE.MeshLambertMaterial({
          color: new THREE.Color(colorStr),
          transparent: true,
          opacity: 0.9,
        });
      } else {
        material = new THREE.MeshLambertMaterial({
          color: new THREE.Color(colorStr),
        });
      }

      // Maximum possible of each block are allocated
      const maxInstances = WORLD_SIZE.width * WORLD_SIZE.height * WORLD_SIZE.depth;
      const instMesh = new THREE.InstancedMesh(boxGeometry, material, maxInstances);
      instMesh.castShadow = true;
      instMesh.receiveShadow = true;
      instMesh.count = 0; // Starts empty, populated dynamically during ticks
      scene.add(instMesh);
      instancedMeshes.set(type, instMesh);
    });

    // 6. Rain / Snow visual particle effects
    // Rain Particles
    const rainCount = 600;
    const rainGeometry = new THREE.BufferGeometry();
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount * 3; i += 3) {
      rainPos[i] = Math.random() * 30 - 3;
      rainPos[i + 1] = Math.random() * 20;
      rainPos[i + 2] = Math.random() * 30 - 3;
    }
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0x70c0ff,
      size: 0.15,
      transparent: true,
      opacity: 0.7,
    });
    const rainParticles = new THREE.Points(rainGeometry, rainMat);
    scene.add(rainParticles);

    // Snow Particles
    const snowCount = 400;
    const snowGeometry = new THREE.BufferGeometry();
    const snowPos = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount * 3; i += 3) {
      snowPos[i] = Math.random() * 30 - 3;
      snowPos[i + 1] = Math.random() * 20;
      snowPos[i + 2] = Math.random() * 30 - 3;
    }
    snowGeometry.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    const snowMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.25,
      transparent: true,
      opacity: 0.8,
    });
    const snowParticles = new THREE.Points(snowGeometry, snowMat);
    scene.add(snowParticles);

    // 7. Windmill sails (custom spinning axes geometric shapes)
    // Windmill tower at center X=18, Z=5. Height level is Y=6.5
    const windmillSails = new THREE.Group();
    windmillSails.position.set(18, 6.75, 7.3); // Mounted on face of windmill (Z index increased)
    
    // Core hub center
    const hubGeom = new THREE.BoxGeometry(0.5, 0.5, 0.3);
    const hubMat = new THREE.MeshLambertMaterial({ color: 0x5d4037 });
    const hub = new THREE.Mesh(hubGeom, hubMat);
    windmillSails.add(hub);

    // 4 Sails
    for (let i = 0; i < 4; i++) {
      const sailGroup = new THREE.Group();
      // Outer angle offset
      sailGroup.rotation.z = (Math.PI / 2) * i;

      // Sail rod
      const rodGeom = new THREE.BoxGeometry(0.12, 3.2, 0.12);
      const rodMat = new THREE.MeshLambertMaterial({ color: 0x3e2723 });
      const rod = new THREE.Mesh(rodGeom, rodMat);
      rod.position.y = 1.6;
      sailGroup.add(rod);

      // Sail broad canvas
      const canvasGeom = new THREE.BoxGeometry(0.8, 1.8, 0.05);
      const canvasMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
      const canvas = new THREE.Mesh(canvasGeom, canvasMat);
      canvas.position.set(0.4, 2.0, 0);
      sailGroup.add(canvas);

      windmillSails.add(sailGroup);
    }
    scene.add(windmillSails);

    // 8. Custom block selection overlay for building mode
    const selectGeom = new THREE.BoxGeometry(1.02, 1.02, 1.02);
    const selectMat = new THREE.MeshBasicMaterial({
      color: 0xffeb3b,
      wireframe: true,
      transparent: true,
      opacity: 0.8,
    });
    const selectionBox = new THREE.Mesh(selectGeom, selectMat);
    selectionBox.visible = false;
    scene.add(selectionBox);

    // Store references
    const villagerMeshes = new Map<string, THREE.Group>();
    const pestMeshes = new Map<string, THREE.Group>();

    contextRef.current = {
      scene,
      camera,
      renderer,
      instancedMeshes,
      villagerMeshes,
      pestMeshes,
      rainParticles,
      snowParticles,
      orbitalTarget,
      cameraOrbit,
      selectionBox,
      ambientLight,
      directionalLight,
      windmillSails,
    };

    // Build the grid blocks initially
    rebuildVoxelGrid();

    // 9. Dynamic Animation Tick Loop
    let animationId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Retrieve context
      const ctx = contextRef.current;
      if (!ctx) return;

      const currentEngine = engineRef.current;

      // Dynamic Weather Light Colors and Fog shifting
      const skyCol = new THREE.Color(currentEngine.getSkyColor());
      ctx.scene.background = skyCol;
      if (ctx.scene.fog && ctx.scene.fog instanceof THREE.FogExp2) {
        ctx.scene.fog.color = skyCol;
      }

      // Check celestial lighting intensities based on day/night hours
      const hour = currentEngine.inGameTime / 60;
      let lightIntensity = 0.8;
      let ambientColor = new THREE.Color('#90caf9'); // Moonlight hue

      if (hour >= 6.0 && hour < 18.0) {
        // High bright daylight
        lightIntensity = currentEngine.weather === Weather.THUNDERSTORM ? 0.35 : (currentEngine.weather === Weather.RAINY ? 0.5 : 1.0);
        ctx.directionalLight.color.setHex(0xffffff);
        ctx.ambientLight.color.setHex(0xffffff);
      } else if (hour >= 18.0 && hour < 20.0) {
        // Reddish dusk sunset
        const sunsetRatio = (20.0 - hour) / 2.0; // 1 down to 0
        lightIntensity = 0.3 + 0.4 * sunsetRatio;
        ctx.directionalLight.color.setRGB(1.0, 0.4 * sunsetRatio + 0.2, 0.2);
        ctx.ambientLight.color.setRGB(0.8, 0.3, 0.2);
      } else if (hour >= 5.0 && hour < 7.0) {
        // Sunrise peach
        const sunriseRatio = (hour - 5.0) / 2.0; // 0 up to 1
        lightIntensity = 0.2 + 0.5 * sunriseRatio;
        ctx.directionalLight.color.setRGB(1.0, 0.5, 0.4);
      } else {
        // Night dark slate
        lightIntensity = 0.15;
        ctx.directionalLight.color.copy(ambientColor);
        ctx.ambientLight.color.setHex(0x1a237e); // Royal deep dark blue
      }

      ctx.directionalLight.intensity = lightIntensity;

      // Windmill sail spin rate depending on storm gusts
      if (ctx.windmillSails) {
        let spinSpeed = 0.5; // Sunny
        if (currentEngine.weather === Weather.RAINY) spinSpeed = 0.9;
        if (currentEngine.weather === Weather.THUNDERSTORM) spinSpeed = 1.6;
        if (currentEngine.weather === Weather.SNOWY) spinSpeed = 0.2;
        ctx.windmillSails.rotation.z += spinSpeed * runSpeed * delta;
      }

      // Spectator Camera target snapping on Selected Villager
      if (selectedVillagerId) {
        const selectedVillager = currentEngine.villagers.find(v => v.id === selectedVillagerId);
        if (selectedVillager) {
          // Slide target point smoothly to keep eyes on villager
          const vPos = selectedVillager.position;
          ctx.orbitalTarget.x = THREE.MathUtils.lerp(ctx.orbitalTarget.x, vPos.x, 0.1);
          ctx.orbitalTarget.y = THREE.MathUtils.lerp(ctx.orbitalTarget.y, vPos.y + 1, 0.1);
          ctx.orbitalTarget.z = THREE.MathUtils.lerp(ctx.orbitalTarget.z, vPos.z, 0.1);
          updateCameraPos();
        }
      }

      // Weather Particles gravity fall logic
      if (ctx.rainParticles) {
        const isRainy = currentEngine.weather === Weather.RAINY || currentEngine.weather === Weather.THUNDERSTORM;
        ctx.rainParticles.visible = isRainy;
        if (isRainy) {
          const positions = ctx.rainParticles.geometry.attributes.position.array as Float32Array;
          const speed = currentEngine.weather === Weather.THUNDERSTORM ? 30.0 : 18.0;
          for (let i = 1; i < positions.length; i += 3) {
            positions[i] -= speed * delta; // Fall down
            if (positions[i] < 0) {
              positions[i] = 20; // reset to clouds height
            }
          }
          ctx.rainParticles.geometry.attributes.position.needsUpdate = true;
        }
      }

      if (ctx.snowParticles) {
        const isSnowy = currentEngine.weather === Weather.SNOWY;
        ctx.snowParticles.visible = isSnowy;
        if (isSnowy) {
          const positions = ctx.snowParticles.geometry.attributes.position.array as Float32Array;
          for (let i = 0; i < positions.length; i += 3) {
            // Sway left & right as it falls
            positions[i] += Math.sin(elapsed + i) * 1.5 * delta;
            positions[i + 1] -= 2.5 * delta; // slow fall
            if (positions[i + 1] < 0) {
              positions[i + 1] = 20;
            }
          }
          ctx.snowParticles.geometry.attributes.position.needsUpdate = true;
        }
      }

      // Render Villagers dynamic models bobbing and rotations
      syncVillagersIn3D(delta, elapsed);

      // Render Crop Pests
      syncPestsIn3D(delta, elapsed);

      // Final frame render
      ctx.renderer.render(ctx.scene, ctx.camera);
    };
    animate();

    // Window resizing handler
    const handleResize = () => {
      if (!containerRef.current || !contextRef.current) return;
      const { camera, renderer } = contextRef.current;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [selectedVillagerId]);

  // Update voxel grids on ticks changes and updates
  useEffect(() => {
    rebuildVoxelGrid();
  }, [tickCounter]);

  // Re-populate voxel instanced mesh cells
  const rebuildVoxelGrid = () => {
    const ctx = contextRef.current;
    if (!ctx) return;

    const currentEngine = engineRef.current;

    // Zero out all instance counts before loading updated frame
    ctx.instancedMeshes.forEach(mesh => {
      mesh.count = 0;
    });

    const dummy = new THREE.Object3D();

    for (let x = 0; x < WORLD_SIZE.width; x++) {
      for (let z = 0; z < WORLD_SIZE.depth; z++) {
        for (let y = 0; y < WORLD_SIZE.height; y++) {
          const type = currentEngine.grid[getIndex(x, y, z)];
          if (type !== BlockType.AIR) {
            const mesh = ctx.instancedMeshes.get(type);
            if (mesh) {
              dummy.position.set(x, y, z);
              dummy.updateMatrix();
              mesh.setMatrixAt(mesh.count, dummy.matrix);
              mesh.count++;
            }
          }
        }
      }
    }

    // Flag instanced matrix arrays for webGL rendering refreshes
    ctx.instancedMeshes.forEach(mesh => {
      mesh.instanceMatrix.needsUpdate = true;
    });
  };

  // Render & Bob Cute Blocky Villagers
  const syncVillagersIn3D = (delta: number, elapsed: number) => {
    const ctx = contextRef.current;
    if (!ctx) return;

    const currentEngine = engineRef.current;

    // Detect missing ones to remove from scene
    ctx.villagerMeshes.forEach((mesh, id) => {
      if (!currentEngine.villagers.some(v => v.id === id)) {
        ctx.scene.remove(mesh);
        ctx.villagerMeshes.delete(id);
      }
    });

    // Draw / Move models
    currentEngine.villagers.forEach(v => {
      let group = ctx.villagerMeshes.get(v.id);

      if (!group) {
        // Create standard Steve-like box compound mesh
        group = new THREE.Group();

        // 1. Head
        const headGeom = new THREE.BoxGeometry(0.6, 0.6, 0.5);
        const headMat = new THREE.MeshLambertMaterial({ color: 0xffd1a4 });
        const head = new THREE.Mesh(headGeom, headMat);
        head.position.y = 1.3;
        head.name = 'head';
        group.add(head);

        // Profession custom head accessories (Hats)
        if (v.profession === Profession.FARMER) {
          // Straw hat brim
          const brimGeom = new THREE.BoxGeometry(1.0, 0.08, 0.9);
          const strawMat = new THREE.MeshLambertMaterial({ color: 0xddc590 });
          const brim = new THREE.Mesh(brimGeom, strawMat);
          brim.position.y = 1.55;
          group.add(brim);

          const capGeom = new THREE.BoxGeometry(0.55, 0.25, 0.5);
          const cap = new THREE.Mesh(capGeom, strawMat);
          cap.position.y = 1.7;
          group.add(cap);
        } else if (v.profession === Profession.GUARD) {
          // Iron steel helmet
          const helmetGeom = new THREE.BoxGeometry(0.65, 0.4, 0.55);
          const steelMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
          const helm = new THREE.Mesh(helmetGeom, steelMat);
          helm.position.y = 1.45;
          group.add(helm);

          // Dark nose protection visor
          const plumeGeom = new THREE.BoxGeometry(0.1, 0.3, 0.58);
          const blueMat = new THREE.MeshLambertMaterial({ color: 0x1565c0 });
          const plume = new THREE.Mesh(plumeGeom, blueMat);
          plume.position.set(0, 1.6, -0.1);
          group.add(plume);
        } else if (v.profession === Profession.BUILDER) {
          // Construction orange hardhat
          const hatGeom = new THREE.BoxGeometry(0.7, 0.25, 0.62);
          const builderMat = new THREE.MeshLambertMaterial({ color: 0xffa726 });
          const hat = new THREE.Mesh(hatGeom, builderMat);
          hat.position.y = 1.55;
          group.add(hat);
        }

        // 2. Body
        const bodyGeom = new THREE.BoxGeometry(0.7, 0.8, 0.4);
        let shirtColor = 0x4caf50; // default green
        if (v.profession === Profession.MILLER) shirtColor = 0xffeb3b; // yellow Apron miller
        if (v.profession === Profession.GUARD) shirtColor = 0x1a237e; // Guard metal shirt
        if (v.profession === Profession.BUILDER) shirtColor = 0xd84315; // Builder vest copper

        const bodyMat = new THREE.MeshLambertMaterial({ color: shirtColor });
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        body.position.y = 0.6;
        body.castShadow = true;
        group.add(body);

        // 3. Legs
        const legGeom = new THREE.BoxGeometry(0.24, 0.5, 0.24);
        const legMat = new THREE.MeshLambertMaterial({ color: 0x3e2723 }); // Brown pants

        const leftLeg = new THREE.Mesh(legGeom, legMat);
        leftLeg.position.set(-0.18, 0.15, 0);
        leftLeg.name = 'lLeg';
        group.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeom, legMat);
        rightLeg.position.set(0.18, 0.15, 0);
        rightLeg.name = 'rLeg';
        group.add(rightLeg);

        // 4. Arms
        const armGeom = new THREE.BoxGeometry(0.2, 0.6, 0.2);
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xffd1a4 });
        
        const leftArm = new THREE.Mesh(armGeom, skinMat);
        leftArm.position.set(-0.42, 0.7, 0);
        leftArm.name = 'lArm';
        group.add(leftArm);

        const rightArm = new THREE.Mesh(armGeom, skinMat);
        rightArm.position.set(0.42, 0.7, 0);
        rightArm.name = 'rArm';
        group.add(rightArm);

        // Weapon/item helper (Guards get iron blades, builders get clay bricks!)
        if (v.profession === Profession.GUARD) {
          const bladeGeom = new THREE.BoxGeometry(0.08, 0.85, 0.15);
          const ironMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
          const blade = new THREE.Mesh(bladeGeom, ironMat);
          blade.position.set(0.48, 0.45, 0.2);
          blade.rotation.x = Math.PI / 4;
          blade.name = 'weapon';
          group.add(blade);
        } else if (v.profession === Profession.BUILDER) {
          // Carry brick
          const brickGeom = new THREE.BoxGeometry(0.35, 0.15, 0.2);
          const clayMat = new THREE.MeshLambertMaterial({ color: 0xb23b1e });
          const carryBrick = new THREE.Mesh(brickGeom, clayMat);
          carryBrick.position.set(0, 0.6, 0.35);
          carryBrick.name = 'brickItem';
          group.add(carryBrick);
        }

        ctx.scene.add(group);
        ctx.villagerMeshes.set(v.id, group);
      }

      // Safeguard for dynamic state handling - initialize basePosition
      if (!group.userData.basePosition) {
        group.userData.basePosition = new THREE.Vector3(v.position.x, v.position.y - 0.4, v.position.z);
      }

      const lerpFactor = Math.min(1, (runSpeed === 0 ? 0 : runSpeed === 1 ? 2.5 : runSpeed === 2 ? 5.0 : 10.0) * delta);
      
      // Interpolate position/rotation smoothly to remove discrete jumps (choppiness)
      if (v.state === VillagerState.SLEEPING) {
        // Snap to sleeping position inside mattress directly so they lie instantly
        group.userData.basePosition.set(v.position.x, v.position.y - 0.2, v.position.z);
        group.position.copy(group.userData.basePosition);
        group.rotation.x = Math.PI / 2;
        group.rotation.y = v.rotation;
      } else {
        group.rotation.x = 0;
        
        // Lerp base position for smooth translation without accumulation
        group.userData.basePosition.x = THREE.MathUtils.lerp(group.userData.basePosition.x, v.position.x, lerpFactor);
        group.userData.basePosition.y = THREE.MathUtils.lerp(group.userData.basePosition.y, v.position.y - 0.4, lerpFactor);
        group.userData.basePosition.z = THREE.MathUtils.lerp(group.userData.basePosition.z, v.position.z, lerpFactor);
        
        // Always reset mesh position back to the unpolluted lerped base position
        group.position.copy(group.userData.basePosition);
        
        // Lerp rotation smoothly
        let diff = v.rotation - group.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        group.rotation.y += diff * lerpFactor;
      }

      // Update Builder carried item visibility depending on state
      const brickHeld = group.getObjectByName('brickItem');
      if (brickHeld) {
        brickHeld.visible = v.inventory.bricks > 0;
      }

      // Moving Leg / Arm swing animation as they run
      const leftLeg = group.getObjectByName('lLeg');
      const rightLeg = group.getObjectByName('rLeg');
      const leftArm = group.getObjectByName('lArm');
      const rightArm = group.getObjectByName('rArm');

      const isWalking = v.path.length > 0 || (v.targetPosition !== null && v.state !== VillagerState.SLEEPING);

      if (isWalking && leftLeg && rightLeg && leftArm && rightArm) {
        // Scale frequency and amplitude proportionally
        const swingSpeed = runSpeed === 1 ? 5.5 : runSpeed === 2 ? 8.0 : 12.0;
        const swingMaxAngle = runSpeed === 1 ? 0.35 : runSpeed === 2 ? 0.45 : 0.55;
        const swing = Math.sin(elapsed * swingSpeed) * swingMaxAngle;
        leftLeg.rotation.x = swing;
        rightLeg.rotation.x = -swing;
        leftArm.rotation.x = -swing;
        rightArm.rotation.x = swing;

        // Bob up and down slightly (gentle, realistic vertical oscillation)
        const bobAmt = runSpeed === 1 ? 0.03 : runSpeed === 2 ? 0.05 : 0.08;
        group.position.y += Math.abs(Math.sin(elapsed * swingSpeed)) * bobAmt;
      } else if (leftLeg && rightLeg && leftArm && rightArm) {
        // Return limbs to resting position (0) smoothly when transition to idle
        const returnLerp = Math.min(1, 10 * delta);
        leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0, returnLerp);
        rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0, returnLerp);
        leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, 0, returnLerp);
        rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, 0, returnLerp);

        // Small breathing float sway
        group.position.y += Math.sin(elapsed * 2) * 0.02;
      }
    });
  };

  // Render crop pest rabbits hopping blocky shapes
  const syncPestsIn3D = (delta: number, elapsed: number) => {
    const ctx = contextRef.current;
    if (!ctx) return;

    const currentEngine = engineRef.current;

    // Remove deleted ones
    ctx.pestMeshes.forEach((mesh, id) => {
      if (!currentEngine.pests.some(p => p.id === id)) {
        ctx.scene.remove(mesh);
        ctx.pestMeshes.delete(id);
      }
    });

    // Render Rabbits
    currentEngine.pests.forEach(pest => {
      let group = ctx.pestMeshes.get(pest.id);

      if (!group) {
        group = new THREE.Group();

        // Chubby body
        const bodyGeom = new THREE.BoxGeometry(0.4, 0.35, 0.5);
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }); // Fluffy white bunny
        const body = new THREE.Mesh(bodyGeom, skinMat);
        body.position.y = 0.2;
        body.castShadow = true;
        group.add(body);

        // Long ears
        const earGeom = new THREE.BoxGeometry(0.1, 0.35, 0.08);
        const pinkMat = new THREE.MeshLambertMaterial({ color: 0xff80ab }); // Pink ears center
        
        const earLeft = new THREE.Mesh(earGeom, skinMat);
        earLeft.position.set(-0.1, 0.45, 0.1);
        group.add(earLeft);

        const earRight = new THREE.Mesh(earGeom, skinMat);
        earRight.position.set(0.1, 0.45, 0.1);
        group.add(earRight);

        // Pink nose
        const noseGeom = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        const nose = new THREE.Mesh(noseGeom, pinkMat);
        nose.position.set(0, 0.25, 0.27);
        group.add(nose);

        ctx.scene.add(group);
        ctx.pestMeshes.set(pest.id, group);
      }

      // Initialize basePosition in userData to prevent accumulate floating
      if (!group.userData.basePosition) {
        group.userData.basePosition = new THREE.Vector3(pest.position.x, pest.position.y - 0.52, pest.position.z);
      }

      const lerpFactor = Math.min(1, (runSpeed === 0 ? 0 : runSpeed === 1 ? 2.5 : runSpeed === 2 ? 5.0 : 10.0) * delta);
      
      // Smooth coordinate movement with lerping
      group.userData.basePosition.x = THREE.MathUtils.lerp(group.userData.basePosition.x, pest.position.x, lerpFactor);
      group.userData.basePosition.y = THREE.MathUtils.lerp(group.userData.basePosition.y, pest.position.y - 0.52, lerpFactor);
      group.userData.basePosition.z = THREE.MathUtils.lerp(group.userData.basePosition.z, pest.position.z, lerpFactor);

      // Copy unpolluted base position
      group.position.copy(group.userData.basePosition);

      // Lerp rotation smoothly
      let diff = pest.rotation - group.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      group.rotation.y += diff * lerpFactor;

      // Hop animation standard bounce on top of copied base position
      const baseHopFrequency = pest.state === 'eating_crop' ? 3.0 : 7.0;
      const hopFrequency = baseHopFrequency * (runSpeed === 0 ? 0 : runSpeed === 1 ? 1.0 : runSpeed === 2 ? 1.5 : 2.2);
      const hopHeight = pest.state === 'eating_crop' ? 0.04 : 0.18;
      group.position.y += Math.abs(Math.sin(elapsed * hopFrequency)) * hopHeight;
    });
  };

  // --- Observation Divine Click Raycasting to edit blocks ---
  const handleSceneClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const ctx = contextRef.current;
    if (!ctx) return;

    // Skip drag rotations
    if (dragStateRef.current && dragStateRef.current.isDragging) return;

    // Calculate normalized device coordinates
    const rect = ctx.renderer.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), ctx.camera);

    // Collect all active mesh instances
    const activeMeshes: THREE.Object3D[] = [];
    ctx.instancedMeshes.forEach(mesh => {
      if (mesh.count > 0) activeMeshes.push(mesh);
    });

    const intersects = raycaster.intersectObjects(activeMeshes, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const instMesh = hit.object as THREE.InstancedMesh;
      const instanceId = hit.instanceId;

      if (instanceId !== undefined) {
        // Retrieve hit coordinates using matrix
        const matrix = new THREE.Matrix4();
        instMesh.getMatrixAt(instanceId, matrix);
        const position = new THREE.Vector3();
        position.setFromMatrixPosition(matrix);

        const hX = Math.round(position.x);
        const hY = Math.round(position.y);
        const hZ = Math.round(position.z);

        // Perform tool editor commands
        const currentEngine = engineRef.current;

        if (editorMode === 'break') {
          // Don't break bedrock stone
          if (currentEngine.grid[getIndex(hX, hY, hZ)] !== BlockType.STONE || hY > 0) {
            currentEngine.breakBlock(hX, hY, hZ);
            onBlockPlacedOrBroken?.();
            rebuildVoxelGrid();
          }
        } else if (editorMode === 'place') {
          // Calculate click face normal to place neighbor block
          const normal = hit.face?.normal;
          if (normal) {
            const pX = Math.round(position.x + normal.x);
            const pY = Math.round(position.y + normal.y);
            const pZ = Math.round(position.z + normal.z);

            if (inBounds(pX, pY, pZ)) {
              currentEngine.placeBlock(pX, pY, pZ, editorBlockType);
              onBlockPlacedOrBroken?.();
              rebuildVoxelGrid();
            }
          }
        } else if (editorMode === 'lightning') {
          currentEngine.strikeLightningAt(hX, hZ);
          onBlockPlacedOrBroken?.();
        } else if (editorMode === 'spawn') {
          const pX = hX;
          const pZ = hZ;
          const pY = currentEngine.getSurfaceHeight(pX, pZ);
          const newPest: Pest = {
            id: `pest-${Date.now()}-${Math.floor(Math.random()*2500)}`,
            position: { x: pX, y: pY, z: pZ },
            targetPosition: null,
            state: 'wandering',
            speed: 1.1,
            rotation: Math.random() * Math.PI,
            eatTimer: 0
          };
          currentEngine.pests.push(newPest);
          currentEngine.addLog(`Divine observer summoned a crop pest rabbit!`, 'action');
          onBlockPlacedOrBroken?.();
        }
      }
    }
  };

  // Tracking mouse movement for hover guides
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const ctx = contextRef.current;
    if (!ctx) return;

    if (editorMode === 'view') {
      ctx.selectionBox.visible = false;
      setHoveredBlockPos(null);
      return;
    }

    const rect = ctx.renderer.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), ctx.camera);

    const activeMeshes: THREE.Object3D[] = [];
    ctx.instancedMeshes.forEach(mesh => {
      if (mesh.count > 0) activeMeshes.push(mesh);
    });

    const intersects = raycaster.intersectObjects(activeMeshes, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const instMesh = hit.object as THREE.InstancedMesh;
      const instanceId = hit.instanceId;

      if (instanceId !== undefined) {
        const matrix = new THREE.Matrix4();
        instMesh.getMatrixAt(instanceId, matrix);
        const position = new THREE.Vector3();
        position.setFromMatrixPosition(matrix);

        const hX = Math.round(position.x);
        const hY = Math.round(position.y);
        const hZ = Math.round(position.z);

        if (editorMode === 'place') {
          // Outline placed neighbors
          const normal = hit.face?.normal;
          if (normal) {
            const pX = Math.round(position.x + normal.x);
            const pY = Math.round(position.y + normal.y);
            const pZ = Math.round(position.z + normal.z);
            
            ctx.selectionBox.position.set(pX, pY, pZ);
            ctx.selectionBox.visible = true;
            setHoveredBlockPos({ x: pX, y: pY, z: pZ });
          }
        } else {
          // Highlight hover block
          ctx.selectionBox.position.set(hX, hY, hZ);
          ctx.selectionBox.visible = true;
          setHoveredBlockPos({ x: hX, y: hY, z: hZ });
        }
      }
    } else {
      ctx.selectionBox.visible = false;
      setHoveredBlockPos(null);
    }
  };

  // --- Custom flying observer camera drag controls ---
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    dragStateRef.current = {
      isDragging: false,
      startX: e.clientX,
      startY: e.clientY
    };
  };

  const handleGlobalMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    const deltaX = e.clientX - drag.startX;
    const deltaY = e.clientY - drag.startY;

    // Threshold check: drag if we already started dragging or exceeded 5px threshold
    const isDrag = drag.isDragging || Math.sqrt(deltaX * deltaX + deltaY * deltaY) > 5;
    
    if (isDrag) {
      dragStateRef.current = {
        isDragging: true,
        startX: e.clientX,
        startY: e.clientY
      };

      const ctx = contextRef.current;
      if (!ctx) return;

      // Adjust angles corresponding to motion (using a slightly reduced constant for butter smooth motion)
      ctx.cameraOrbit.theta -= deltaX * 0.005;
      ctx.cameraOrbit.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.01, ctx.cameraOrbit.phi - deltaY * 0.005));

      const x = ctx.orbitalTarget.x + ctx.cameraOrbit.radius * Math.sin(ctx.cameraOrbit.phi) * Math.sin(ctx.cameraOrbit.theta);
      const y = ctx.orbitalTarget.y + ctx.cameraOrbit.radius * Math.cos(ctx.cameraOrbit.phi);
      const z = ctx.orbitalTarget.z + ctx.cameraOrbit.radius * Math.sin(ctx.cameraOrbit.phi) * Math.cos(ctx.cameraOrbit.theta);
      ctx.camera.position.set(x, y, z);
      ctx.camera.lookAt(ctx.orbitalTarget);
    }
  };

  const handleMouseUp = () => {
    if (dragStateRef.current && dragStateRef.current.isDragging) {
      // Invalidate starting coordinates but keep briefly so click event doesn't register as a block action
      const drag = dragStateRef.current;
      drag.startX = -9999;
      setTimeout(() => {
        if (dragStateRef.current === drag) {
          dragStateRef.current = null;
        }
      }, 50);
    } else {
      dragStateRef.current = null;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const ctx = contextRef.current;
    if (!ctx) return;

    // Zoom speed
    ctx.cameraOrbit.radius = Math.max(10, Math.min(90, ctx.cameraOrbit.radius + e.deltaY * 0.03));

    const x = ctx.orbitalTarget.x + ctx.cameraOrbit.radius * Math.sin(ctx.cameraOrbit.phi) * Math.sin(ctx.cameraOrbit.theta);
    const y = ctx.orbitalTarget.y + ctx.cameraOrbit.radius * Math.cos(ctx.cameraOrbit.phi);
    const z = ctx.orbitalTarget.z + ctx.cameraOrbit.radius * Math.sin(ctx.cameraOrbit.phi) * Math.cos(ctx.cameraOrbit.theta);
    ctx.camera.position.set(x, y, z);
    ctx.camera.lookAt(ctx.orbitalTarget);
  };

  // Keyboard observer WASD panning target
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const ctx = contextRef.current;
    if (!ctx) return;

    const panSpeed = 1.0;
    const forward = new THREE.Vector3();
    ctx.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, ctx.camera.up).normalize();

    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
      ctx.orbitalTarget.addScaledVector(forward, panSpeed);
    }
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
      ctx.orbitalTarget.addScaledVector(forward, -panSpeed);
    }
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
      ctx.orbitalTarget.addScaledVector(right, -panSpeed);
    }
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
      ctx.orbitalTarget.addScaledVector(right, panSpeed);
    }
    if (e.key === 'q' || e.key === 'Q') {
      ctx.orbitalTarget.y = Math.min(15, ctx.orbitalTarget.y + panSpeed);
    }
    if (e.key === 'e' || e.key === 'E') {
      ctx.orbitalTarget.y = Math.max(1, ctx.orbitalTarget.y - panSpeed);
    }

    const x = ctx.orbitalTarget.x + ctx.cameraOrbit.radius * Math.sin(ctx.cameraOrbit.phi) * Math.sin(ctx.cameraOrbit.theta);
    const y = ctx.orbitalTarget.y + ctx.cameraOrbit.radius * Math.cos(ctx.cameraOrbit.phi);
    const z = ctx.orbitalTarget.z + ctx.cameraOrbit.radius * Math.sin(ctx.cameraOrbit.phi) * Math.cos(ctx.cameraOrbit.theta);
    ctx.camera.position.set(x, y, z);
    ctx.camera.lookAt(ctx.orbitalTarget);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full cursor-grab active:cursor-grabbing overflow-hidden outline-none"
      onClick={handleSceneClick}
      onMouseDown={handleMouseDown}
      onMouseMove={(e) => {
        handleMouseMove(e);
        handleGlobalMouseMove(e);
      }}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      title="Drag to orbit. WASD to fly pan. Scroll to zoom. Use tools on voxels."
    />
  );
};
