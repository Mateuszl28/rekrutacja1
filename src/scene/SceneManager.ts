import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Zarządza rendererem, sceną, kamerą, światłem i pętlą renderowania.
 * Udostępnia płynne przełączanie między widokiem perspektywicznym a „z góry” (2D).
 */
export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;

  private container: HTMLElement;
  private updaters: Array<(dt: number) => void> = [];
  private clock = new THREE.Clock();

  constructor(container: HTMLElement) {
    this.container = container;

    this.scene.background = new THREE.Color(0xdfe3e8);
    this.scene.fog = new THREE.Fog(0xdfe3e8, 18, 40);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.camera.position.set(6, 5.5, 7);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2.05; // nie pozwól zejść pod podłogę
    this.controls.minDistance = 2;
    this.controls.maxDistance = 22;
    this.controls.target.set(0, 0.8, 0);

    this.setupLights();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => this.tick());
  }

  private setupLights(): void {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8d8d94, 1.1);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(8, 12, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 40;
    const s = 12;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-6, 5, -4);
    this.scene.add(fill);
  }

  onUpdate(fn: (dt: number) => void): void {
    this.updaters.push(fn);
  }

  private tick(): void {
    const dt = this.clock.getDelta();
    this.controls.update();
    for (const u of this.updaters) u(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Animowane przejście kamery do zadanej pozycji/celu. */
  private animateCamera(pos: THREE.Vector3, target: THREE.Vector3): void {
    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const duration = 0.6;
    let t = 0;
    const step = (dt: number) => {
      t = Math.min(1, t + dt / duration);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
      this.camera.position.lerpVectors(startPos, pos, e);
      this.controls.target.lerpVectors(startTarget, target, e);
      if (t >= 1) this.updaters = this.updaters.filter((u) => u !== step);
    };
    this.updaters.push(step);
  }

  setTopView(): void {
    this.animateCamera(new THREE.Vector3(0, 14, 0.01), new THREE.Vector3(0, 0, 0));
  }

  setPerspectiveView(): void {
    this.animateCamera(new THREE.Vector3(6, 5.5, 7), new THREE.Vector3(0, 0.8, 0));
  }

  /** Renderuje bieżącą klatkę i zwraca ją jako data URL (PNG). */
  captureScreenshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
}
