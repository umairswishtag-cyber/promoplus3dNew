import { type CSSProperties, useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  ArrowRight, Play, Zap, CheckSquare, FileCheck, Package,
  Search, Lightbulb, CheckCircle2, FileText, Printer, Moon, Sun,
} from "lucide-react";

// ─── Palette ─────────────────────────────────────────────────────────────────

const PALETTE = [
  { accent: "#818cf8", glow: "rgba(129,140,248,0.22)", border: "rgba(129,140,248,0.35)", bg: "rgba(79,70,229,0.09)" },
  { accent: "#38bdf8", glow: "rgba(56,189,248,0.22)", border: "rgba(56,189,248,0.35)", bg: "rgba(14,165,233,0.09)" },
  { accent: "#c084fc", glow: "rgba(192,132,252,0.22)", border: "rgba(192,132,252,0.35)", bg: "rgba(124,58,237,0.09)" },
  { accent: "#34d399", glow: "rgba(52,211,153,0.22)", border: "rgba(52,211,153,0.35)", bg: "rgba(16,185,129,0.09)" },
  { accent: "#fbbf24", glow: "rgba(251,191,36,0.22)", border: "rgba(251,191,36,0.35)", bg: "rgba(217,119,6,0.09)" },
  { accent: "#f472b6", glow: "rgba(244,114,182,0.22)", border: "rgba(244,114,182,0.35)", bg: "rgba(219,39,119,0.09)" },
  { accent: "#22d3ee", glow: "rgba(34,211,238,0.22)", border: "rgba(34,211,238,0.35)", bg: "rgba(6,182,212,0.09)" },
];

// ─── 3D card entry / exit — each step uses a different 3D rotation axis ──────

const CARD_ENTRY = [
  { rotateX: 88, scale: 0.65, opacity: 0 },              // 01 flip up from bottom
  { rotateY: -92, scale: 0.65, opacity: 0 },             // 02 flip from left
  { rotateY: 92, scale: 0.65, opacity: 0 },              // 03 flip from right
  { rotateX: -88, scale: 0.65, opacity: 0 },             // 04 flip from top
  { rotateX: 60, rotateY: 60, scale: 0.55, opacity: 0 }, // 05 diagonal
  { rotateZ: -88, scale: 0.65, opacity: 0 },             // 06 spin CCW
  { rotateY: -92, rotateX: 40, scale: 0.55, opacity: 0 },// 07 diagonal left
];

const CARD_EXIT = [
  { rotateX: -88, scale: 0.55, opacity: 0, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } },
  { rotateY: 92, scale: 0.55, opacity: 0, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } },
  { rotateY: -92, scale: 0.55, opacity: 0, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } },
  { rotateX: 88, scale: 0.55, opacity: 0, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } },
  { rotateX: -60, rotateY: -60, scale: 0.45, opacity: 0, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } },
  { rotateZ: 88, scale: 0.55, opacity: 0, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } },
  { rotateY: 92, rotateX: -40, scale: 0.45, opacity: 0, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } },
];

const SPRING = {
  type: "spring" as const,
  stiffness: 340,
  damping: 28,
  mass: 0.85,
  opacity: { duration: 0.12, ease: "easeOut" },
};

// ─── Step data ────────────────────────────────────────────────────────────────

const STEPS = [
  { step: "01", label: "Idea", heading: "Start with an Idea", text: "Start with a customer idea, product requirement, logo, or campaign brief." },
  { step: "02", label: "Product Selection", heading: "Select the Right Product", text: "Search supplier catalogs and select the right product instantly." },
  { step: "03", label: "Design Creation", heading: "Create the Perfect Design", text: "Upload logo, position artwork, resize, rotate, and preview the design." },
  { step: "04", label: "Design Approval", heading: "Collect Clear Approvals", text: "Share mockups with customers and collect clear approvals online." },
  // { step: "05", label: "HD PDF File", heading: "Generate Production Files", text: "Generate a high-quality production-ready PDF file with approved artwork." },
  { step: "05", label: "Printing & Production", heading: "Send to Production", text: "Send the approved file to decorators or production teams with confidence." },
  { step: "06", label: "Final Product", heading: "Deliver Branded Products", text: "Deliver finished branded products that match the approved design." },
];

const WORKFLOW_AMBIENT_LIGHT_INTENSITIES = [
  2, // Step 01: Idea
  1.65, // Step 02: Product Selection
  2.068, // Step 03: Design Creation
  2.068, // Step 04: Design Approval
  2.068, // Step 05: Printing & Production
  10.068, // Step 06: Final Product
];

const WORKFLOW_MAX_FLAT_AMBIENT_LIGHT = 0.82;
const WHITE_MATERIAL_CHANNEL_LIMIT = 0.94;

const BADGES = [
  { Icon: Zap, label: "Faster mockups" },
  { Icon: CheckSquare, label: "Clear approvals" },
  { Icon: FileCheck, label: "Production-ready files" },
  { Icon: Package, label: "Fewer printing mistakes" },
];

const WORKFLOW_DESKTOP_SECTION_HEIGHT_VH = STEPS.length * 100;
const WORKFLOW_SNAP_DURATION_MS = 1350;
const THEME_STORAGE_KEY = "promoplus-theme";
const WORKFLOW_GLB_MAX_BYTES = 16 * 1024 * 1024;

type ThemeMode = "dark" | "light";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function easeInOutCubic(value: number) {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - clamp01(value), 3);
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function getStepFromScroll(scrollStep: number) {
  return Math.round(clamp(scrollStep, 0, STEPS.length - 1));
}

function getWorkflowCopyStationStyle(relative: number): CSSProperties {
  const focus = 1 - clamp(Math.abs(relative), 0, 1);
  const emphasis = easeOutCubic(focus);

  return {
    opacity: lerp(0.62, 1, emphasis),
    filter: `brightness(${lerp(0.78, 1, emphasis)}) saturate(${lerp(0.82, 1.08, emphasis)})`,
  };
}

function getWorkflowCardStation(stepIndex: number) {
  return {
    x: stepIndex % 2 === 0 ? 83 : 21,
    y: ((stepIndex + 0.5) / STEPS.length) * 100,
  };
}

function getTravelingWorkflowCardStyle(scrollStep: number, accent: string): CSSProperties {
  const currentStep = Math.floor(clamp(scrollStep, 0, STEPS.length - 1));
  const nextStep = Math.min(currentStep + 1, STEPS.length - 1);
  const localProgress = easeInOutCubic(scrollStep - currentStep);
  const from = getWorkflowCardStation(currentStep);
  const to = getWorkflowCardStation(nextStep);
  const x = lerp(from.x, to.x, localProgress);
  const y = lerp(from.y, to.y, localProgress);
  const direction = to.x >= from.x ? 1 : -1;
  const travelTilt = direction * Math.sin(localProgress * Math.PI) * 4.5;
  const scale = lerp(0.88, 0.93, 1 - Math.sin(localProgress * Math.PI) * 0.5);

  return {
    left: `${x}%`,
    top: `${y}%`,
    transform: `translate(-50%, -50%) rotateZ(${travelTilt}deg) scale(${scale})`,
    transformOrigin: "50% 50%",
    transformStyle: "preserve-3d",
    willChange: "left, top, transform",
    filter: `drop-shadow(0 34px 90px ${accent}36)`,
    zIndex: 90,
  };
}

function getMobileWorkflowCardStation(stepIndex: number) {
  return {
    x: 50,
    y: ((stepIndex + 0.74) / STEPS.length) * 100,
  };
}

function getTravelingMobileWorkflowCardStyle(scrollStep: number, accent: string): CSSProperties {
  const currentStep = Math.floor(clamp(scrollStep, 0, STEPS.length - 1));
  const nextStep = Math.min(currentStep + 1, STEPS.length - 1);
  const localProgress = easeInOutCubic(scrollStep - currentStep);
  const from = getMobileWorkflowCardStation(currentStep);
  const to = getMobileWorkflowCardStation(nextStep);
  const y = lerp(from.y, to.y, localProgress);
  const travelTilt = Math.sin(localProgress * Math.PI) * (currentStep % 2 === 0 ? -3 : 3);

  return {
    left: `${from.x}%`,
    top: `${y}%`,
    transform: `translate(-50%, -50%) rotateZ(${travelTilt}deg) scale(0.62)`,
    transformOrigin: "50% 50%",
    transformStyle: "preserve-3d",
    willChange: "top, transform",
    filter: `drop-shadow(0 28px 70px ${accent}34)`,
    zIndex: 70,
  };
}

// ─── Three.js floating background scene ──────────────────────────────────────

const gradientTextStyle = (from: string, to = "#a855f7"): CSSProperties => ({
  backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
  color: "transparent",
  display: "inline-block",
  lineHeight: 1.05,
  textShadow: "0 18px 45px rgba(129,140,248,0.24)",
});

function createProductMaterial(color: THREE.Color, opacity: number, wireframe = false) {
  return wireframe
    ? new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
      })
    : new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity,
        emissive: color,
        emissiveIntensity: 0.42,
        roughness: 0.34,
        metalness: 0.48,
        side: THREE.DoubleSide,
      });
}

function createTShirtGeometry() {
  const shirt = new THREE.Shape();
  shirt.moveTo(-0.52, 0.82);
  shirt.lineTo(-0.26, 0.58);
  shirt.lineTo(0.26, 0.58);
  shirt.lineTo(0.52, 0.82);
  shirt.lineTo(1.15, 0.52);
  shirt.lineTo(0.88, -0.05);
  shirt.lineTo(0.64, 0.05);
  shirt.lineTo(0.64, -0.92);
  shirt.lineTo(-0.64, -0.92);
  shirt.lineTo(-0.64, 0.05);
  shirt.lineTo(-0.88, -0.05);
  shirt.lineTo(-1.15, 0.52);
  shirt.closePath();

  const neck = new THREE.Path();
  neck.absarc(0, 0.75, 0.23, 0, Math.PI, true);
  shirt.holes.push(neck);

  const geometry = new THREE.ExtrudeGeometry(shirt, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 2,
  });
  geometry.center();
  return geometry;
}

function createShirtObject(color: THREE.Color, opacity: number, wireframe = false) {
  return new THREE.Mesh(createTShirtGeometry(), createProductMaterial(color, opacity, wireframe));
}

function createMugObject(color: THREE.Color, opacity: number, wireframe = false) {
  const group = new THREE.Group();
  const mat = createProductMaterial(color, opacity, wireframe);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.58, 1.05, 36, 1, true), mat);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.045, 10, 36), mat);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.055, 10, 28), mat);

  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.53;
  handle.scale.x = 0.62;
  handle.scale.y = 1.1;
  handle.position.x = 0.56;

  group.add(body, rim, handle);
  return group;
}

function createLogoObject(color: THREE.Color, opacity: number, wireframe = false) {
  const group = new THREE.Group();
  const mat = createProductMaterial(color, opacity, wireframe);
  const plaque = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.13, 48), mat);
  plaque.rotation.x = Math.PI / 2;

  const parts = [
    [-0.24, 0, 0.1, 0.68],
    [-0.09, 0.23, 0.34, 0.1],
    [-0.09, 0.05, 0.28, 0.1],
    [0.22, 0, 0.1, 0.68],
    [0.37, 0.23, 0.34, 0.1],
    [0.37, 0.05, 0.28, 0.1],
  ] as const;

  group.add(plaque);
  parts.forEach(([x, y, w, h]) => {
    const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), mat);
    part.position.set(x, y, 0.1);
    group.add(part);
  });

  return group;
}

function disposeObject3D(object: THREE.Object3D) {
  object.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach(m => m.dispose());
    else material?.dispose();
  });
}

function createStageMat(color: THREE.Color, opacity = 0.9, roughness = 0.32) {
  void roughness;
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
  });
}

function createBoxMesh(size: [number, number, number], color: THREE.Color, opacity = 0.9, radius = 0) {
  const geometry = new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(geometry, createStageMat(color, opacity));
  if (radius > 0) mesh.scale.setScalar(radius);
  return mesh;
}

function createCheckObject(color: THREE.Color) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.55, -0.05);
  shape.lineTo(-0.25, -0.36);
  shape.lineTo(0.58, 0.38);
  shape.lineTo(0.45, 0.52);
  shape.lineTo(-0.25, -0.1);
  shape.lineTo(-0.42, 0.08);
  shape.closePath();

  const mesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }),
    createStageMat(color, 0.95, 0.25)
  );
  mesh.geometry.center();
  return mesh;
}

function createToteObject(color: THREE.Color, opacity = 0.82) {
  const group = new THREE.Group();
  const mat = createStageMat(color, opacity);
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.05, 0.18), mat);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 28, Math.PI), mat);
  handle.position.y = 0.55;
  handle.rotation.z = Math.PI;
  group.add(bag, handle);
  return group;
}

function createPdfObject(color: THREE.Color) {
  const group = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.8, 0.08), createStageMat(new THREE.Color("#f8fafc"), 0.9, 0.5));
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.09), createStageMat(new THREE.Color("#ef4444"), 0.95, 0.35));
  badge.position.set(-0.36, 0.42, 0.08);
  group.add(paper, badge);

  for (let i = 0; i < 5; i++) {
    const row = new THREE.Mesh(new THREE.BoxGeometry(0.72 - i * 0.04, 0.035, 0.095), createStageMat(color, 0.75, 0.45));
    row.position.set(0.2, 0.28 - i * 0.18, 0.09);
    group.add(row);
  }
  return group;
}

function createPrinterObject(color: THREE.Color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.62, 0.85), createStageMat(color, 0.86));
  const slot = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.08, 0.9), createStageMat(new THREE.Color("#020617"), 0.92));
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.4, 28), createStageMat(color, 0.78));
  const output = new THREE.Mesh(createTShirtGeometry(), createStageMat(color, 0.68));
  slot.position.y = 0.11;
  slot.position.z = 0.44;
  roller.rotation.z = Math.PI / 2;
  roller.position.set(0, -0.26, 0.42);
  output.scale.set(0.55, 0.55, 0.55);
  output.position.set(0, -0.72, 0.2);
  output.rotation.x = -0.95;
  group.add(body, slot, roller, output);
  return group;
}

function createShippingBoxObject(color: THREE.Color) {
  const group = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.82, 1), createStageMat(new THREE.Color("#9a6a2f"), 0.72, 0.55));
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.08, 1.08), createStageMat(color, 0.62));
  lid.position.y = 0.48;
  lid.rotation.z = -0.1;
  group.add(box, lid);
  return group;
}

function createStageShirtObject(color: THREE.Color) {
  const group = new THREE.Group();
  const mat = createStageMat(color, 1, 0.38);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.02, 0.18), mat);
  const leftSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.18), mat);
  const rightSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.18), mat);
  const logo = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.04), createStageMat(new THREE.Color("#f8fafc"), 0.96, 0.45));
  leftSleeve.position.set(-0.51, 0.24, 0);
  rightSleeve.position.set(0.51, 0.24, 0);
  leftSleeve.rotation.z = -0.38;
  rightSleeve.rotation.z = 0.38;
  logo.position.set(0, 0.12, 0.12);
  group.add(body, leftSleeve, rightSleeve, logo);
  return group;
}

function createStageMugObject(color: THREE.Color) {
  const group = new THREE.Group();
  const mat = createStageMat(color, 1, 0.34);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.92, 40), mat);
  const top = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 10, 40), mat);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 10, 32), mat);
  top.rotation.x = Math.PI / 2;
  top.position.y = 0.47;
  handle.scale.x = 0.58;
  handle.position.set(0.48, 0.02, 0);
  group.add(body, top, handle);
  return group;
}

function createStageLogoObject(color: THREE.Color) {
  const group = new THREE.Group();
  const mat = createStageMat(color, 1, 0.28);
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.18, 56), mat);
  const markA = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.52, 0.05), createStageMat(new THREE.Color("#f8fafc"), 0.92, 0.42));
  const markB = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.05), createStageMat(new THREE.Color("#f8fafc"), 0.92, 0.42));
  coin.rotation.x = Math.PI / 2;
  markA.position.set(-0.08, 0, 0.13);
  markB.position.set(0.12, 0.18, 0.13);
  group.add(coin, markA, markB);
  return group;
}

function createWorkflowModel(step: number, accent: string) {
  const color = new THREE.Color(accent);
  const group = new THREE.Group();
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(1.75, 1.9, 0.12, 64),
    createStageMat(color, 0.18, 0.5)
  );
  platform.position.y = -1.05;
  platform.rotation.y = 0.2;
  group.add(platform);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.018, 8, 90), createProductMaterial(color, 0.45, true));
  ring.position.y = -0.96;
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  if (step === 0) {
    const shirt = createStageShirtObject(color);
    const logo = createStageLogoObject(color);
    const mug = createStageMugObject(color);
    shirt.position.set(-1.35, 0.02, 0);
    shirt.rotation.set(0.18, -0.45, -0.12);
    shirt.scale.setScalar(0.72);
    logo.position.set(0, 0.16, 0.15);
    logo.scale.setScalar(0.78);
    mug.position.set(1.35, 0.02, 0);
    mug.rotation.set(0.18, 0.55, -0.1);
    mug.scale.setScalar(0.74);
    group.add(shirt, logo, mug);
  } else if (step === 1) {
    [createStageShirtObject(color), createStageMugObject(color), createToteObject(color, 0.95), createStageLogoObject(color)].forEach((item, index) => {
      const angle = (index / 4) * Math.PI * 2 + 0.35;
      item.position.set(Math.cos(angle) * 1.1, index % 2 ? -0.08 : 0.22, Math.sin(angle) * 0.36);
      item.rotation.set(0.18, -angle + Math.PI / 2, index % 2 ? 0.08 : -0.08);
      item.scale.setScalar(index === 1 ? 0.62 : 0.56);
      group.add(item);
    });
  } else if (step === 2) {
    const shirt = createStageShirtObject(color);
    const logo = createLogoObject(new THREE.Color("#ffffff"), 0.82);
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.76, 0.6, 0.18)),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75 })
    );
    shirt.scale.setScalar(1);
    shirt.rotation.set(0.14, -0.32, 0.04);
    logo.position.set(0, -0.03, 0.18);
    logo.scale.setScalar(0.32);
    frame.position.set(0, -0.03, 0.22);
    group.add(shirt, logo, frame);
  } else if (step === 3) {
    const doc = createPdfObject(color);
    const check = createCheckObject(new THREE.Color("#34d399"));
    doc.position.x = -0.28;
    doc.rotation.set(-0.12, -0.35, 0.08);
    check.position.set(0.75, 0.15, 0.2);
    check.scale.setScalar(0.78);
    check.rotation.set(0.1, -0.1, -0.08);
    group.add(doc, check);
  } else if (step === 4) {
    const pdf = createPdfObject(color);
    pdf.scale.setScalar(1.08);
    pdf.rotation.set(-0.18, -0.35, 0.04);
    group.add(pdf);
  } else if (step === 5) {
    const printer = createPrinterObject(color);
    printer.rotation.set(0.08, -0.34, 0.02);
    printer.scale.setScalar(0.9);
    group.add(printer);
  } else {
    const box = createShippingBoxObject(color);
    const shirt = createStageShirtObject(color);
    const mug = createStageMugObject(color);
    box.position.set(0, -0.18, 0);
    box.rotation.set(0.05, -0.45, 0.04);
    shirt.position.set(-0.88, 0.34, 0.14);
    shirt.scale.setScalar(0.52);
    shirt.rotation.set(0.18, -0.2, -0.12);
    mug.position.set(0.92, 0.12, 0.12);
    mug.scale.setScalar(0.52);
    mug.rotation.set(0.12, 0.4, 0.08);
    group.add(box, shirt, mug);
  }

  return group;
}

type WorkflowGlbItem = {
  url: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  sizeBytes?: number;
};

const WORKFLOW_GLB_GROUPS: WorkflowGlbItem[][] = [
  [
    { url: "/assets/glb/shortsleevetshirt.optimized.glb", position: [0, 0.04, 0.04], rotation: [0.08, -0.34, -0.06], scale: 1, sizeBytes: 8527316 }, // Update your New GLB file 1: Idea
  ],
  [
    { url: "/assets/glb/shortsleevetshirt.optimized.glb", position: [-1.22, 0.04, 0.04], rotation: [0, -5.04, 0], scale: 1.20, sizeBytes: 8527316 }, // Update your New GLB file 2A: Product Selection
    { url: "/assets/glb/nescafe_coffee_cups_coffee.glb", position: [0.74, -0.02, 0.12], rotation: [0, 0.48, 0.03], scale: 0.58 }, // Update your New GLB file 2B: Product Selection
  ],
  [
    { url: "/assets/glb/computer_and_laptop.glb", position: [0.02, 0, 0.26], rotation: [0.08, 0.1, 0], scale: 1.68 }, // Update your New GLB file 3: Design Creation
  ],
  [
    { url: "/assets/glb/windows_explorer.glb", position: [0.02, 0, 0.26], rotation: [0, -3.5, 1], scale: 0.75  }, // Update your New GLB file 4: Design Approval
  ],
  [
    { url: "/assets/glb/exhibition_stand_012.glb", position: [0, 0.02, 0], rotation: [0, 0, 0], scale: 1.6 }, // Update your New GLB file 5B: Printing & Production
  ],
  [
    { url: "/assets/glb/white_t-shirt_with_print.glb", position: [0, -0.02, 0.12], rotation: [0.02, 0.48, 0.03], scale: 1.068 }, // Update your New GLB file 6B: Final Product
  ],
];

function getLoadableWorkflowGlbItems(step: number) {
  return (WORKFLOW_GLB_GROUPS[step] ?? []).filter(item => {
    const url = item.url.trim();
    if (!url) return false;
    return (item.sizeBytes ?? 0) <= WORKFLOW_GLB_MAX_BYTES;
  });
}

function getWorkflowFlatAmbientIntensity(step: number) {
  const requestedLight = WORKFLOW_AMBIENT_LIGHT_INTENSITIES[step] ?? 2;
  return Math.min(WORKFLOW_MAX_FLAT_AMBIENT_LIGHT, 0.38 + requestedLight * 0.16);
}

function tuneLoadedWorkflowMaterial(material: THREE.Material) {
  const mat = material as THREE.MeshStandardMaterial;

  if (mat.map) {
    mat.map.colorSpace = THREE.SRGBColorSpace;
    mat.map.anisotropy = 8;
    mat.map.needsUpdate = true;
  }

  if ("roughness" in mat && "metalness" in mat) {
    mat.roughness = Math.max(mat.roughness ?? 0.72, 0.68);
    mat.metalness = Math.min(mat.metalness ?? 0, 0.04);
    mat.envMapIntensity = Math.min(mat.envMapIntensity ?? 0.5, 0.55);
  }

  if ("emissiveIntensity" in mat) {
    mat.emissiveIntensity = 0;
  }

  if (mat.color) {
    const isWhiteSurface = mat.color.r > 0.86 && mat.color.g > 0.86 && mat.color.b > 0.86;
    if (isWhiteSurface) {
      mat.color.setRGB(
        Math.min(mat.color.r, WHITE_MATERIAL_CHANNEL_LIMIT),
        Math.min(mat.color.g, WHITE_MATERIAL_CHANNEL_LIMIT),
        Math.min(mat.color.b, WHITE_MATERIAL_CHANNEL_LIMIT)
      );
    }
  }

  mat.side = THREE.DoubleSide;
  mat.toneMapped = true;
  mat.needsUpdate = true;
}

function prepareLoadedWorkflowModel(object: THREE.Object3D, item: WorkflowGlbItem) {
  const wrapper = new THREE.Group();
  wrapper.add(object);

  object.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry && !mesh.geometry.getAttribute("normal")) {
      mesh.geometry.computeVertexNormals();
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (!mesh.material) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(material => {
      tuneLoadedWorkflowMaterial(material);
    });
  });

  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  object.position.sub(center);
  const maxSize = Math.max(size.x, size.y, size.z, 0.001);
  wrapper.scale.setScalar((2.35 / maxSize) * (item.scale ?? 1));
  wrapper.position.set(...(item.position ?? [0, -0.04, 0]));
  wrapper.rotation.set(...(item.rotation ?? [0.06, -0.16, 0]));

  return wrapper;
}

function WorkflowCanvasLoader({ accent, visible, progress }: { accent: string; visible: boolean; progress: number }) {
  const displayProgress = Math.round(clamp01(progress) * 100);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="workflow-canvas-loader"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className="absolute inset-0 z-[1200] flex items-center justify-center rounded-2xl"
          style={{
            background: `radial-gradient(circle at 50% 44%, ${accent}20, rgba(5,5,18,0.72) 58%, rgba(5,5,18,0.18))`,
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="relative flex flex-col items-center gap-3">
            <div
              className="absolute h-28 w-28 rounded-full blur-2xl"
              style={{ background: `${accent}32` }}
            />
            <div className="relative h-24 w-24">
              <div
                className="absolute inset-0 rounded-full animate-spin"
                style={{
                  animationDuration: "1.35s",
                  background: `conic-gradient(from 0deg, transparent 0deg, ${accent} 120deg, rgba(255,255,255,0.86) 168deg, transparent 250deg)`,
                  WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 7px))",
                  mask: "radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 7px))",
                }}
              />
              <div
                className="absolute inset-4 rounded-full"
                style={{
                  background: `radial-gradient(circle at 34% 25%, rgba(255,255,255,0.2), rgba(5,5,18,0.86))`,
                  border: `1px solid ${accent}4f`,
                  boxShadow: `inset 0 1px 12px rgba(255,255,255,0.12), 0 0 28px ${accent}40`,
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono text-xs font-black" style={{ color: accent }}>
                  {displayProgress}%
                </span>
              </div>
            </div>
            <div className="relative text-center">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: accent }}>
                Loading 3D Model
              </div>
              <div className="mt-1 h-1 w-36 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full"
                  animate={{ width: `${Math.max(8, displayProgress)}%` }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  style={{ background: `linear-gradient(90deg, ${accent}, #8b5cf6)` }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function WorkflowModelStage({ step, accent }: { step: number; accent: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const [modelLoadState, setModelLoadState] = useState({ isLoading: false, progress: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    let disposed = false;
    const updateLoadState = (isLoading: boolean, progress: number) => {
      if (!disposed) setModelLoadState({ isLoading, progress: clamp01(progress) });
    };

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      updateLoadState(false, 1);
      return;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.86;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.15, 4.35);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.rotateSpeed = 0.75;
    controls.zoomSpeed = 0.8;
    controls.minDistance = 2.5;
    controls.maxDistance = 7;
    controls.target.set(0, 0, 0);
    controls.update();

    let isUsingControls = false;
    const onControlsStart = () => {
      isUsingControls = true;
    };
    const onControlsEnd = () => {
      isUsingControls = false;
    };
    const stopCanvasWheelPropagation = (event: WheelEvent) => {
      event.stopPropagation();
    };
    controls.addEventListener("start", onControlsStart);
    controls.addEventListener("end", onControlsEnd);
    canvas.addEventListener("wheel", stopCanvasWheelPropagation, { passive: false });
    let contextLost = false;
    const onContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      updateLoadState(false, 1);
    };
    const onContextRestored = () => {
      contextLost = false;
      resize();
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    const glbItems = getLoadableWorkflowGlbItems(step);
    const shouldLoadGlbItems = glbItems.length > 0;
    updateLoadState(shouldLoadGlbItems, shouldLoadGlbItems ? 0 : 1);

    const modelRoot = new THREE.Group();
    const fallbackModel = shouldLoadGlbItems ? null : createWorkflowModel(step, accent);
    if (fallbackModel) {
      modelRoot.add(fallbackModel);
    }
    modelRoot.scale.setScalar(1.08);
    modelRoot.rotation.set(0.12, -0.42, 0);
    scene.add(modelRoot);

    if (shouldLoadGlbItems) {
      const loader = new GLTFLoader();
      const loadedGroup = new THREE.Group();
      const itemProgress = new Array(glbItems.length).fill(0);
      let completedLoads = 0;
      let successfulLoads = 0;
      let swappedToGlbGroup = false;

      const reportLoadProgress = () => {
        const progress = itemProgress.reduce((sum, itemValue) => sum + itemValue, 0) / glbItems.length;
        updateLoadState(true, Math.min(progress, 0.98));
      };

      const finishLoad = () => {
        completedLoads += 1;
        updateLoadState(completedLoads < glbItems.length, completedLoads / glbItems.length);
        if (completedLoads < glbItems.length || swappedToGlbGroup) return;
        swappedToGlbGroup = true;

        if (disposed) {
          disposeObject3D(loadedGroup);
          return;
        }

        modelRoot.clear();
        if (successfulLoads === 0) {
          disposeObject3D(loadedGroup);
          modelRoot.add(createWorkflowModel(step, accent));
          updateLoadState(false, 1);
          return;
        }

        if (fallbackModel) disposeObject3D(fallbackModel);
        modelRoot.add(loadedGroup);
        updateLoadState(false, 1);
      };

      glbItems.forEach((item, itemIndex) => {
        loader.load(
          item.url.trim(),
          gltf => {
            itemProgress[itemIndex] = 1;
            const loadedModel = prepareLoadedWorkflowModel(gltf.scene, item);
            if (disposed) {
              disposeObject3D(loadedModel);
              finishLoad();
              return;
            }
            loadedGroup.add(loadedModel);
            successfulLoads += 1;
            finishLoad();
          },
          event => {
            if (event.lengthComputable && event.total > 0) {
              itemProgress[itemIndex] = Math.max(itemProgress[itemIndex], Math.min(event.loaded / event.total, 0.98));
              reportLoadProgress();
            } else {
              itemProgress[itemIndex] = Math.max(itemProgress[itemIndex], 0.18);
              reportLoadProgress();
            }
          },
          () => {
            itemProgress[itemIndex] = 1;
            finishLoad();
          }
        );
      });
    }
    const requestedLight = WORKFLOW_AMBIENT_LIGHT_INTENSITIES[step] ?? 2;
    scene.add(new THREE.AmbientLight(0xffffff, getWorkflowFlatAmbientIntensity(step)));

    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x1a1028, 0.82);
    scene.add(hemisphereLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.35 + requestedLight * 0.18);
    keyLight.position.set(3.2, 4.2, 4.8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.00018;
    keyLight.shadow.normalBias = 0.035;
    const keyShadowCamera = keyLight.shadow.camera as THREE.OrthographicCamera;
    keyShadowCamera.left = -4;
    keyShadowCamera.right = 4;
    keyShadowCamera.top = 4;
    keyShadowCamera.bottom = -4;
    keyShadowCamera.near = 0.5;
    keyShadowCamera.far = 12;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.55);
    fillLight.position.set(-3.4, 1.8, 2.2);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(new THREE.Color(accent), 1.75, 12);
    rimLight.position.set(-2.2, 2.7, -2.8);
    scene.add(rimLight);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(parent);
    resizeObserver.observe(canvas);
    resize();

    const onPointerMove = (event: PointerEvent) => {
      const rect = parent.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    const onPointerLeave = () => {
      mouseRef.current.x = 0;
      mouseRef.current.y = 0;
    };
    parent.addEventListener("pointermove", onPointerMove);
    parent.addEventListener("pointerleave", onPointerLeave);

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (contextLost) return;
      const cssWidth = Math.max(1, canvas.clientWidth);
      const cssHeight = Math.max(1, canvas.clientHeight);
      const pixelRatio = renderer.getPixelRatio();
      if (canvas.width !== Math.floor(cssWidth * pixelRatio) || canvas.height !== Math.floor(cssHeight * pixelRatio)) {
        camera.aspect = cssWidth / cssHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(cssWidth, cssHeight, false);
      }
      if (!isUsingControls) {
        modelRoot.rotation.y += ((-0.42 + mouseRef.current.x * 0.26) - modelRoot.rotation.y) * 0.04;
        modelRoot.rotation.x += ((0.12 + mouseRef.current.y * 0.12) - modelRoot.rotation.x) * 0.04;
        modelRoot.rotation.z = Math.sin(performance.now() * 0.0008) * 0.025;
      }
      modelRoot.position.y = Math.sin(performance.now() * 0.001) * 0.035;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      canvas.removeEventListener("wheel", stopCanvasWheelPropagation);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      controls.removeEventListener("start", onControlsStart);
      controls.removeEventListener("end", onControlsEnd);
      controls.dispose();
      parent.removeEventListener("pointermove", onPointerMove);
      parent.removeEventListener("pointerleave", onPointerLeave);
      disposeObject3D(scene);
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, [accent, step]);

  return (
    <div data-workflow-model-stage className="relative h-[250px] w-full overflow-visible rounded-2xl z-[1000]">
      <div className="absolute inset-x-8 bottom-8 h-16 rounded-full blur-2xl" style={{ background: `${accent}24` }} />
      <WorkflowCanvasLoader accent={accent} visible={modelLoadState.isLoading} progress={modelLoadState.progress} />
      <canvas
        ref={canvasRef}
        data-workflow-model-canvas
        className="relative z-[1000] block h-full w-full cursor-grab active:cursor-grabbing"
        style={{ pointerEvents: "auto", touchAction: "none" }}
      />
    </div>
  );
}
interface ThreeState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  meshes: THREE.Object3D[];
  pointLight: THREE.PointLight;
  mouse: { x: number; y: number };
  animId: number;
}

function ThreeBackground({ accent }: { accent: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<ThreeState | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 9;

    const col = new THREE.Color(accent);

    const productConfigs = [
      { kind: "shirt", wireframe: false, opacity: 0.14, scale: 1.1 },
      { kind: "mug", wireframe: true, opacity: 0.13, scale: 1 },
      { kind: "logo", wireframe: false, opacity: 0.12, scale: 0.95 },
      { kind: "shirt", wireframe: true, opacity: 0.11, scale: 0.85 },
      { kind: "mug", wireframe: false, opacity: 0.09, scale: 0.85 },
      { kind: "logo", wireframe: true, opacity: 0.11, scale: 0.8 },
      { kind: "shirt", wireframe: true, opacity: 0.1, scale: 0.95 },
      { kind: "mug", wireframe: false, opacity: 0.08, scale: 0.75 },
    ] as const;

    const positions: [number, number, number][] = [
      [-5.5, 3.2, -2.5], [5.8, -2.4, -3.5], [-3.2, -4.5, -1.5], [6.5, 4.2, -4.5],
      [-6.2, 1.2, -3.5], [4.4, -4.8, -2.5], [-4.6, 4.8, -4.5], [2.8, 3.5, -5.5],
    ];

    const meshes: THREE.Object3D[] = productConfigs.map((config, i) => {
      const mesh =
        config.kind === "shirt"
          ? createShirtObject(col, config.opacity, config.wireframe)
          : config.kind === "mug"
            ? createMugObject(col, config.opacity, config.wireframe)
            : createLogoObject(col, config.opacity, config.wireframe);
      mesh.position.set(...positions[i]);
      mesh.scale.setScalar(config.scale);
      mesh.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
      scene.add(mesh);
      return mesh;
    });

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    const pointLight = new THREE.PointLight(col, 4, 18);
    pointLight.position.set(3, 3, 4);
    scene.add(pointLight);
    const pointLight2 = new THREE.PointLight(col, 2, 12);
    pointLight2.position.set(-4, -2, 3);
    scene.add(pointLight2);

    // Mouse
    const mouse = { x: 0, y: 0 };
    const onMouseMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouseMove);

    // Rotation speeds per object
    const speeds = meshes.map((_, i) => ({
      rx: 0.0015 + i * 0.0007,
      ry: 0.002 + i * 0.001,
      rz: 0.001 + i * 0.0004,
    }));

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      meshes.forEach((mesh, i) => {
        mesh.rotation.x += speeds[i].rx;
        mesh.rotation.y += speeds[i].ry;
        mesh.rotation.z += speeds[i].rz;
      });
      camera.position.x += (mouse.x * 0.6 - camera.position.x) * 0.025;
      camera.position.y += (mouse.y * 0.4 - camera.position.y) * 0.025;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    stateRef.current = { renderer, scene, camera, meshes, pointLight, mouse, animId };

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      meshes.forEach(disposeObject3D);
      renderer.dispose();
    };
  }, []);

  // Reactively update accent color
  useEffect(() => {
    if (!stateRef.current) return;
    const { meshes, pointLight } = stateRef.current;
    const col = new THREE.Color(accent);
    meshes.forEach(mesh => {
      mesh.traverse(child => {
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial | undefined;
        if (!mat) return;
        mat.color.set(col);
        if ("emissive" in mat) mat.emissive.set(col);
      });
    });
    pointLight.color.set(col);
  }, [accent]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 1, opacity: 0.3, }}
    />
  );
}

// ─── Step visuals ─────────────────────────────────────────────────────────────

function IdeaVisual({ active, accent }: { active: boolean; accent: string }) {
  return (
    <div className="flex flex-col items-center gap-5 py-2">
      <div className="relative h-36 w-full" style={{ perspective: "900px" }}>
        {active && (
          <>
            <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 animate-ping" style={{ background: accent, animationDuration: "2.5s" }} />
            <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 animate-ping" style={{ background: accent, animationDuration: "3.4s", animationDelay: "0.5s" }} />
          </>
        )}
        <div
          className="absolute left-[18%] top-8 h-20 w-20"
          style={{
            clipPath: "polygon(31% 0, 42% 14%, 58% 14%, 69% 0, 100% 19%, 86% 45%, 75% 38%, 75% 100%, 25% 100%, 25% 38%, 14% 45%, 0 19%)",
            background: `linear-gradient(145deg, ${accent}60, rgba(255,255,255,0.07) 50%, ${accent}26)`,
            border: `1px solid ${accent}70`,
            boxShadow: `0 24px 42px rgba(0,0,0,0.34), inset 0 1px 12px rgba(255,255,255,0.18)`,
            transform: "rotate(-9deg) skewY(-4deg) scale(1.02)",
          }}
        />
        <div
          className="absolute left-1/2 top-3 flex h-24 w-24 -translate-x-1/2 items-center justify-center rounded-full font-black text-white"
          style={{
            background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.28), ${accent}72 42%, rgba(5,5,18,0.9))`,
            border: `1px solid ${accent}75`,
            boxShadow: `0 24px 58px ${accent}2f, inset 0 2px 10px rgba(255,255,255,0.18), inset 0 -16px 28px rgba(0,0,0,0.45)`,
            transform: "translateY(-4px) scale(1.04)",
          }}
        >
          PP
        </div>
        <div
          className="absolute right-[18%] top-9 h-20 w-16 rounded-b-2xl rounded-t-lg"
          style={{
            background: `linear-gradient(145deg, ${accent}48, rgba(255,255,255,0.08) 44%, rgba(5,5,18,0.7))`,
            border: `1px solid ${accent}68`,
            boxShadow: `0 22px 46px rgba(0,0,0,0.36), inset 0 1px 10px rgba(255,255,255,0.16)`,
            transform: "rotate(8deg) skewY(3deg) scale(1.01)",
          }}
        >
          <div className="absolute -right-5 top-5 h-9 w-8 rounded-full border-2" style={{ borderColor: `${accent}70` }} />
          <div className="absolute left-2 right-2 top-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.18)" }} />
        </div>
        <div
          className="absolute bottom-0 left-1/2 h-8 w-52 -translate-x-1/2 rounded-full blur-xl"
          style={{ background: `${accent}24`, transform: "translateX(-50%) rotateX(70deg)" }}
        />
        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-200" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <Lightbulb className="h-3.5 w-3.5" style={{ color: accent }} />
          Idea
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 w-full">
        {["Logo rebrand", "Q4 campaign", "100 units", "Trade show", "New product", "Rush order"].map((note, i) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-xl px-2 py-2.5 text-center text-xs text-slate-400 leading-snug">{note}</div>
        ))}
      </div>
    </div>
  );
}

function ProductSelectionVisual({ active, accent }: { active: boolean; accent: string }) {
  const products = [
    { name: "Classic T-Shirt", sku: "SAN-5000", vendor: "SanMar" },
    { name: "Ceramic Mug 11oz", sku: "KOZ-MUG1", vendor: "Koozie Group" },
    { name: "Canvas Tote Bag", sku: "BAG-CT118", vendor: "Bag Pros" },
    { name: "Structured Cap", sku: "OTT-CAP3", vendor: "Otto Cap" },
  ];
  return (
    <div className="w-full space-y-2">
      <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
        <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <span className="text-sm text-slate-500">Search 50,000+ promotional products…</span>
      </div>
      {products.map((p, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl transition-all duration-500"
          style={{ background: i === 0 && active ? `${accent}14` : "rgba(255,255,255,0.03)", border: `1px solid ${i === 0 && active ? accent + "40" : "rgba(255,255,255,0.07)"}` }}>
          <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: `${accent}18` }}>
            <div className="w-5 h-5 rounded-sm" style={{ background: i === 0 && active ? accent : "#334155" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{p.name}</div>
            <div className="flex gap-2 mt-0.5 text-xs text-slate-500"><span className="font-mono">{p.sku}</span><span>·</span><span>{p.vendor}</span></div>
          </div>
          {i === 0 && active && <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: accent }} />}
        </div>
      ))}
    </div>
  );
}

function DesignCreationVisual({ active, accent }: { active: boolean; accent: string }) {
  return (
    <div className="flex justify-center py-2">
      <div className="relative">
        <div className="w-64 h-48 bg-[#08081e] border border-white/8 rounded-2xl flex items-center justify-center overflow-hidden relative">
          <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "12px 12px" }} />
          <svg viewBox="0 0 140 120" className="w-44 h-36 relative z-10 transition-all duration-700"
            style={{ filter: active ? `drop-shadow(0 0 22px ${accent}90)` : "none" }}>
            <defs>
              <linearGradient id="tg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#4f46e5" /><stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
            <path d="M35 20 L8 44 L28 52 L28 104 L112 104 L112 52 L132 44 L105 20 L88 32 C82 44 58 44 52 32 Z" fill="url(#tg)" stroke="rgba(129,140,248,0.5)" strokeWidth="1.5" />
            <rect x="53" y="56" width="34" height="32" rx="6" fill="rgba(255,255,255,0.93)" />
            <text x="70" y="76" textAnchor="middle" fontSize="11" fill="#4f46e5" fontWeight="bold" fontFamily="sans-serif">PP+</text>
            {active && (<>
              <rect x="49" y="52" width="7" height="7" rx="1.5" fill={accent} />
              <rect x="84" y="52" width="7" height="7" rx="1.5" fill={accent} />
              <rect x="49" y="82" width="7" height="7" rx="1.5" fill={accent} />
              <rect x="84" y="82" width="7" height="7" rx="1.5" fill={accent} />
            </>)}
          </svg>
        </div>
        <div className="absolute right-[-46px] top-1/2 -translate-y-1/2 flex flex-col gap-1.5">
          {["⟷", "↻", "⇌", "◐"].map((t, i) => (
            <div key={i} className="w-9 h-9 bg-[#08081e] border border-white/10 rounded-xl flex items-center justify-center text-xs text-slate-400">{t}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ApprovalVisual({ active, accent }: { active: boolean; accent: string }) {
  return (
    <div className="w-full space-y-3">
      <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">JD</div>
          <div>
            <div className="text-sm font-medium text-white">John D. — Acme Corp</div>
            <div className="text-xs text-slate-500">Revision request · 2h ago</div>
          </div>
        </div>
        <div className="text-sm text-slate-300 bg-yellow-500/8 border-l-2 border-yellow-500 rounded-r-xl pl-3 pr-3 py-2.5 leading-relaxed">
          "Move logo slightly higher, increase font size to 14pt."
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[{ n: "Sarah K.", ok: true }, { n: "Mike T.", ok: true }, { n: "John D.", ok: false }].map((a, i) => (
          <div key={i} className="rounded-xl p-2.5 text-center text-xs border"
            style={{ background: a.ok ? "rgba(52,211,153,0.08)" : "rgba(251,191,36,0.08)", borderColor: a.ok ? "rgba(52,211,153,0.25)" : "rgba(251,191,36,0.25)", color: a.ok ? "#34d399" : "#fbbf24" }}>
            <div className="text-base mb-1">{a.ok ? "✓" : "…"}</div>
            <div className="font-medium leading-tight truncate">{a.n}</div>
          </div>
        ))}
      </div>
      <div className="flex justify-center pt-1 transition-all duration-700"
        style={{ opacity: active ? 1 : 0, transform: active ? "scale(1) rotate(-7deg)" : "scale(0.5) rotate(-7deg)" }}>
        <div className="px-7 py-2 font-bold text-2xl tracking-[0.25em] rounded-xl select-none"
          style={{ color: "#34d399", border: "3px solid #34d399", textShadow: "0 0 20px rgba(52,211,153,0.5)", boxShadow: "0 0 28px rgba(52,211,153,0.15)" }}>
          APPROVED
        </div>
      </div>
    </div>
  );
}

function PDFVisual({ active, accent }: { active: boolean; accent: string }) {
  return (
    <div className="flex justify-center py-2">
      <div className="w-52 rounded-2xl p-5 transition-all duration-700"
        style={{ background: "rgba(8,8,28,0.95)", border: `1.5px solid ${active ? accent + "55" : "rgba(255,255,255,0.08)"}`, boxShadow: active ? `0 0 50px ${accent}22, 0 16px 48px rgba(0,0,0,0.5)` : "0 8px 24px rgba(0,0,0,0.4)" }}>
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/8">
          <div className="w-10 h-12 bg-red-500/15 border border-red-500/30 rounded-lg flex flex-col items-center justify-center gap-0.5 flex-shrink-0">
            <FileText className="w-4 h-4 text-red-400" />
            <span className="text-red-400 text-[8px] font-bold tracking-widest">PDF</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">ArtworkFile_v3.pdf</div>
            <div className="text-xs text-slate-500 mt-0.5">Production Ready</div>
          </div>
        </div>
        {[["Artwork", "Approved"], ["Placement", "Left Chest"], ["Size", `4" × 4"`], ["Colors", "CMYK"], ["Resolution", "300 DPI"]].map(([k, v], i) => (
          <div key={i} className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-500">{k}</span>
            <span className="text-slate-200 font-mono font-medium">{v}</span>
          </div>
        ))}
        <div className="mt-4 py-2 text-center text-xs font-bold tracking-widest rounded-xl"
          style={{ background: `${accent}14`, border: `1px solid ${accent}35`, color: accent }}>
          PRODUCTION READY
        </div>
      </div>
    </div>
  );
}

function PrintingVisual({ active, accent }: { active: boolean; accent: string }) {
  return (
    <div className="w-full max-w-xs mx-auto space-y-5">
      <div className="flex justify-center">
        <div className="w-28 h-24 rounded-2xl flex items-center justify-center relative overflow-hidden"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Printer className="w-12 h-12 text-slate-300 relative z-10" />
          {active && <div className="absolute bottom-0 left-0 right-0 h-1 animate-pulse" style={{ background: `linear-gradient(90deg, ${accent}, #8b5cf6)` }} />}
        </div>
      </div>
      <div className="space-y-3.5">
        {[{ label: "Prepress", pct: 100 }, { label: "Printing", pct: active ? 72 : 0 }, { label: "Quality Check", pct: 0 }].map((s, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span style={{ color: s.pct > 0 ? "white" : "#475569" }}>{s.label}</span>
              <span className="text-slate-500 font-mono">{s.pct}%</span>
            </div>
            <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${s.pct}%`, background: s.pct === 100 ? "#34d399" : `linear-gradient(90deg, ${accent}, #8b5cf6)` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-2 justify-center">
        {([["C", "#00b4d8"], ["M", "#e91e8c"], ["Y", "#ffda00"], ["K", "#555"]] as [string, string][]).map(([c, col]) => (
          <div key={c} className="flex flex-col items-center gap-1.5">
            <div className="w-7 h-11 rounded" style={{ background: col, opacity: 0.85 }} />
            <span className="text-[10px] font-mono text-slate-500">{c}</span>
          </div>
        ))}
        <span className="text-xs text-slate-500 ml-2 mb-3">Process</span>
      </div>
    </div>
  );
}

function FinalProductVisual({ active, accent }: { active: boolean; accent: string }) {
  const products = [
    { label: "T-Shirt", color: "#6366f1" }, { label: "Mug", color: "#06b6d4" },
    { label: "Tote Bag", color: "#8b5cf6" }, { label: "Cap", color: "#10b981" },
    { label: "Bottle", color: "#f59e0b" }, { label: "Polo Shirt", color: "#ec4899" },
  ];
  return (
    <div className="w-full space-y-4">
      <div className="grid grid-cols-3 gap-2.5">
        {products.map((p, i) => (
          <div key={i} className="rounded-xl p-3 text-center transition-all duration-500"
            style={{ background: active ? `${p.color}12` : "rgba(255,255,255,0.03)", border: `1px solid ${active ? p.color + "35" : "rgba(255,255,255,0.07)"}`, transitionDelay: `${i * 60}ms`, opacity: active ? 1 : 0.35, transform: active ? "scale(1)" : "scale(0.9)" }}>
            <div className="w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center" style={{ background: `${p.color}22` }}>
              <div className="w-4 h-4 rounded-sm" style={{ background: p.color, opacity: 0.9 }} />
            </div>
            <div className="text-xs text-slate-400 leading-tight">{p.label}</div>
          </div>
        ))}
      </div>
      <div className="flex justify-center transition-all duration-700" style={{ opacity: active ? 1 : 0, transform: active ? "translateY(0)" : "translateY(8px)" }}>
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
          style={{ background: `${accent}14`, border: `1px solid ${accent}40`, color: accent, boxShadow: `0 0 24px ${accent}20` }}>
          <span className="w-2 h-2 rounded-full inline-block animate-pulse" style={{ background: accent }} />
          Order Delivered Successfully
        </div>
      </div>
    </div>
  );
}

const VISUALS = [IdeaVisual, ProductSelectionVisual, DesignCreationVisual, ApprovalVisual, PDFVisual, PrintingVisual, FinalProductVisual];

// ─── Mobile card ──────────────────────────────────────────────────────────────

function MobileStepCard({ s, i, inView }: { s: typeof STEPS[0]; i: number; inView: boolean }) {
  const c = PALETTE[i];
  const Visual = VISUALS[i];
  return (
    <div data-theme-fixed-surface className="rounded-3xl p-6 relative transition-all duration-700"
      style={{ background: `linear-gradient(135deg, ${c.bg} 0%, rgba(5,5,18,0.95) 60%, ${c.bg} 100%)`, border: `1px solid ${c.border}`, boxShadow: inView ? `0 0 50px ${c.glow}, 0 16px 48px rgba(0,0,0,0.4)` : "none", opacity: inView ? 1 : 0.35, transform: inView ? "translateY(0) scale(1)" : "translateY(28px) scale(0.96)" }}>
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${c.accent}60, transparent)` }} />
      <div className="flex items-start gap-4 mb-5">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold flex-shrink-0 font-mono"
          style={{ background: `${c.accent}18`, color: c.accent, border: `1px solid ${c.border}` }}>
          {s.step}
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] mb-1" style={{ color: c.accent }}>{s.label}</div>
          <h3 className="text-lg font-bold text-white leading-tight" style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}>{s.heading}</h3>
        </div>
      </div>
      <div className="mb-5"><Visual active={inView} accent={c.accent} /></div>
      <p className="text-sm text-slate-400 leading-relaxed border-t border-white/5 pt-4">{s.text}</p>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function DesktopWorkflowCopy({ stepIndex, compact = false }: { stepIndex: number; compact?: boolean }) {
  const col = PALETTE[stepIndex];

  return (
    <div className="relative w-full">
      <div
        className="absolute left-[-8%] top-1/2 h-[72%] w-[96%] -translate-y-1/2 rounded-[2rem] pointer-events-none"
        style={{
          transform: "translateY(-50%) rotate(-2deg) skewY(-3deg)",
          background: `radial-gradient(circle at 34% 24%, ${col.glow}, transparent 58%)`,
          boxShadow: `0 45px 120px ${col.glow}`,
          opacity: 0.72,
        }}
      />
      <div className="relative">
        <div
          className={`inline-flex items-center gap-2 self-start ${compact ? "mb-4 px-2.5 py-1" : "mb-6 px-3 py-1.5"} rounded-full text-xs font-semibold tracking-[0.15em] uppercase`}
          style={{ background: `${col.accent}15`, border: `1px solid ${col.accent}30`, color: col.accent }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: col.accent }} />
          How It Works
        </div>

        <h2
          className={`relative font-bold text-white leading-[1.1] ${compact ? "mb-3 text-4xl" : "mb-4 text-5xl"}`}
          style={{
            fontFamily: '"Bricolage Grotesque", sans-serif',
            textShadow: "0 18px 45px rgba(0,0,0,0.62), 0 0 34px rgba(129,140,248,0.18)",
          }}
        >
          From Idea to<br />
          <span style={gradientTextStyle(col.accent)}>Real Product</span>
        </h2>

        <p className={`text-slate-400 ${compact ? "text-md mb-5" : "text-base mb-8"} leading-relaxed max-w-md`}>
          PromoPlus helps distributors move from product idea to approved artwork, production-ready files, printing, and final customer delivery.
        </p>

        <div className={`${compact ? "space-y-1.5 mb-5" : "space-y-2.5 mb-9"} max-w-md`}>
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-3 transition-colors duration-300">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-all duration-500"
                style={{
                  background: i <= stepIndex ? col.accent : "rgba(255,255,255,0.07)",
                  color: i <= stepIndex ? "#030314" : "#9fc0f0",
                  boxShadow: i === stepIndex ? `0 0 14px ${col.accent}80` : "none",
                  transform: i === stepIndex ? "scale(1.35)" : "scale(1)",
                }}
              >
                {i < stepIndex ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
              </div>
              <span
                className={`${compact ? "text-md" : "text-sm"} transition-colors duration-300`}
                style={{ color: i === stepIndex ? "white" : i < stepIndex ? "#b2b7bd" : "#898d92" }}
              >
                {s.label}
              </span>
              {i === stepIndex && (
                <span
                  className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold tracking-widest uppercase"
                  style={{ background: `${col.accent}18`, color: col.accent }}
                >
                  Active
                </span>
              )}
            </div>
          ))}
        </div>

        <div className={`flex flex-wrap gap-3 ${compact ? "mb-5" : "mb-8"}`}>
          <button
            className={`flex items-center gap-2 ${compact ? "px-4 py-2.5" : "px-5 py-3"} rounded-xl text-sm text-white transition-all hover:scale-105 active:scale-95`}
            style={{ background: `linear-gradient(135deg, ${col.accent}, #8b5cf6)`, textShadow: '0px 0px 0px rgba(0,0,0,0.0002) !important' }}
          >
            Book a Demo  <ArrowRight className="w-4 h-4" />
          </button>
          <button className={`flex items-center gap-2 ${compact ? "px-4 py-2.5" : "px-5 py-3"} rounded-xl text-sm font-medium text-slate-300 border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all`}>
            <Play className="w-4 h-4" /> Watch Workflow
          </button>
        </div>

        <div className={`grid grid-cols-2 gap-2 ${compact ? "max-w-md" : "max-w-lg"}`}>
          {BADGES.map(({ Icon, label }, i) => (
            <div key={i} className={`flex items-center gap-2 bg-white/4 border border-white/8 rounded-xl px-3 ${compact ? "py-2" : "py-2.5"}`}>
              <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DesktopWorkflowCard({ s, i, lightPos }: { s: typeof STEPS[0]; i: number; lightPos: { x: number; y: number } }) {
  const c = PALETTE[i];

  return (
    <div data-theme-fixed-surface className="relative w-full">
      <div
        className="absolute inset-3 rounded-3xl pointer-events-none"
        style={{
          transform: "translate(18px, 22px) scale(0.985)",
          background: `linear-gradient(135deg, ${c.accent}18, rgba(5,5,18,0.2))`,
          border: `1px solid ${c.border}`,
          boxShadow: `0 34px 90px ${c.glow}`,
        }}
      />
      <div
        className="absolute inset-6 rounded-3xl pointer-events-none"
        style={{
          transform: "translate(36px, 44px) scale(0.96)",
          background: "rgba(255,255,255,0.035)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      />

      <div
        className="w-full rounded-3xl p-7 relative overflow-hidden"
        style={{
          background: `linear-gradient(145deg, ${c.bg} 0%, rgba(5,5,18,0.96) 50%, ${c.bg} 100%)`,
          border: `1px solid ${c.border}`,
          boxShadow: `0 0 120px ${c.glow}, 0 52px 110px rgba(0,0,0,0.72), -18px -14px 45px rgba(255,255,255,0.035), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -22px 55px rgba(0,0,0,0.35)`,
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none rounded-t-3xl"
          style={{ background: `linear-gradient(90deg, transparent 5%, ${c.accent}80 45%, ${c.accent}80 55%, transparent 95%)` }}
        />
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{ background: `radial-gradient(circle at ${lightPos.x}% ${lightPos.y}%, rgba(255,255,255,0.07) 0%, transparent 55%)`, transition: "background 0.12s ease-out" }}
        />
        <div
          className="absolute top-5 right-5 w-2 h-2 rounded-full pointer-events-none"
          style={{ background: c.accent, boxShadow: `0 0 10px ${c.accent}` }}
        />

        <div className="flex items-start gap-4 mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-base font-black flex-shrink-0 font-mono"
            style={{ background: `${c.accent}18`, color: c.accent, border: `1.5px solid ${c.border}`, boxShadow: `0 0 22px ${c.accent}28` }}
          >
            {s.step}
          </div>
          <div className="pt-1">
            <div className="text-xs font-bold uppercase tracking-[0.22em] mb-1.5" style={{ color: c.accent }}>{s.label}</div>
            <h3 className="text-2xl font-black text-white leading-tight" style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}>{s.heading}</h3>
          </div>
        </div>

        <div className="mb-6">
          <WorkflowModelStage step={i} accent={c.accent} />
        </div>

        <div className="relative">
          <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${c.accent}28, transparent)` }} />
          <p className="text-sm text-slate-400 leading-relaxed pt-4">{s.text}</p>
        </div>
      </div>
    </div>
  );
}

function DesktopWorkflowStepRow({
  i,
  scrollStep,
}: {
  i: number;
  scrollStep: number;
}) {
  const cardOnLeft = i % 2 === 1;
  const relative = i - scrollStep;

  return (
    <section
      data-workflow-step-row={i}
      className="relative grid grid-cols-[minmax(0,1fr)_minmax(360px,450px)] items-center gap-[clamp(3rem,7vw,7.5rem)]"
      style={{
        height: "100vh",
        zIndex: 10 + i,
      }}
    >
      <div
        className={`w-full ${cardOnLeft ? "order-2" : "order-1"}`}
        style={{
          ...getWorkflowCopyStationStyle(relative),
          transform: "scale(0.96)",
          transformOrigin: cardOnLeft ? "left center" : "right center",
        }}
      >
        <DesktopWorkflowCopy stepIndex={i} compact />
      </div>

      <div
        data-workflow-card-station={i}
        className={`h-[60vh] max-h-[440px] w-[clamp(330px,27vw,410px)] ${cardOnLeft ? "order-1" : "order-2"}`}
        style={{
          justifySelf: cardOnLeft ? "start" : "end",
          opacity: 0,
          pointerEvents: "none",
        }}
      />
    </section>
  );
}

function MobileWorkflowStepRow({ i, scrollStep }: { i: number; scrollStep: number }) {
  const col = PALETTE[i];
  const relative = i - scrollStep;
  const focus = 1 - clamp(Math.abs(relative), 0, 1);
  const emphasis = easeOutCubic(focus);

  return (
    <section
      data-mobile-workflow-step-row={i}
      className="relative flex min-h-[100svh] flex-col justify-start px-5 pb-[48svh] pt-7"
      style={{
        opacity: lerp(0.48, 1, emphasis),
        filter: `brightness(${lerp(0.75, 1, emphasis)})`,
      }}
    >
      <div className="relative">
        <div
          className="absolute left-[-10%] top-1/2 h-[92%] w-[116%] -translate-y-1/2 rounded-[2rem] pointer-events-none"
          style={{
            transform: "translateY(-50%) rotate(-2deg) skewY(-3deg)",
            background: `radial-gradient(circle at 34% 24%, ${col.glow}, transparent 58%)`,
            boxShadow: `0 35px 90px ${col.glow}`,
            opacity: 0.6,
          }}
        />
        <div className="relative">
          <div
            className="inline-flex items-center gap-2 mb-3 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-[0.15em] uppercase"
            style={{ background: `${col.accent}15`, border: `1px solid ${col.accent}30`, color: col.accent }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: col.accent }} />
            How It Works
          </div>

          <h2
            className="relative font-bold text-white leading-[1.06] mb-2 text-[clamp(2.2rem,9vw,3.25rem)]"
            style={{
              fontFamily: '"Bricolage Grotesque", sans-serif',
              textShadow: "0 18px 45px rgba(0,0,0,0.62), 0 0 34px rgba(129,140,248,0.18)",
            }}
          >
            From Idea to<br />
            <span style={gradientTextStyle(col.accent)}>Real Product</span>
          </h2>

          <p className="text-slate-400 text-xs leading-relaxed mb-3 max-w-md">
            PromoPlus helps distributors move from product idea to approved artwork, production-ready files, printing, and final customer delivery.
          </p>

          <div className="space-y-1 mb-0 max-w-md">
            {STEPS.map((s, stepI) => (
              <div key={stepI} className="flex items-center gap-3 transition-colors duration-300">
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 transition-all duration-500"
                  style={{
                    background: stepI <= i ? col.accent : "rgba(255,255,255,0.07)",
                    color: stepI <= i ? "#030314" : "#9fc0f0",
                    boxShadow: stepI === i ? `0 0 14px ${col.accent}80` : "none",
                    transform: stepI === i ? "scale(1.14)" : "scale(1)",
                  }}
                >
                  {stepI < i ? <CheckCircle2 className="h-3 w-3" /> : stepI + 1}
                </div>
                <span
                  className="text-[11px] transition-colors duration-300"
                  style={{ color: stepI === i ? "white" : stepI < i ? "#b2b7bd" : "#898d92" }}
                >
                  {s.label}
                </span>
                {stepI === i && (
                  <span
                    className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold tracking-widest uppercase"
                    style={{ background: `${col.accent}18`, color: col.accent }}
                  >
                    Active
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div data-mobile-workflow-card-station={i} className="pointer-events-none absolute bottom-[8svh] left-1/2 h-[38svh] w-[86vw] -translate-x-1/2 opacity-0" />
    </section>
  );
}

export default function App() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const mobileSectionRef = useRef<HTMLDivElement>(null);
  const wheelSnapLockRef = useRef(false);
  const scrollAnimationFrameRef = useRef<number | null>(null);
  const wheelSnapTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrollStep, setScrollStep] = useState(0);
  // Mouse tilt for the 3D card
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  // Light position for specular reflection on card
  const [lightPos, setLightPos] = useState({ x: 50, y: 50 });
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  });
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 1024px)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("promoplus-theme-light", theme === "light");
    document.documentElement.dataset.promoplusTheme = theme;
    document.documentElement.style.colorScheme = theme === "light" ? "light" : "dark";
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const updateViewportMode = () => setIsDesktopViewport(mediaQuery.matches);
    updateViewportMode();
    mediaQuery.addEventListener("change", updateViewportMode);
    return () => mediaQuery.removeEventListener("change", updateViewportMode);
  }, []);

  // Scroll driver
  useEffect(() => {
    let frame = 0;

    const updateScroll = () => {
      const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
      const section = isDesktop ? sectionRef.current : mobileSectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const total = section.offsetHeight - window.innerHeight;
      const prog = Math.min(1, Math.max(0, -rect.top) / Math.max(total, 1));
      const stepProgress = prog * (STEPS.length - 1);
      const nextActiveStep = getStepFromScroll(stepProgress);
      setScrollProgress(prog);
      setScrollStep(stepProgress);
      setActiveStep(nextActiveStep);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        updateScroll();
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    updateScroll();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // One desktop mouse-wheel gesture moves exactly one workflow screen.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let lastPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    const clearWheelLock = () => {
      wheelSnapLockRef.current = false;
      if (wheelSnapTimeoutRef.current) {
        window.clearTimeout(wheelSnapTimeoutRef.current);
        wheelSnapTimeoutRef.current = null;
      }
    };

    const animateScrollToStep = (targetTop: number) => {
      if (scrollAnimationFrameRef.current) {
        window.cancelAnimationFrame(scrollAnimationFrameRef.current);
      }

      const startTop = window.scrollY;
      const distance = targetTop - startTop;
      const startedAt = performance.now();

      const tick = (now: number) => {
        const progress = clamp01((now - startedAt) / WORKFLOW_SNAP_DURATION_MS);
        const eased = easeInOutCubic(progress);
        window.scrollTo(0, startTop + distance * eased);

        if (progress < 1) {
          scrollAnimationFrameRef.current = window.requestAnimationFrame(tick);
          return;
        }

        window.scrollTo(0, targetTop);
        scrollAnimationFrameRef.current = null;
        wheelSnapTimeoutRef.current = window.setTimeout(clearWheelLock, 220);
      };

      scrollAnimationFrameRef.current = window.requestAnimationFrame(tick);
    };

    const onPointerMove = (event: PointerEvent) => {
      lastPointer = { x: event.clientX, y: event.clientY };
    };

    const onWheel = (event: WheelEvent) => {
      const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
      if (!isDesktop || Math.abs(event.deltaY) < 12) return;
      const target = event.target instanceof Element ? event.target : null;
      const pointerX = event.clientX || lastPointer.x;
      const pointerY = event.clientY || lastPointer.y;
      const pointedElement = document.elementFromPoint(pointerX, pointerY);
      if (target?.closest("[data-workflow-model-stage]") || pointedElement?.closest("[data-workflow-model-stage]")) {
        return;
      }

      const rect = section.getBoundingClientRect();
      const sectionActive = rect.top <= 1 && rect.bottom >= window.innerHeight - 1;
      if (!sectionActive) return;

      if (wheelSnapLockRef.current) {
        event.preventDefault();
        return;
      }

      const total = section.offsetHeight - window.innerHeight;
      const sectionTop = section.getBoundingClientRect().top + window.scrollY;
      const currentProgress = clamp01((window.scrollY - sectionTop) / Math.max(total, 1));
      const currentStep = getStepFromScroll(currentProgress * (STEPS.length - 1));
      const direction = event.deltaY > 0 ? 1 : -1;
      const targetStep = clamp(currentStep + direction, 0, STEPS.length - 1);

      if (targetStep === currentStep) {
        clearWheelLock();
        return;
      }

      event.preventDefault();
      wheelSnapLockRef.current = true;
      const targetProgress = targetStep / Math.max(STEPS.length - 1, 1);
      const targetTop = sectionTop + total * targetProgress;
      animateScrollToStep(targetTop);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("wheel", onWheel, { capture: true });
      if (scrollAnimationFrameRef.current) {
        window.cancelAnimationFrame(scrollAnimationFrameRef.current);
      }
      clearWheelLock();
    };
  }, []);

  // One mobile swipe gesture moves exactly one workflow screen.
  useEffect(() => {
    const section = mobileSectionRef.current;
    if (!section) return;
    let nativeScrollSettleTimeout: ReturnType<typeof window.setTimeout> | null = null;
    let lastNativeScrollY = window.scrollY;

    const clearMobileLock = () => {
      wheelSnapLockRef.current = false;
      lastNativeScrollY = window.scrollY;
      if (wheelSnapTimeoutRef.current) {
        window.clearTimeout(wheelSnapTimeoutRef.current);
        wheelSnapTimeoutRef.current = null;
      }
      if (nativeScrollSettleTimeout) {
        window.clearTimeout(nativeScrollSettleTimeout);
        nativeScrollSettleTimeout = null;
      }
    };

    const animateScrollToStep = (targetTop: number) => {
      if (scrollAnimationFrameRef.current) {
        window.cancelAnimationFrame(scrollAnimationFrameRef.current);
      }

      const startTop = window.scrollY;
      const distance = targetTop - startTop;
      const startedAt = performance.now();

      const tick = (now: number) => {
        const progress = clamp01((now - startedAt) / WORKFLOW_SNAP_DURATION_MS);
        const eased = easeInOutCubic(progress);
        window.scrollTo(0, startTop + distance * eased);
        syncMobileScrollState();

        if (progress < 1) {
          scrollAnimationFrameRef.current = window.requestAnimationFrame(tick);
          return;
        }

        window.scrollTo(0, targetTop);
        syncMobileScrollState();
        scrollAnimationFrameRef.current = null;
        wheelSnapTimeoutRef.current = window.setTimeout(clearMobileLock, 180);
      };

      scrollAnimationFrameRef.current = window.requestAnimationFrame(tick);
    };

    const getMobileTargetTop = (direction: 1 | -1) => {
      const total = section.offsetHeight - window.innerHeight;
      const sectionTop = section.getBoundingClientRect().top + window.scrollY;
      const currentProgress = clamp01((window.scrollY - sectionTop) / Math.max(total, 1));
      const currentStep = getStepFromScroll(currentProgress * (STEPS.length - 1));
      const targetStep = clamp(currentStep + direction, 0, STEPS.length - 1);
      if (targetStep === currentStep) {
        return null;
      }

      const targetProgress = targetStep / Math.max(STEPS.length - 1, 1);
      return sectionTop + total * targetProgress;
    };

    const syncMobileScrollState = () => {
      const total = section.offsetHeight - window.innerHeight;
      const sectionTop = section.getBoundingClientRect().top + window.scrollY;
      const progress = clamp01((window.scrollY - sectionTop) / Math.max(total, 1));
      const stepProgress = progress * (STEPS.length - 1);
      setScrollProgress(progress);
      setScrollStep(stepProgress);
      setActiveStep(getStepFromScroll(stepProgress));
    };

    const onTouchStart = (event: TouchEvent) => {
      const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
      const touch = event.touches[0];
      if (isDesktop || !touch) return;

      const target = event.target instanceof Element ? event.target : null;
      if (!target || !section.contains(target)) return;

      const rect = section.getBoundingClientRect();
      const sectionActive = rect.top <= window.innerHeight * 0.5 && rect.bottom >= window.innerHeight * 0.5;
      const targetIsModelStage = Boolean(target.closest("[data-workflow-model-stage]"));

      mobileTouchRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        isTracking: sectionActive,
        hasSnapped: false,
        targetIsModelStage,
      };

    };

    const onTouchMove = (event: TouchEvent) => {
      const state = mobileTouchRef.current;
      const touch = event.touches[0];
      if (!state.isTracking || state.targetIsModelStage || !touch) return;

      const deltaX = touch.clientX - state.startX;
      const deltaY = touch.clientY - state.startY;
      const isVerticalSwipe = Math.abs(deltaY) > 34 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2;
      if (!isVerticalSwipe) return;

      if (wheelSnapLockRef.current) {
        event.preventDefault();
        return;
      }

      if (state.hasSnapped) {
        event.preventDefault();
        return;
      }

      const direction = deltaY < 0 ? 1 : -1;
      const targetTop = getMobileTargetTop(direction);
      if (targetTop === null) {
        state.isTracking = false;
        return;
      }

      event.preventDefault();
      state.hasSnapped = true;
      wheelSnapLockRef.current = true;
      animateScrollToStep(targetTop);
    };

    const onTouchEnd = () => {
      mobileTouchRef.current.isTracking = false;
    };

    const onNativeMobileScroll = () => {
      const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
      if (isDesktop) return;

      const currentY = window.scrollY;
      const delta = currentY - lastNativeScrollY;
      lastNativeScrollY = currentY;
      if (Math.abs(delta) < 2 || wheelSnapLockRef.current) return;

      const rect = section.getBoundingClientRect();
      const sectionActive = rect.top <= window.innerHeight * 0.5 && rect.bottom >= window.innerHeight * 0.5;
      if (!sectionActive) return;

      const direction = delta > 0 ? 1 : -1;
      if (nativeScrollSettleTimeout) {
        window.clearTimeout(nativeScrollSettleTimeout);
      }

      nativeScrollSettleTimeout = window.setTimeout(() => {
        if (wheelSnapLockRef.current) return;

        const targetTop = getMobileTargetTop(direction);
        if (targetTop === null) return;
        if (Math.abs(window.scrollY - targetTop) < 8) return;

        wheelSnapLockRef.current = true;
        animateScrollToStep(targetTop);
      }, 90);
    };

    window.addEventListener("touchstart", onTouchStart, { passive: false, capture: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true, capture: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true, capture: true });
    window.addEventListener("scroll", onNativeMobileScroll, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart, { capture: true });
      window.removeEventListener("touchmove", onTouchMove, { capture: true });
      window.removeEventListener("touchend", onTouchEnd, { capture: true });
      window.removeEventListener("touchcancel", onTouchEnd, { capture: true });
      window.removeEventListener("scroll", onNativeMobileScroll);
      if (scrollAnimationFrameRef.current) {
        window.cancelAnimationFrame(scrollAnimationFrameRef.current);
      }
      clearMobileLock();
    };
  }, []);

  const col = PALETTE[activeStep];

  // Right panel mouse tracking for 3D tilt + specular
  const handlePanelMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest("[data-workflow-model-stage]")) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    setTilt({
      x: ((e.clientY - cy) / (rect.height / 2)) * -4,
      y: ((e.clientX - cx) / (rect.width / 2)) * 4,
    });
    setLightPos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };
  const handlePanelMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setLightPos({ x: 50, y: 50 });
  };
  const toggleTheme = () => {
    setTheme(currentTheme => (currentTheme === "dark" ? "light" : "dark"));
  };
  const nextThemeLabel = theme === "dark" ? "white" : "black";

  return (
    <div
      className="promoplus-app bg-background text-foreground min-h-screen"
      data-theme={theme}
      style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
    >
      {/* Ambient radial haze */}
      <div className="fixed inset-0 pointer-events-none transition-all duration-1000"
        style={{ zIndex: 2, background: `radial-gradient(ellipse 55% 45% at 78% 52%, ${col.glow}, transparent 68%)` }} />

      {/* Dot grid */}
      <div className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 2, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

      {/* ── Nav ── */}
      <header className="relative flex items-center justify-between px-6 md:px-10 py-5 border-b border-white/5" style={{ zIndex: 50 }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">PP</span>
          </div>
          <span className="text-white font-bold text-xl" style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}>PromoPlus</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400">
          {["Features", "Workflow", "Pricing", "Customers"].map(n => (
            <a key={n} href="#" className="hover:text-white transition-colors duration-200">{n}6546</a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a href="#" className="hidden md:block text-sm text-slate-400 hover:text-white transition-colors">Sign in</a>
          {/* <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${nextThemeLabel} theme`}
            title={`Switch to ${nextThemeLabel} theme`}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-slate-300 transition-all hover:border-white/20 hover:bg-white/10 active:scale-95"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span className="hidden sm:inline">{theme === "dark" ? "White" : "Black"}</span>
          </button> */}
          <button className="px-4 py-2 text-sm text-white rounded-xl transition-all hover:scale-105 active:scale-95"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 16px rgba(99,102,241,0.38)" }}>
            Book a Demo
          </button>
        </div>
      </header>

      {/* ── Desktop sticky scroll section ── */}
      <div
        ref={sectionRef}
        data-workflow-crossing
        className="hidden lg:block relative overflow-hidden"
        style={{ minHeight: `${WORKFLOW_DESKTOP_SECTION_HEIGHT_VH}vh`, zIndex: 10 }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(100deg, rgba(129,140,248,0.055), rgba(5,5,18,0.18) 42%, rgba(5,5,18,0.04) 78%)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none transition-colors duration-500"
          style={{ background: `radial-gradient(ellipse 58% 44% at ${activeStep % 2 === 0 ? 78 : 22}% 54%, ${col.glow}, transparent 70%)` }}
        />
        <div className="absolute inset-x-8 top-0 h-px bg-white/5" />
        <div className="absolute inset-x-8 bottom-0 h-px bg-white/5" />

        <div
          className="relative mx-auto flex max-w-[1320px] flex-col px-8"
          style={{ height: `${WORKFLOW_DESKTOP_SECTION_HEIGHT_VH}vh` }}
        >
          {STEPS.map((s, i) => (
            <DesktopWorkflowStepRow
              key={s.step}
              i={i}
              scrollStep={scrollStep}
            />
          ))}

          {isDesktopViewport && (
            <div
              data-workflow-card={activeStep}
              data-workflow-card-track
              className="absolute w-[clamp(330px,27vw,410px)]"
              onMouseMove={handlePanelMouseMove}
              onMouseLeave={handlePanelMouseLeave}
              style={getTravelingWorkflowCardStyle(scrollStep, col.accent)}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, y: 18, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -18, scale: 0.96 }}
                  transition={{ duration: 0.42, ease: "easeOut" }}
                  style={{ transformOrigin: "50% 50%", transformStyle: "preserve-3d" }}
                >
                  <div
                    style={{
                      transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                      transformOrigin: "50% 50%",
                      transformStyle: "preserve-3d",
                      transition: "transform 0.14s ease-out",
                    }}
                  >
                    <DesktopWorkflowCard s={STEPS[activeStep]} i={activeStep} lightPos={lightPos} />
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {false && (<>
        <div className="hidden" aria-hidden="true">
        <div className="sticky top-0 h-screen overflow-hidden">
          <div className="h-full grid grid-cols-2">

            {/* Left panel */}
            <div
              className="relative flex flex-col justify-center px-14 py-10 border-r border-white/5 overflow-hidden"
              style={{
                background: "linear-gradient(100deg, rgba(129,140,248,0.055), rgba(5,5,18,0.14) 42%, transparent 78%)",
              }}
            >
              <div
                className="absolute left-12 top-1/2 h-[58%] w-[70%] -translate-y-1/2 rounded-[2rem] pointer-events-none"
                style={{
                  transform: "rotate(-2deg) skewY(-3deg)",
                  background: `radial-gradient(circle at 34% 24%, ${col.glow}, transparent 58%)`,
                  boxShadow: `0 45px 120px ${col.glow}`,
                  opacity: 0.72,
                }}
              />
              <motion.div
                key={`lbl-${activeStep}`}
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                className="inline-flex items-center gap-2 self-start mb-6 px-3 py-1.5 rounded-full text-xs font-semibold tracking-[0.15em] uppercase"
                style={{ background: `${col.accent}15`, border: `1px solid ${col.accent}30`, color: col.accent }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: col.accent }} />
                How It Works
              </motion.div>

              <h2
                className="relative font-bold text-white leading-[1.1] mb-4 text-5xl"
                style={{
                  fontFamily: '"Bricolage Grotesque", sans-serif',
                  textShadow: "0 18px 45px rgba(0,0,0,0.62), 0 0 34px rgba(129,140,248,0.18)",
                }}
              >
                From Idea to<br />
                <span className="transition-all duration-700"
                  style={gradientTextStyle(col.accent)}>
                  Real Product
                </span>
              </h2>

              <p className="text-slate-400 text-base leading-relaxed mb-8 max-w-sm">
                PromoPlus helps distributors move from product idea to approved artwork, production-ready files, printing, and final customer delivery.
              </p>

              {/* Step timeline */}
              <div className="space-y-2.5 mb-9">
                {STEPS.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 transition-all duration-400"
                    style={{ opacity: i === activeStep ? 1 : i < activeStep ? 1 : 1 }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-all duration-500"
                      style={{ background: i <= activeStep ? col.accent : "rgba(255,255,255,0.07)", color: i <= activeStep ? "#030314" : "#9fc0f0", boxShadow: i === activeStep ? `0 0 14px ${col.accent}80` : "none", transform: i === activeStep ? "scale(1.35)" : "scale(1)" }}>
                      {i < activeStep ? "✓" : i + 1}
                    </div>
                    <span className="text-sm transition-colors duration-300"
                      style={{ color: i === activeStep ? "white" : i < activeStep ? "#b2b7bd" : "#898d92" }}>
                      {s.label}
                    </span>
                    {i === activeStep && (
                      <motion.div key={i} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                        className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold tracking-widest uppercase"
                        style={{ background: `${col.accent}18`, color: col.accent }}>
                        Active
                      </motion.div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 mb-8">
                <button className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm text-white transition-all hover:scale-105 active:scale-95"
                  style={{ background: `linear-gradient(135deg, ${col.accent}, #8b5cf6)`, boxShadow: `0 4px 20px ${col.accent}35` }}>
                  Book a Demo <ArrowRight className="w-4 h-4" />
                </button>
                <button className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-slate-300 border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all">
                  <Play className="w-4 h-4" /> Watch Workflow
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {BADGES.map(({ Icon, label }, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white/4 border border-white/8 rounded-xl px-3 py-2.5">
                    <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-xs text-slate-400">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right panel — 3D stage */}
            <div
              className="relative flex items-center justify-center p-10 overflow-hidden"
              onMouseMove={handlePanelMouseMove}
              onMouseLeave={handlePanelMouseLeave}
            >
              {/* Progress bar */}
              <div className="absolute top-6 left-8 right-8 h-px bg-white/5 rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full"
                  animate={{ width: `${scrollProgress * 100}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  style={{ background: `linear-gradient(90deg, ${col.accent}, #8b5cf6)` }} />
              </div>

              {/* Step label pill */}
              <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20">
                <AnimatePresence mode="wait">
                  <motion.div key={activeStep}
                    initial={{ opacity: 0, y: -10, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.8 }} transition={{ duration: 0.22 }}
                    className="px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase whitespace-nowrap"
                    style={{ background: `${col.accent}18`, border: `1px solid ${col.accent}35`, color: col.accent }}>
                    {STEPS[activeStep].step} / {String(STEPS.length).padStart(2, "0")} — {STEPS[activeStep].label}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* ── 3D card stage: perspective → mouse tilt → AnimatePresence flip ── */}
              <div className="relative w-full max-w-[420px] z-10" style={{ height: "calc(100vh - 160px)" }}>

                {/* Mouse tilt wrapper */}
                <div style={{
                  width: "100%", height: "100%",
                  transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                  transition: "transform 0.14s ease-out",
                  transformOrigin: "50% 50%",
                }}>
                  <AnimatePresence mode="sync">
                    {STEPS.map((s, i) =>
                      i === activeStep ? (
                        <motion.div
                          key={i}
                          initial={CARD_ENTRY[i]}
                          animate={{ rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1, x: 0, y: 0, opacity: 1 }}
                          exit={CARD_EXIT[i]}
                          transition={SPRING}
                          className="absolute inset-0 overflow-visible"
                          style={{ scrollbarWidth: "none" }}
                        >
                          <div className="min-h-full flex items-center py-6 w-full">
                            <div className="relative w-full">
                              <div
                                className="absolute inset-3 rounded-3xl pointer-events-none"
                                style={{
                                  transform: "translate(18px, 22px) scale(0.985)",
                                  background: `linear-gradient(135deg, ${PALETTE[i].accent}18, rgba(5,5,18,0.2))`,
                                  border: `1px solid ${PALETTE[i].border}`,
                                  boxShadow: `0 34px 90px ${PALETTE[i].glow}`,
                                }}
                              />
                              <div
                                className="absolute inset-6 rounded-3xl pointer-events-none"
                                style={{
                                  transform: "translate(36px, 44px) scale(0.96)",
                                  background: "rgba(255,255,255,0.035)",
                                  border: "1px solid rgba(255,255,255,0.06)",
                                }}
                              />

                            {/* Card */}
                            <div className="w-full rounded-3xl p-7 relative"
                              style={{
                                background: `linear-gradient(145deg, ${PALETTE[i].bg} 0%, rgba(5,5,18,0.96) 50%, ${PALETTE[i].bg} 100%)`,
                                border: `1px solid ${PALETTE[i].border}`,
                                boxShadow: `0 0 120px ${PALETTE[i].glow}, 0 52px 110px rgba(0,0,0,0.72), -18px -14px 45px rgba(255,255,255,0.035), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -22px 55px rgba(0,0,0,0.35)`,
                              }}>

                              {/* Top sheen */}
                              <div className="absolute inset-x-0 top-0 h-px pointer-events-none rounded-t-3xl"
                                style={{ background: `linear-gradient(90deg, transparent 5%, ${PALETTE[i].accent}80 45%, ${PALETTE[i].accent}80 55%, transparent 95%)` }} />

                              {/* Mouse-driven specular highlight */}
                              <div className="absolute inset-0 rounded-3xl pointer-events-none"
                                style={{ background: `radial-gradient(circle at ${lightPos.x}% ${lightPos.y}%, rgba(255,255,255,0.07) 0%, transparent 55%)`, transition: "background 0.12s ease-out" }} />

                              {/* Corner glow dot */}
                              <div className="absolute top-5 right-5 w-2 h-2 rounded-full pointer-events-none"
                                style={{ background: PALETTE[i].accent, boxShadow: `0 0 10px ${PALETTE[i].accent}` }} />

                              {/* Step header */}
                              <div className="flex items-start gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-base font-black flex-shrink-0 font-mono"
                                  style={{ background: `${PALETTE[i].accent}18`, color: PALETTE[i].accent, border: `1.5px solid ${PALETTE[i].border}`, boxShadow: `0 0 22px ${PALETTE[i].accent}28` }}>
                                  {s.step}
                                </div>
                                <div className="pt-1">
                                  <div className="text-xs font-bold uppercase tracking-[0.22em] mb-1.5" style={{ color: PALETTE[i].accent }}>{s.label}</div>
                                  <h3 className="text-2xl font-black text-white leading-tight" style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}>{s.heading}</h3>
                                </div>
                              </div>

                              {/* Visual */}
                              <div className="mb-6">
                                <WorkflowModelStage step={i} accent={PALETTE[i].accent} />
                              </div>

                              {/* Description */}
                              <div className="relative">
                                <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${PALETTE[i].accent}28, transparent)` }} />
                                <p className="text-sm text-slate-400 leading-relaxed pt-4">{s.text}</p>
                              </div>
                            </div>
                            </div>
                          </div>
                        </motion.div>
                      ) : null
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Dot nav */}
              <div className="absolute bottom-7 flex gap-2 z-20">
                {STEPS.map((_, i) => (
                  <motion.div key={i}
                    animate={{ width: i === activeStep ? 22 : 6, background: i === activeStep ? col.accent : "rgba(255,255,255,0.14)" }}
                    transition={{ type: "spring", stiffness: 300, damping: 22 }}
                    className="h-1.5 rounded-full" />
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Mobile ── */}
      </>)}

      <div
        ref={mobileSectionRef}
        data-mobile-workflow-crossing
        className="lg:hidden relative overflow-hidden"
        style={{ minHeight: `${WORKFLOW_DESKTOP_SECTION_HEIGHT_VH}svh`, zIndex: 10 }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(100deg, rgba(129,140,248,0.055), rgba(5,5,18,0.18) 42%, rgba(5,5,18,0.04) 78%)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none transition-colors duration-500"
          style={{ background: `radial-gradient(ellipse 82% 40% at 50% 64%, ${col.glow}, transparent 72%)` }}
        />

        <div className="relative" style={{ height: `${WORKFLOW_DESKTOP_SECTION_HEIGHT_VH}svh` }}>
          {STEPS.map((_, i) => (
            <MobileWorkflowStepRow key={i} i={i} scrollStep={scrollStep} />
          ))}

          {!isDesktopViewport && (
            <div
              data-mobile-workflow-card={activeStep}
              data-workflow-card-track
              className="absolute w-[min(96vw,470px)]"
              style={getTravelingMobileWorkflowCardStyle(scrollStep, col.accent)}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -16, scale: 0.96 }}
                  transition={{ duration: 0.36, ease: "easeOut" }}
                  style={{ transformOrigin: "50% 50%", transformStyle: "preserve-3d" }}
                >
                  <DesktopWorkflowCard s={STEPS[activeStep]} i={activeStep} lightPos={lightPos} />
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer CTA ── */}
      <div className="relative text-center py-24 px-8 border-t border-white/5" style={{ zIndex: 10 }}>
        <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full text-xs font-semibold text-indigo-400 tracking-widest uppercase"
          style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}>
          Get Started Today
        </div>
        <h3 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}>
          Ready to streamline your<br />artwork workflow?
        </h3>
        <p className="text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">
          Join thousands of promotional product distributors using PromoPlus every day to close deals faster and reduce production errors.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm text-white transition-all hover:scale-105 active:scale-95"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)"  }}>
            Book a Demo <ArrowRight className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-medium text-slate-300 border border-white/10 hover:bg-white/5 transition-all">
            <Play className="w-4 h-4" /> Watch Workflow
          </button>
        </div>
      </div>
    </div>
  );
}
