"use client";

import { useTheme } from "@/components/theme-provider";
import {
  buildMarkSurface,
  formatMoney,
  formatPrice,
  nearestIndex,
  pnlToRgb,
  type OptionLeg,
  type SurfaceGrid,
  type VolParams,
} from "@/lib/options";
import { Html, Line, OrbitControls, Text } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";
import * as THREE from "three";

interface PnlSurface3DProps {
  legs: OptionLeg[];
  spot: number;
  vol: VolParams;
  volOk: boolean;
}

type WorldMap = {
  toWorld: (s: number, iv: number, pnl: number) => [number, number, number];
  spot0: number;
  spotMax: number;
  iv0: number;
  ivMax: number;
  minPnl: number;
  maxPnl: number;
  yFloor: number;
};

function makeWorldMap(grid: SurfaceGrid): WorldMap {
  const nS = grid.spots.length;
  const nI = grid.ivs.length;
  const spot0 = grid.spots[0]!;
  const spotMax = grid.spots[nS - 1]!;
  const iv0 = grid.ivs[0]!;
  const ivMax = grid.ivs[nI - 1]!;
  const spotSpan = Math.max(spotMax - spot0, 1);
  const ivSpan = Math.max(ivMax - iv0, 1e-6);
  const pnlSpan = Math.max(grid.maxPnl - grid.minPnl, 1);
  const xScale = 6 / spotSpan;
  const zScale = 4 / ivSpan;
  const yScale = 2.8 / pnlSpan;
  const midPnl = (grid.minPnl + grid.maxPnl) / 2;

  const toWorld = (s: number, iv: number, pnl: number): [number, number, number] => [
    (s - spot0) * xScale - 3,
    (pnl - midPnl) * yScale,
    (iv - iv0) * zScale - 2,
  ];

  const yFloor = toWorld(spot0, iv0, grid.minPnl)[1] - 0.15;

  return {
    toWorld,
    spot0,
    spotMax,
    iv0,
    ivMax,
    minPnl: grid.minPnl,
    maxPnl: grid.maxPnl,
    yFloor,
  };
}

function compactMoney(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : value > 0 ? "+" : "";
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function AxisLabels({
  map,
  dark,
}: {
  map: WorldMap;
  dark: boolean;
}) {
  const labelColor = dark ? "#c5d0dc" : "#3d4a5c";
  const titleColor = dark ? "#e7eef6" : "#0f1c2e";
  const tickColor = dark ? "#6b7c8f" : "#5a6b7d";

  const spotTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const s = map.spot0 + t * (map.spotMax - map.spot0);
    const [x, , z] = map.toWorld(s, map.iv0, map.minPnl);
    return { s, pos: [x, map.yFloor, z - 0.35] as [number, number, number] };
  });

  const ivTicks = [0, 0.33, 0.66, 1].map((t) => {
    const iv = map.iv0 + t * (map.ivMax - map.iv0);
    const [x, , z] = map.toWorld(map.spot0, iv, map.minPnl);
    return { iv, pos: [x - 0.45, map.yFloor, z] as [number, number, number] };
  });

  const pnlTicks = [0, 0.5, 1].map((t) => {
    const pnl = map.minPnl + t * (map.maxPnl - map.minPnl);
    const [x, y, z] = map.toWorld(map.spot0, map.iv0, pnl);
    return { pnl, pos: [x - 0.55, y, z - 0.15] as [number, number, number] };
  });

  const spotAxisEnd = map.toWorld(map.spotMax, map.iv0, map.minPnl);
  const ivAxisEnd = map.toWorld(map.spot0, map.ivMax, map.minPnl);
  const pnlAxisEnd = map.toWorld(map.spot0, map.iv0, map.maxPnl);
  const origin = map.toWorld(map.spot0, map.iv0, map.minPnl);

  return (
    <group>
      {/* Axis lines */}
      <Line
        points={[
          [origin[0], map.yFloor, origin[2]],
          [spotAxisEnd[0], map.yFloor, spotAxisEnd[2]],
        ]}
        color={tickColor}
        lineWidth={1.5}
      />
      <Line
        points={[
          [origin[0], map.yFloor, origin[2]],
          [ivAxisEnd[0], map.yFloor, ivAxisEnd[2]],
        ]}
        color={tickColor}
        lineWidth={1.5}
      />
      <Line
        points={[
          [origin[0], map.yFloor, origin[2]],
          [origin[0], pnlAxisEnd[1], origin[2]],
        ]}
        color={tickColor}
        lineWidth={1.5}
      />

      {/* Axis titles */}
      <Text
        position={[0, map.yFloor - 0.15, -2.55]}
        fontSize={0.22}
        color={titleColor}
        anchorX="center"
        anchorY="middle"
      >
        Spot price →
      </Text>
      <Text
        position={[-3.55, map.yFloor - 0.05, 0]}
        fontSize={0.22}
        color={titleColor}
        anchorX="center"
        anchorY="middle"
        rotation={[0, Math.PI / 2, 0]}
      >
        IV % →
      </Text>
      <Text
        position={[-3.7, 0.2, -2.1]}
        fontSize={0.22}
        color={titleColor}
        anchorX="center"
        anchorY="middle"
        rotation={[0, 0, Math.PI / 2]}
      >
        P&L ↑
      </Text>

      {/* Spot tick labels */}
      {spotTicks.map((tick) => (
        <Text
          key={`s-${tick.s}`}
          position={tick.pos}
          fontSize={0.16}
          color={labelColor}
          anchorX="center"
          anchorY="top"
        >
          {formatPrice(tick.s, 0)}
        </Text>
      ))}

      {/* IV tick labels */}
      {ivTicks.map((tick) => (
        <Text
          key={`iv-${tick.iv}`}
          position={tick.pos}
          fontSize={0.16}
          color={labelColor}
          anchorX="right"
          anchorY="middle"
        >
          {`${(tick.iv * 100).toFixed(0)}%`}
        </Text>
      ))}

      {/* P&L tick labels */}
      {pnlTicks.map((tick) => (
        <Text
          key={`pnl-${tick.pnl}`}
          position={tick.pos}
          fontSize={0.15}
          color={labelColor}
          anchorX="right"
          anchorY="middle"
        >
          {compactMoney(tick.pnl)}
        </Text>
      ))}
    </group>
  );
}

function ValueCallouts({
  prePos,
  postPos,
  prePnl,
  postPnl,
  preIvPct,
  postIvPct,
  spot,
  dark,
}: {
  prePos: [number, number, number];
  postPos: [number, number, number];
  prePnl: number;
  postPnl: number;
  preIvPct: number;
  postIvPct: number;
  spot: number;
  dark: boolean;
}) {
  const chip = dark
    ? "rounded border border-white/15 bg-[#121a24]/92 px-2 py-1 text-[10px] font-medium text-[#e7eef6] shadow-sm backdrop-blur"
    : "rounded border border-black/10 bg-white/92 px-2 py-1 text-[10px] font-medium text-[#0f1c2e] shadow-sm backdrop-blur";

  return (
    <>
      <Html position={[prePos[0], prePos[1] + 0.28, prePos[2]]} center distanceFactor={10}>
        <div className={chip}>
          <div className="opacity-70">Pre @ S{formatPrice(spot, 0)}</div>
          <div className="font-tabular">
            IV {preIvPct.toFixed(0)}% · {formatMoney(prePnl, { signed: true })}
          </div>
        </div>
      </Html>
      <Html position={[postPos[0], postPos[1] + 0.28, postPos[2]]} center distanceFactor={10}>
        <div className={chip}>
          <div className="opacity-70">Post @ S{formatPrice(spot, 0)}</div>
          <div className="font-tabular text-[#0f766e] dark:text-[#2bb8a8]">
            IV {postIvPct.toFixed(0)}% · {formatMoney(postPnl, { signed: true })}
          </div>
        </div>
      </Html>
    </>
  );
}

function SurfaceMesh({
  legs,
  spot,
  vol,
  dark,
}: {
  legs: OptionLeg[];
  spot: number;
  vol: VolParams;
  dark: boolean;
}) {
  const grid = useMemo(
    () => buildMarkSurface(legs, spot, vol, { nSpot: 40, nIv: 30 }),
    [legs, spot, vol],
  );

  const built = useMemo(() => {
    if (!grid) return null;
    const map = makeWorldMap(grid);
    const nS = grid.spots.length;
    const nI = grid.ivs.length;
    const positions = new Float32Array(nS * nI * 3);
    const colors = new Float32Array(nS * nI * 3);

    for (let j = 0; j < nI; j++) {
      for (let i = 0; i < nS; i++) {
        const idx = j * nS + i;
        const s = grid.spots[i]!;
        const iv = grid.ivs[j]!;
        const zPnl = grid.pnl[j]![i]!;
        const [x, y, z] = map.toWorld(s, iv, zPnl);
        positions[idx * 3] = x;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = z;
        const [r, g, b] = pnlToRgb(zPnl, grid.minPnl, grid.maxPnl);
        colors[idx * 3] = r;
        colors[idx * 3 + 1] = g;
        colors[idx * 3 + 2] = b;
      }
    }

    const indices: number[] = [];
    for (let j = 0; j < nI - 1; j++) {
      for (let i = 0; i < nS - 1; i++) {
        const a = j * nS + i;
        const b = a + 1;
        const c = a + nS;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const preJ = nearestIndex(grid.ivs, grid.preIv);
    const postJ = nearestIndex(grid.ivs, grid.postIv);
    const spotI = nearestIndex(grid.spots, grid.spot);

    const ridge = (j: number) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < nS; i++) {
        const [x, y, z] = map.toWorld(
          grid.spots[i]!,
          grid.ivs[j]!,
          grid.pnl[j]![i]!,
        );
        pts.push(new THREE.Vector3(x, y + 0.02, z));
      }
      return pts;
    };

    const spotPnlPre = grid.pnl[preJ]![spotI]!;
    const spotPnlPost = grid.pnl[postJ]![spotI]!;

    return {
      geometry: geo,
      map,
      preRidge: ridge(preJ),
      postRidge: ridge(postJ),
      spotMarkerPre: map.toWorld(grid.spot, grid.ivs[preJ]!, spotPnlPre),
      spotMarkerPost: map.toWorld(grid.spot, grid.ivs[postJ]!, spotPnlPost),
      preIvPct: grid.preIv * 100,
      postIvPct: grid.postIv * 100,
      spot: grid.spot,
      spotPnlPre,
      spotPnlPost,
      grid,
    };
  }, [grid]);

  if (!built) return null;

  const gridColor = dark ? "#2a3748" : "#c9d4df";
  const gridColorSoft = dark ? "#1a2430" : "#e4ebf1";
  const preColor = dark ? "#e7eef6" : "#142033";
  const postColor = dark ? "#2bb8a8" : "#0f766e";

  return (
    <group>
      <mesh geometry={built.geometry}>
        <meshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          flatShading={false}
          metalness={dark ? 0.22 : 0.15}
          roughness={dark ? 0.48 : 0.55}
        />
      </mesh>
      <Line points={built.preRidge} color={preColor} lineWidth={2} />
      <Line points={built.postRidge} color={postColor} lineWidth={2.5} />
      <mesh position={built.spotMarkerPre}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color={preColor} />
      </mesh>
      <mesh position={built.spotMarkerPost}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial
          color={postColor}
          emissive={postColor}
          emissiveIntensity={0.3}
        />
      </mesh>
      <AxisLabels map={built.map} dark={dark} />
      <ValueCallouts
        prePos={built.spotMarkerPre}
        postPos={built.spotMarkerPost}
        prePnl={built.spotPnlPre}
        postPnl={built.spotPnlPost}
        preIvPct={built.preIvPct}
        postIvPct={built.postIvPct}
        spot={built.spot}
        dark={dark}
      />
      <gridHelper
        args={[8, 16, gridColor, gridColorSoft]}
        position={[0, built.map.yFloor - 0.02, 0]}
      />
      <ambientLight intensity={dark ? 0.55 : 0.75} />
      <directionalLight position={[4, 6, 3]} intensity={dark ? 0.95 : 1.1} />
      <directionalLight position={[-3, 2, -4]} intensity={dark ? 0.25 : 0.35} />
    </group>
  );
}

function NumericReadout({
  legs,
  spot,
  vol,
}: {
  legs: OptionLeg[];
  spot: number;
  vol: VolParams;
}) {
  const grid = useMemo(
    () => buildMarkSurface(legs, spot, vol, { nSpot: 24, nIv: 18 }),
    [legs, spot, vol],
  );
  if (!grid) return null;

  const spotI = nearestIndex(grid.spots, grid.spot);
  const preJ = nearestIndex(grid.ivs, grid.preIv);
  const postJ = nearestIndex(grid.ivs, grid.postIv);
  const pre = grid.pnl[preJ]![spotI]!;
  const post = grid.pnl[postJ]![spotI]!;
  const crush = post - pre;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Readout
        label="Spot range"
        value={`${formatPrice(grid.spots[0]!, 0)} – ${formatPrice(grid.spots[grid.spots.length - 1]!, 0)}`}
      />
      <Readout
        label="IV range"
        value={`${(grid.ivs[0]! * 100).toFixed(0)}% – ${(grid.ivs[grid.ivs.length - 1]! * 100).toFixed(0)}%`}
      />
      <Readout
        label="P&L range"
        value={`${compactMoney(grid.minPnl)} – ${compactMoney(grid.maxPnl)}`}
      />
      <Readout
        label="Crush Δ @ spot"
        value={formatMoney(crush, { signed: true })}
        tone={crush >= 0 ? "profit" : "loss"}
      />
      <Readout
        label="Pre @ spot"
        value={formatMoney(pre, { signed: true })}
        tone={pre >= 0 ? "profit" : "loss"}
      />
      <Readout
        label="Post @ spot"
        value={formatMoney(post, { signed: true })}
        tone={post >= 0 ? "profit" : "loss"}
      />
      <Readout label="Pre IV" value={`${(grid.preIv * 100).toFixed(1)}%`} />
      <Readout label="Post IV" value={`${(grid.postIv * 100).toFixed(1)}%`} />
    </div>
  );
}

function Readout({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss";
}) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/30 px-2.5 py-2">
      <div className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </div>
      <div
        className={`font-tabular mt-0.5 text-sm font-semibold ${
          tone === "profit"
            ? "text-profit"
            : tone === "loss"
              ? "text-loss"
              : "text-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export function PnlSurface3D({ legs, spot, vol, volOk }: PnlSurface3DProps) {
  const [active, setActive] = useState(true);
  const { theme } = useTheme();
  const dark = theme === "dark";
  const bg = dark ? "#0e1620" : "#eef2f4";

  if (legs.length === 0) {
    return (
      <div className="panel flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center">
        <h2 className="font-heading text-xl font-semibold text-ink">
          3D mark surface
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Load a strategy to explore mark P&L as a surface over spot and implied
          vol — with numeric axes for Spot, IV, and P&L.
        </p>
      </div>
    );
  }

  if (!volOk) {
    return (
      <div className="panel flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center">
        <h2 className="font-heading text-xl font-semibold text-ink">
          3D surface unavailable
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Enter a positive IV and days to expiry to render the Spot × IV × P&L
          surface.
        </p>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">
            3D mark surface
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Drag to orbit. Axis ticks show Spot, IV%, and P&L. Callouts pin
            pre/post crush values at reference spot.
          </p>
        </div>
        <button
          type="button"
          className="text-xs font-medium text-teal underline-offset-2 hover:underline"
          onClick={() => setActive((v) => !v)}
        >
          {active ? "Pause render" : "Resume render"}
        </button>
      </div>

      <div
        className="relative h-[360px] w-full sm:h-[420px]"
        style={{
          background: `linear-gradient(180deg, ${bg} 0%, ${dark ? "#121a24" : "#e2e9ef"} 100%)`,
        }}
      >
        {active ? (
          <Canvas
            camera={{ position: [5.4, 3.4, 6.0], fov: 42 }}
            dpr={[1, 1.75]}
            gl={{ antialias: true, alpha: true }}
          >
            <color attach="background" args={[bg]} />
            <SurfaceMesh legs={legs} spot={spot} vol={vol} dark={dark} />
            <OrbitControls
              enablePan={false}
              minDistance={4}
              maxDistance={14}
              maxPolarAngle={Math.PI * 0.48}
              autoRotate
              autoRotateSpeed={0.45}
            />
          </Canvas>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Render paused — resume to orbit the surface.
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-border/70 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-ink" />
            Pre-event IV {(vol.iv * 100).toFixed(0)}%
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-teal" />
            Post-crush {(vol.iv * (1 - vol.crushPct) * 100).toFixed(0)}%
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-sm bg-gradient-to-r from-loss via-graphite/40 to-profit" />
            Loss → Profit
          </span>
        </div>
        <NumericReadout legs={legs} spot={spot} vol={vol} />
      </div>
    </div>
  );
}
