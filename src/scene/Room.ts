import * as THREE from 'three';
import type { RoomKind } from '../types';

interface RoomPreset {
  width: number;
  depth: number;
  wallHeight: number;
  floorColor: number;
  wallColor: number;
  floorRough: number;
}

const PRESETS: Record<RoomKind, RoomPreset> = {
  living: { width: 6, depth: 5, wallHeight: 2.7, floorColor: 0xb8926a, wallColor: 0xe7ded3, floorRough: 0.8 },
  kitchen: { width: 5, depth: 4.2, wallHeight: 2.7, floorColor: 0xd8d8dc, wallColor: 0xeef1f4, floorRough: 0.5 },
};

export const ROOM_LIMITS = { minW: 3, maxW: 9, minD: 3, maxD: 8 };

/**
 * Parametryczny pokój: podłoga + trzy ściany (przednia otwarta na kamerę) + siatka.
 * Wymiary, kolor ścian i materiał podłogi można zmieniać w locie.
 */
export class Room {
  readonly group = new THREE.Group();
  kind: RoomKind = 'living';
  width = PRESETS.living.width;
  depth = PRESETS.living.depth;
  wallColor = PRESETS.living.wallColor;

  private preset: RoomPreset = PRESETS.living;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    this.build();
  }

  get bounds() {
    return {
      minX: -this.width / 2,
      maxX: this.width / 2,
      minZ: -this.depth / 2,
      maxZ: this.depth / 2,
    };
  }

  get floorPlane(): THREE.Plane {
    return new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  setKind(kind: RoomKind): void {
    this.kind = kind;
    this.preset = PRESETS[kind];
    this.width = this.preset.width;
    this.depth = this.preset.depth;
    this.wallColor = this.preset.wallColor;
    this.build();
  }

  setSize(width: number, depth: number): void {
    this.width = THREE.MathUtils.clamp(width, ROOM_LIMITS.minW, ROOM_LIMITS.maxW);
    this.depth = THREE.MathUtils.clamp(depth, ROOM_LIMITS.minD, ROOM_LIMITS.maxD);
    this.build();
  }

  setWallColor(color: number): void {
    this.wallColor = color;
    this.build();
  }

  private build(): void {
    this.group.clear();
    const { wallHeight, floorColor, floorRough } = this.preset;
    const { width, depth, wallColor } = this;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({ color: floorColor, roughness: floorRough, metalness: 0.05 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = 'floor';
    this.group.add(floor);

    const grid = new THREE.GridHelper(Math.max(width, depth), Math.round(Math.max(width, depth) * 2), 0x9aa0a6, 0xbfc4ca);
    grid.position.y = 0.002;
    (grid.material as THREE.Material).opacity = 0.35;
    (grid.material as THREE.Material).transparent = true;
    this.group.add(grid);

    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.95, side: THREE.DoubleSide });
    const t = 0.1;

    const back = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, t), wallMat);
    back.position.set(0, wallHeight / 2, -depth / 2);
    back.receiveShadow = true;
    this.group.add(back);

    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(t, wallHeight, depth), wallMat);
      side.position.set(sx * (width / 2), wallHeight / 2, 0);
      side.receiveShadow = true;
      this.group.add(side);
    }

    const skirtMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
    const skBack = new THREE.Mesh(new THREE.BoxGeometry(width, 0.1, 0.02), skirtMat);
    skBack.position.set(0, 0.05, -depth / 2 + t / 2 + 0.01);
    this.group.add(skBack);
  }
}
