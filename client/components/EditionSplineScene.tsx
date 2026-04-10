import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  FontLoader,
  type Font,
} from "three/examples/jsm/loaders/FontLoader.js";
import {
  TextGeometry,
  type TextGeometryParameters,
} from "three/examples/jsm/geometries/TextGeometry.js";
import SplineLoader from "@splinetool/loader";
import Hls from "hls.js";
import { Button } from "@/components/ui/button";
import { FilterStyleButton } from "@/components/ui/filter-style-button";
import { cn } from "@/lib/utils";
import { getTeamCrest } from "@/lib/teams";
import { Volume2 } from "lucide-react";

type Mode = "front" | "back" | "rotate" | "video";

export interface EditionSplineSceneProps {
  className?: string;
  overlayUrl?: string | null;
  sceneUrl?: string | null;
  font?: Font | null;
  fontUrl?: string | null;
  textGeometryClass?: typeof TextGeometry;
  playerName?: string | null;
  productName?: string | null;
  minted?: string | number | null;
  seriesName?: string | null;
  tierValue?: string | number | null;
  playDescription?: string | null;
  setName?: string | null;
  finalScore?: string | null;
  gameDate?: string | null;
  statValue1?: string | number | null;
  statValue2?: string | number | null;
  statValue3?: string | number | null;
  statValue4?: string | number | null;
  statValue5?: string | number | null;
  statName1?: string | null;
  statName2?: string | null;
  statName3?: string | null;
  statName4?: string | null;
  statName5?: string | null;
  badge1?: string | null;
  badge2?: string | null;
  badge3?: string | null;
  team?: string | null;
  serialNumber?: string | number | null;
  owner_name?: string | null;
  showControls?: boolean;
  isQueueCarousel?: boolean;
  edition_id?: number | null;
  forceSerialMode?: boolean;
  cameraZ?: number | null;
  autoPlay?: boolean;
  isInTrophyCase?: boolean;
  onRefetchMissingData?: () => Promise<void>;
  lowAsk?: string | null;
  highOffer?: string | null;
  rollingMedianSale?: string | null;
  isSnapshot?: boolean;
  activeListingsCount?: number | null;
  stakedCount?: number | null;
  inPacksCount?: number | null;
  redeemedCount?: number | null;
  showBackgroundImage?: boolean; // Default false, only enable on edition_detail page
}

export const EDITION_FONT_URL =
  "https://threejs.org/examples/fonts/helvetiker_regular.typeface.json";

const TEXT_TARGET_NAMES = [
  "PlayerName",
  "Description",
  "TeamScore",
  "PlayerStatValue1",
  "PlayerStatValue2",
  "PlayerStatValue3",
  "PlayerStatValue4",
  "PlayerStatValue5",
  "SetName",
  "YearMinted",
  "Series",
  "ProductName",
  "MintedFront",
  "SerialFront",
  "Tier",
  "PlayerStat1",
  "PlayerStat2",
  "PlayerStat3",
  "PlayerStat4",
  "PlayerStat5",
] as const;

const CASE_SENSITIVE_TEXT_TARGETS = new Set<(typeof TEXT_TARGET_NAMES)[number]>(
  [
    "ProductName",
    "MintedFront",
    "SerialFront",
    "Series",
    "Tier",
    "Description",
    "SetName",
    "TeamScore",
  ],
);

const TEXT_CONTENT_OVERRIDES: Partial<
  Record<(typeof TEXT_TARGET_NAMES)[number], string>
> = {
  PlayerName: "",
  ProductName: "",
  SerialFront: "1",
  MintedFront: "",
  Series: "",
  Tier: "",
  Description: "",
  SetName: "",
  TeamScore: "",
};

interface TextBoundingBoxDimensions {
  width: number;
  height: number;
  depth: number;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  wireframeOffset: THREE.Vector3;
  textColor?: THREE.ColorRepresentation;
  wireframeColor?: THREE.ColorRepresentation;
  geometryOptions?: Partial<TextGeometryParameters>;
  alignment?: "center" | "left" | "right";
  fontSize?: number;
  wrapText?: boolean;
  showBoundingBox?: boolean;
}

const STEP2_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 235,
  height: 22,
  depth: 2,
  position: new THREE.Vector3(0, 145, 7),
  rotation: new THREE.Euler(0, 0, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
};

const PLAYER_NAME_BACK_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 235,
  height: 22,
  depth: 2,
  position: new THREE.Vector3(0, 145, -10),
  rotation: new THREE.Euler(0, Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
};

const PRODUCT_NAME_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 235,
  height: 8,
  depth: 1,
  position: new THREE.Vector3(0, 170, 7),
  rotation: new THREE.Euler(0, 0, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
};

const PRODUCT_NAME_BACK_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 235,
  height: 8,
  depth: 1,
  position: new THREE.Vector3(0, 170, -10),
  rotation: new THREE.Euler(0, Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
};

const SERIAL_FRONT_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 22,
  height: 9,
  depth: 3,
  position: new THREE.Vector3(-25.6, 78.33, 0.75),
  rotation: new THREE.Euler(0, 0, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
  textColor: 0xffffff,
};

const SERIAL_BACK_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 22,
  height: 9,
  depth: 2,
  position: new THREE.Vector3(23.11, 77.33, -20),
  rotation: new THREE.Euler(0, Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
  textColor: 0x111111,
};

const REDEEMED_COUNT_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 26,
  height: 10,
  depth: 1,
  position: new THREE.Vector3(31.76, 35.2, -10),
  rotation: new THREE.Euler(0, Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
  textColor: 0x767676,
  alignment: "right",
};

const STAKED_COUNT_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 26,
  height: 10,
  depth: 1,
  position: new THREE.Vector3(31.76, 50.2, -10),
  rotation: new THREE.Euler(0, Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
  textColor: 0x767676,
  alignment: "right",
};

const SALE_COUNT_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 26,
  height: 10,
  depth: 1,
  position: new THREE.Vector3(31.76, 65.2, -10),
  rotation: new THREE.Euler(0, Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
  textColor: 0x767676,
  alignment: "right",
};

const UNLISTED_COUNT_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 26,
  height: 10,
  depth: 1,
  position: new THREE.Vector3(31.76, 80.2, -10),
  rotation: new THREE.Euler(0, Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
  textColor: 0x767676,
  alignment: "right",
};

const IN_PACKS_COUNT_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 26,
  height: 10,
  depth: 1,
  position: new THREE.Vector3(31.76, 95.2, -10),
  rotation: new THREE.Euler(0, Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
  textColor: 0x767676,
  alignment: "right",
};

const LOW_ASK_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 60,
  height: 22,
  depth: 1,
  position: new THREE.Vector3(75, 4, -10),
  rotation: new THREE.Euler(0, -Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
  textColor: 0x767676,
};

const HIGH_OFFER_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 60,
  height: 22,
  depth: 1,
  position: new THREE.Vector3(0, 4, -10),
  rotation: new THREE.Euler(0, -Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
  textColor: 0x767676,
};

const MEDIAN_SALE_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 60,
  height: 22,
  depth: 1,
  position: new THREE.Vector3(-75, 4, -10),
  rotation: new THREE.Euler(0, -Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
  textColor: 0x767676,
};

const TEAM_SCORE_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 225,
  height: 16,
  depth: 1,
  position: new THREE.Vector3(0, -65, -10),
  rotation: new THREE.Euler(0, Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
  textColor: 0x767676,
};

const REMAINING_COUNT_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 25,
  height: 9,
  depth: 2,
  position: new THREE.Vector3(-12.89, 115, -10),
  rotation: new THREE.Euler(0, Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
};

const GAME_DATE_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 121,
  height: 8,
  depth: 2,
  position: new THREE.Vector3(-52, -43.3, -10),
  rotation: new THREE.Euler(0, Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
  alignment: "right",
};

const STAT_VALUE1_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 36,
  height: 18,
  depth: 1,
  position: new THREE.Vector3(98, -125, -10),
  rotation: new THREE.Euler(0, Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
  textColor: 0x767676,
};

const STAT_VALUE2_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 36,
  height: 18,
  depth: 1,
  position: new THREE.Vector3(48, -125, -10),
  rotation: new THREE.Euler(0, Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
  textColor: 0x767676,
};

const STAT_VALUE3_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 36,
  height: 18,
  depth: 1,
  position: new THREE.Vector3(-2, -125, -10),
  rotation: new THREE.Euler(0, Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
  textColor: 0x767676,
};

const STAT_VALUE4_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 36,
  height: 18,
  depth: 1,
  position: new THREE.Vector3(-52, -125, -10),
  rotation: new THREE.Euler(0, Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
  textColor: 0x767676,
};

const STAT_VALUE5_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 36,
  height: 18,
  depth: 3,
  position: new THREE.Vector3(-102, -125, -10),
  rotation: new THREE.Euler(0, Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
  textColor: 0x767676,
};

const STAT_NAME1_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 36,
  height: 8,
  depth: 2,
  position: new THREE.Vector3(98, -143, -10),
  rotation: new THREE.Euler(0, Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
};

const STAT_NAME2_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 36,
  height: 8,
  depth: 2,
  position: new THREE.Vector3(48, -143, -10),
  rotation: new THREE.Euler(0, Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
};

const STAT_NAME3_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 36,
  height: 8,
  depth: 2,
  position: new THREE.Vector3(-2, -143, -10),
  rotation: new THREE.Euler(0, Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
};

const STAT_NAME4_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 36,
  height: 8,
  depth: 2,
  position: new THREE.Vector3(-52, -143, -10),
  rotation: new THREE.Euler(0, Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
};

const STAT_NAME5_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 36,
  height: 8,
  depth: 2,
  position: new THREE.Vector3(-102, -143, -10),
  rotation: new THREE.Euler(0, Math.PI, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
};

const MINTED_FRONT_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 22,
  height: 9,
  depth: 3,
  position: new THREE.Vector3(8.32, 78.33, 0.75),
  rotation: new THREE.Euler(0, 0, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
  textColor: 0xffffff,
};

const SERIES_NAME_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 121,
  height: 12,
  depth: 2,
  position: new THREE.Vector3(-59, -65, 5.75),
  rotation: new THREE.Euler(0, 0, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
  alignment: "left",
};

const TIER_NAME_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 121,
  height: 12,
  depth: 2,
  position: new THREE.Vector3(59, -65, 5.75),
  rotation: new THREE.Euler(0, 0, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
  alignment: "right",
};

const DESCRIPTION_TEXT_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 235,
  height: 65,
  depth: 1,
  position: new THREE.Vector3(-0.5, -110, 5.75),
  rotation: new THREE.Euler(0, 0, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
  textColor: 0x454545,
  fontSize: 9,
  wrapText: true,
};

const SET_NAME_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 235,
  height: 12,
  depth: 2,
  position: new THREE.Vector3(0, -160, 5.75),
  rotation: new THREE.Euler(0, 0, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0),
};

const OWNED_CALLOUT_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 82,
  height: 15,
  depth: 1,
  position: new THREE.Vector3(0, 0, 0),
  rotation: new THREE.Euler(0, 0, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0.01),
  alignment: "left",
  textColor: 0x000000,
};

const OWNED_CALLOUT_POSITION = new THREE.Vector3(-79, -44, 5.75);
const OWNED_CALLOUT_BOUNDING_BOX_KEY = "ownedCalloutBoundingBox";

const OWNER_NAME_DIMENSIONS: TextBoundingBoxDimensions = {
  width: 155,
  height: 13,
  depth: 2,
  position: new THREE.Vector3(0, 0, 0),
  rotation: new THREE.Euler(0, 0, 0),
  wireframeOffset: new THREE.Vector3(0, 0, 0.01),
  alignment: "left",
  textColor: 0x000000,
};

const OWNER_NAME_POSITION = new THREE.Vector3(38, -43, 5.75);
const OWNER_NAME_BOUNDING_BOX_KEY = "ownerNameBoundingBox";

const DEFAULT_SCENE_URL =
  "https://prod.spline.design/ICsisAolXUu71e1o/scene.splinecode";

export const fontCache = new Map<string, Promise<Font> | Font>();

export const loadFont = (url: string) => {
  const cached = fontCache.get(url);
  if (cached) {
    if (cached instanceof Promise) {
      return cached;
    }
    return Promise.resolve(cached);
  }
  const loader = new FontLoader();
  const promise = loader.loadAsync(url).then((font) => {
    fontCache.set(url, font);
    return font;
  });
  fontCache.set(url, promise);
  return promise;
};

const BADGE_BOUNDING_SIZE = 25;
const BADGE_BOUNDING_DEPTH = 0;

const createRhombusMaskTexture = (options?: {
  size?: number;
  coverage?: number;
  backgroundValue?: number;
  fillValue?: number;
  maxShapes?: number;
}) => {
  if (typeof document === "undefined") {
    return null;
  }
  const size = Math.max(1, Math.floor(options?.size ?? 512));
  const coverage = Math.min(Math.max(options?.coverage ?? 0.1, 0), 1);
  const background = Math.min(Math.max(options?.backgroundValue ?? 0, 0), 1);
  const fill = Math.min(Math.max(options?.fillValue ?? 1, 0), 1);
  const maxShapes = Math.max(1, Math.floor(options?.maxShapes ?? 240));

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const toStyle = (value: number) => {
    const intensity = Math.round(value * 255);
    return `rgba(${intensity}, ${intensity}, ${intensity}, 1)`;
  };

  ctx.fillStyle = toStyle(background);
  ctx.fillRect(0, 0, size, size);

  const totalArea = size * size;
  const targetArea = totalArea * coverage;
  let accumulatedArea = 0;
  let shapesDrawn = 0;
  let attempts = 0;
  const maxAttempts = maxShapes * 10;

  while (accumulatedArea < targetArea && attempts < maxAttempts) {
    attempts += 1;
    const halfWidth = size * (0.004 + Math.random() * 0.012);
    const halfHeight = size * (0.004 + Math.random() * 0.012);
    const centerX = Math.random() * size;
    const centerY = Math.random() * size;

    ctx.fillStyle = toStyle(fill);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - halfHeight);
    ctx.lineTo(centerX + halfWidth, centerY);
    ctx.lineTo(centerX, centerY + halfHeight);
    ctx.lineTo(centerX - halfWidth, centerY);
    ctx.closePath();
    ctx.fill();

    accumulatedArea += 2 * halfWidth * halfHeight;
    shapesDrawn += 1;
    if (shapesDrawn >= maxShapes) {
      break;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  if ((THREE as any).NoColorSpace !== undefined) {
    (texture as any).colorSpace = (THREE as any).NoColorSpace;
  } else if ((texture as any).colorSpace !== undefined) {
    (texture as any).colorSpace = (THREE as any).LinearSRGBColorSpace;
  } else if ((texture as any).encoding !== undefined) {
    (texture as any).encoding =
      (THREE as any).LinearEncoding ?? THREE.LinearEncoding;
  }
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return texture;
};

const fontCharWidthCache = new WeakMap<Font, Map<string, number>>();

const getFontResolution = (font: Font) => {
  const resolution = Number((font as any)?.data?.resolution);
  return Number.isFinite(resolution) && resolution > 0 ? resolution : 1024;
};

const getCharWidthUnits = (font: Font, char: string): number => {
  let cache = fontCharWidthCache.get(font);
  if (!cache) {
    cache = new Map<string, number>();
    fontCharWidthCache.set(font, cache);
  }
  if (cache.has(char)) {
    return cache.get(char)!;
  }
  if (char === "\n" || char === "\r") {
    cache.set(char, 0);
    return 0;
  }
  if (char === "\t") {
    const tabWidth = getCharWidthUnits(font, " ") * 4;
    cache.set(char, tabWidth);
    return tabWidth;
  }
  const data = (font as any)?.data ?? {};
  const glyphs = data.glyphs ?? {};
  const resolution = getFontResolution(font);

  let glyph =
    glyphs[char] ??
    glyphs[char.toUpperCase()] ??
    glyphs[char.toLowerCase()] ??
    null;

  if (!glyph && char === "\u00a0") {
    glyph = glyphs[" "] ?? glyphs.space ?? null;
  }

  if (!glyph) {
    glyph = glyphs[" "] ?? glyphs.space ?? glyphs["0"] ?? glyphs["O"] ?? null;
  }

  let advance = Number(glyph?.ha);
  if (!Number.isFinite(advance) || advance <= 0) {
    const fallback =
      glyphs["0"] ?? glyphs["A"] ?? glyphs["a"] ?? glyphs["?"] ?? null;
    const fallbackAdvance = Number(fallback?.ha);
    if (Number.isFinite(fallbackAdvance) && fallbackAdvance > 0) {
      advance = fallbackAdvance;
    } else if (
      data.boundingBox &&
      Number.isFinite(data.boundingBox.maxX) &&
      Number.isFinite(data.boundingBox.minX)
    ) {
      advance = Math.max(
        Number(data.boundingBox.maxX) - Number(data.boundingBox.minX),
        1,
      );
    } else {
      advance = resolution * 0.6;
    }
  }

  const widthUnits = Math.max(advance / resolution, 0);
  cache.set(char, widthUnits);
  return widthUnits;
};

const measureFontTextWidth = (
  font: Font,
  text: string,
  size: number,
): number => {
  if (!text) {
    return 0;
  }
  const effectiveSize = size > 0 ? size : 1;
  let maxWidth = 0;
  let currentWidth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "\n") {
      if (currentWidth > maxWidth) {
        maxWidth = currentWidth;
      }
      currentWidth = 0;
      continue;
    }
    if (char === "\r") {
      continue;
    }
    currentWidth += getCharWidthUnits(font, char) * effectiveSize;
  }
  if (currentWidth > maxWidth) {
    maxWidth = currentWidth;
  }
  return maxWidth;
};

const wrapTextToWidth = (
  font: Font,
  text: string,
  size: number,
  maxWidth: number,
): string => {
  if (!text) {
    return "";
  }
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) {
    return text;
  }
  const effectiveSize = size > 0 ? size : 1;
  const rawSpaceWidth = getCharWidthUnits(font, " ") * effectiveSize;
  const spaceWidth = rawSpaceWidth > 0 ? rawSpaceWidth : effectiveSize * 0.25;
  const paragraphs = text.split(/\r?\n/g);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/g).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let currentLine = "";
    let currentWidth = 0;
    for (const word of words) {
      const wordWidth = measureFontTextWidth(font, word, effectiveSize);
      if (!currentLine) {
        currentLine = word;
        currentWidth = wordWidth;
        if (currentWidth > maxWidth) {
          lines.push(currentLine);
          currentLine = "";
          currentWidth = 0;
        }
        continue;
      }
      const projectedWidth = currentWidth + spaceWidth + wordWidth;
      if (projectedWidth > maxWidth) {
        lines.push(currentLine);
        currentLine = word;
        currentWidth = wordWidth;
      } else {
        currentLine = `${currentLine} ${word}`;
        currentWidth = projectedWidth;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines.join("\n");
};

const getBadgeImageUrl = (badgeValue: string | null | undefined): string => {
  if (!badgeValue) return "";
  const normalizedValue = String(badgeValue).toUpperCase();
  switch (normalizedValue) {
    case "CP":
      return "/images/CP_badge_white.webp";
    case "CY":
      return "/images/CY_badge_white.webp";
    case "RY":
      return "/images/RY_badge_white.webp";
    default:
      return "";
  }
};

export default function EditionSplineScene({
  className,
  overlayUrl,
  sceneUrl,
  font,
  fontUrl,
  textGeometryClass,
  playerName,
  productName,
  minted,
  seriesName,
  tierValue,
  playDescription,
  setName,
  finalScore,
  gameDate,
  lowAsk,
  highOffer,
  rollingMedianSale,
  statValue1,
  statValue2,
  statValue3,
  statValue4,
  statValue5,
  statName1,
  statName2,
  statName3,
  statName4,
  statName5,
  badge1,
  badge2,
  badge3,
  team,
  serialNumber,
  owner_name,
  showControls = true,
  isQueueCarousel = false,
  edition_id = null,
  forceSerialMode = false,
  cameraZ = null,
  autoPlay = true,
  isInTrophyCase = false,
  onRefetchMissingData,
  isSnapshot = false,
  activeListingsCount = null,
  stakedCount = null,
  inPacksCount = null,
  redeemedCount = null,
  showBackgroundImage = false,
}: EditionSplineSceneProps) {
  const [isDarkMode, setIsDarkMode] = useState(
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const snapshotMode = useMemo(() => {
    if (isSnapshot) return true;
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("snapshot") === "true";
  }, [isSnapshot]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<Mode>("front");
  const [loading, setLoading] = useState(true);
  const [barInitCounter, setBarInitCounter] = useState(0); // Trigger bar width updates after creation
  const cardRef = useRef<THREE.Object3D | null>(null);
  const splineSceneRef = useRef<THREE.Object3D | null>(null);
  const [fallbackFont, setFallbackFont] = useState<Font | null>(null);
  const rotateLoopRef = useRef(false);
  const rotateStartRef = useRef(0);
  const rotateBaseRef = useRef(0);
  const rotateDurationRef = useRef(32000);
  const tweenRef = useRef<null | {
    start: number;
    from: number;
    to: number;
    duration: number;
    easing: (t: number) => number;
  }>(null);
  const overlayVideoRef = useRef<HTMLVideoElement | null>(null);
  const overlayHlsRef = useRef<Hls | null>(null);
  const tmpV3Ref = useRef(new THREE.Vector3());
  const tmpV3bRef = useRef(new THREE.Vector3());
  const highlightVideoTextureRef = useRef<THREE.VideoTexture | null>(null);
  const highlightMeshRef = useRef<THREE.Mesh | null>(null);
  const highlightVideoControlRef = useRef<{
    video: HTMLVideoElement;
    freeze: () => void;
    midTime: number | null;
    shouldStayFrozen: boolean;
  } | null>(null);
  const glassMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const glassBaseColorRef = useRef<THREE.Color | null>(null);
  const rainbowColorRef = useRef(new THREE.Color());
  const tmpColorRef = useRef(new THREE.Color());
  const textMaterialCacheRef = useRef<Map<string, THREE.MeshBasicMaterial>>(
    new Map(),
  );
  const hiddenTextMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const replaceSceneTextTargetsRef = useRef<(() => void) | null>(null);
  const scheduleBackTextRepairRef = useRef<(() => void) | null>(null);
  const repairInProgressRef = useRef(false);

  const [isFirefoxMobile, setIsFirefoxMobile] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [textApplyTick, setTextApplyTick] = useState(0);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent || "";
    const isFxiOS = /FxiOS/i.test(ua);
    const isFirefoxAndroid = /Android/i.test(ua) && /Firefox/i.test(ua);
    const isMobileFirefox =
      isFxiOS ||
      isFirefoxAndroid ||
      (/Mobile/i.test(ua) && /Firefox/i.test(ua));
    setIsFirefoxMobile(isMobileFirefox);
  }, []);

  const currentPathname =
    typeof window !== "undefined" ? window.location.pathname : "";
  const isSerialPage = forceSerialMode || currentPathname.includes("serial");
  const ownedCalloutText = isSerialPage ? "Owned by: " : "";
  const ownerNameText = isSerialPage && owner_name ? owner_name : "";

  const resolveColorInfo = useCallback(
    (input?: THREE.ColorRepresentation) => {
      const fallback = input ?? 0x000000;
      if (typeof fallback === "number") {
        return {
          key: fallback.toString(16).padStart(6, "0"),
          hex: fallback,
        };
      }
      const temp = tmpColorRef.current;
      if (fallback instanceof THREE.Color) {
        temp.copy(fallback);
      } else {
        temp.set(fallback);
      }
      return {
        key: temp.getHexString(),
        hex: temp.getHex(),
      };
    },
    [tmpColorRef],
  );

  const getSharedTextMaterial = useCallback(
    (color?: THREE.ColorRepresentation) => {
      const { key, hex } = resolveColorInfo(color);
      const cache = textMaterialCacheRef.current;
      let material = cache.get(key);
      if (!material) {
        material = new THREE.MeshBasicMaterial({
          color: hex,
          side: THREE.DoubleSide,
        });
        cache.set(key, material);
      }
      return material;
    },
    [resolveColorInfo],
  );

  const getHiddenTextMaterial = useCallback(() => {
    if (!hiddenTextMaterialRef.current) {
      hiddenTextMaterialRef.current = new THREE.MeshBasicMaterial({
        visible: false,
        side: THREE.DoubleSide,
      });
    }
    return hiddenTextMaterialRef.current;
  }, []);

  const isSharedTextMaterial = useCallback(
    (material: THREE.Material | null | undefined) => {
      if (!material) {
        return false;
      }
      if (
        hiddenTextMaterialRef.current &&
        material === hiddenTextMaterialRef.current
      ) {
        return true;
      }
      for (const shared of textMaterialCacheRef.current.values()) {
        if (material === shared) {
          return true;
        }
      }
      return false;
    },
    [],
  );

  const disposeMaterialIfUnshared = useCallback(
    (material?: THREE.Material | THREE.Material[] | null) => {
      if (!material) {
        return;
      }
      if (Array.isArray(material)) {
        material.forEach((mat) => {
          if (mat && !isSharedTextMaterial(mat)) {
            (mat as any)?.dispose?.();
          }
        });
        return;
      }
      if (!isSharedTextMaterial(material)) {
        (material as any)?.dispose?.();
      }
    },
    [isSharedTextMaterial],
  );

  const redeemedCountMeshRef = useRef<THREE.Mesh | null>(null);
  const stakedCountMeshRef = useRef<THREE.Mesh | null>(null);
  const saleCountMeshRef = useRef<THREE.Mesh | null>(null);
  const unlistedCountMeshRef = useRef<THREE.Mesh | null>(null);
  const inPacksCountMeshRef = useRef<THREE.Mesh | null>(null);
  const lowAskMeshRef = useRef<THREE.Mesh | null>(null);
  const highOfferMeshRef = useRef<THREE.Mesh | null>(null);
  const medianSaleMeshRef = useRef<THREE.Mesh | null>(null);
  const teamScoreMeshRef = useRef<THREE.Mesh | null>(null);
  const remainingCountMeshRef = useRef<THREE.Mesh | null>(null);
  const gameDateMeshRef = useRef<THREE.Mesh | null>(null);
  const statValue1MeshRef = useRef<THREE.Mesh | null>(null);
  const statValue2MeshRef = useRef<THREE.Mesh | null>(null);
  const statValue3MeshRef = useRef<THREE.Mesh | null>(null);
  const statValue4MeshRef = useRef<THREE.Mesh | null>(null);
  const statValue5MeshRef = useRef<THREE.Mesh | null>(null);
  const statName1MeshRef = useRef<THREE.Mesh | null>(null);
  const statName2MeshRef = useRef<THREE.Mesh | null>(null);
  const statName3MeshRef = useRef<THREE.Mesh | null>(null);
  const statName4MeshRef = useRef<THREE.Mesh | null>(null);
  const statName5MeshRef = useRef<THREE.Mesh | null>(null);

  // RMV fetch state for metrics
  const [fetchedRmvLowAsk, setFetchedRmvLowAsk] = useState<string | null>(null);
  const [fetchedRmvHighOffer, setFetchedRmvHighOffer] = useState<string | null>(null);
  const [fetchedRmvMedianSale, setFetchedRmvMedianSale] = useState<string | null>(null);

  // Bar refs for dynamic width updates
  const inPacksBarRef = useRef<THREE.Mesh | null>(null);
  const unlistedBarRef = useRef<THREE.Mesh | null>(null);
  const forSaleBarRef = useRef<THREE.Mesh | null>(null);
  const stakedBarRef = useRef<THREE.Mesh | null>(null);
  const redeemedBarRef = useRef<THREE.Mesh | null>(null);

  const resolvedSceneUrl = sceneUrl ?? DEFAULT_SCENE_URL;
  const resolvedFontUrl = fontUrl ?? EDITION_FONT_URL;

  const resolvedOverlayUrl = useMemo(
    () => overlayUrl ?? undefined,
    [overlayUrl],
  );
  const textGeometryCtor = textGeometryClass ?? TextGeometry;
  const effectiveFont = font ?? fallbackFont;
  const dynamicTextOverrides = useMemo(() => {
    const overrides: Partial<
      Record<(typeof TEXT_TARGET_NAMES)[number], string>
    > = {
      ...TEXT_CONTENT_OVERRIDES,
    };
    if (playerName && playerName.trim().length > 0) {
      overrides.PlayerName = playerName;
    }
    if (productName && productName.trim().length > 0) {
      overrides.ProductName = productName;
    }
    if (minted !== null && minted !== undefined) {
      const mintedStr = String(minted);
      overrides.MintedFront = mintedStr.trim().length > 0 ? mintedStr : "";
    }
    if (seriesName && seriesName.trim().length > 0) {
      overrides.Series = seriesName;
    }
    if (serialNumber !== null && serialNumber !== undefined) {
      const ss = String(serialNumber);
      overrides.SerialFront = ss.trim().length > 0 ? ss : "";
    }
    if (tierValue !== null && tierValue !== undefined) {
      const tierStr = String(tierValue);
      overrides.Tier = tierStr.trim().length > 0 ? tierStr : "";
    }
    if (playDescription && playDescription.trim().length > 0) {
      overrides.Description = playDescription;
    }
    if (setName && setName.trim().length > 0) {
      overrides.SetName = setName;
    }
    if (finalScore !== null && finalScore !== undefined) {
      const finalScoreStr = String(finalScore);
      if (finalScoreStr.trim().length > 0) {
        overrides.TeamScore = finalScoreStr;
      }
    }
    if (gameDate && gameDate.trim && gameDate.trim().length > 0) {
      overrides.YearMinted = gameDate;
    } else if (gameDate && String(gameDate).length > 0) {
      overrides.YearMinted = String(gameDate);
    }
    if (statValue1 !== null && statValue1 !== undefined) {
      const val = String(statValue1).trim();
      if (val.length > 0) {
        overrides.PlayerStatValue1 = val;
      }
    }
    if (statValue2 !== null && statValue2 !== undefined) {
      const val = String(statValue2).trim();
      if (val.length > 0) {
        overrides.PlayerStatValue2 = val;
      }
    }
    if (statValue3 !== null && statValue3 !== undefined) {
      const val = String(statValue3).trim();
      if (val.length > 0) {
        overrides.PlayerStatValue3 = val;
      }
    }
    if (statValue4 !== null && statValue4 !== undefined) {
      const val = String(statValue4).trim();
      if (val.length > 0) {
        overrides.PlayerStatValue4 = val;
      }
    }
    if (statValue5 !== null && statValue5 !== undefined) {
      const val = String(statValue5).trim();
      if (val.length > 0) {
        overrides.PlayerStatValue5 = val;
      }
    }
    if (statName1 && statName1.trim && statName1.trim().length > 0) {
      overrides.PlayerStat1 = statName1;
    } else if (statName1 && String(statName1).length > 0) {
      overrides.PlayerStat1 = String(statName1);
    }
    if (statName2 && statName2.trim && statName2.trim().length > 0) {
      overrides.PlayerStat2 = statName2;
    } else if (statName2 && String(statName2).length > 0) {
      overrides.PlayerStat2 = String(statName2);
    }
    if (statName3 && statName3.trim && statName3.trim().length > 0) {
      overrides.PlayerStat3 = statName3;
    } else if (statName3 && String(statName3).length > 0) {
      overrides.PlayerStat3 = String(statName3);
    }
    if (statName4 && statName4.trim && statName4.trim().length > 0) {
      overrides.PlayerStat4 = statName4;
    } else if (statName4 && String(statName4).length > 0) {
      overrides.PlayerStat4 = String(statName4);
    }
    if (statName5 && statName5.trim && statName5.trim().length > 0) {
      overrides.PlayerStat5 = statName5;
    } else if (statName5 && String(statName5).length > 0) {
      overrides.PlayerStat5 = String(statName5);
    }
    return overrides;
  }, [
    playerName,
    productName,
    minted,
    seriesName,
    tierValue,
    playDescription,
    setName,
    finalScore,
    serialNumber,
    gameDate,
    statValue1,
    statValue2,
    statValue3,
    statValue4,
    statValue5,
    statName1,
    statName2,
    statName3,
    statName4,
    statName5,
  ]);

  const easeInOutCubic = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const normalizeAngle = (a: number) => {
    let x = a % (Math.PI * 2);
    if (x < 0) x += Math.PI * 2;
    return x;
  };
  const shortestDelta = (from: number, to: number) => {
    const twoPi = Math.PI * 2;
    let d = (to - from) % twoPi;
    if (d > Math.PI) d -= twoPi;
    if (d < -Math.PI) d += twoPi;
    return d;
  };

  const startTweenTo = (
    targetY: number,
    duration: number,
    easing: (t: number) => number,
  ) => {
    rotateLoopRef.current = false;
    if (!cardRef.current) return;
    const from = normalizeAngle((cardRef.current as any).rotation.y || 0);
    const to = normalizeAngle(targetY);
    const delta = shortestDelta(from, to);
    tweenRef.current = {
      start: performance.now(),
      from,
      to: from + delta,
      duration,
      easing,
    };
  };

  const tweenToAndWait = (
    targetY: number,
    duration: number,
    easing: (t: number) => number,
  ) => {
    if (!cardRef.current) {
      rotateLoopRef.current = false;
      return Promise.resolve();
    }
    startTweenTo(targetY, duration, easing);
    if (!tweenRef.current) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const check = () => {
        if (!tweenRef.current) {
          resolve();
        } else {
          requestAnimationFrame(check);
        }
      };
      requestAnimationFrame(check);
    });
  };

  const disposeChildMesh = useCallback((child: THREE.Object3D) => {
    const mesh = child as THREE.Mesh;
    if ((mesh as any)?.isMesh) {
      const { geometry, material } = mesh;
      if (geometry && typeof geometry.dispose === "function") {
        geometry.dispose();
      }
      if (material) {
        if (Array.isArray(material)) {
          material.forEach((mat: any) => mat?.dispose?.());
        } else {
          (material as any)?.dispose?.();
        }
      }
    }
  }, []);

  const applyTextMeshWithBoundingBox = useCallback(
    ({
      target,
      fontToUse,
      textContent,
      dimensions,
      meshName,
      boundingBoxKey,
    }: {
      target: THREE.Object3D;
      fontToUse: Font;
      textContent: string;
      dimensions: TextBoundingBoxDimensions;
      meshName: string;
      boundingBoxKey: string;
    }) => {
      target.updateWorldMatrix(true, true);
      if (!(target as any)?.isMesh) {
        return null;
      }
      const meshTarget = target as THREE.Mesh;
      const previousGeometry = meshTarget.geometry as
        | THREE.BufferGeometry
        | undefined;
      const previousMaterial = meshTarget.material as
        | THREE.Material
        | THREE.Material[]
        | undefined;
      const normalizedContent = (textContent ?? "").toString();
      if (normalizedContent.trim().length === 0) {
        const previousHelper = meshTarget.userData?.[boundingBoxKey] as
          | THREE.Object3D
          | undefined;
        if (previousHelper) {
          meshTarget.remove(previousHelper);
          const prevGeom = (previousHelper as any)?.geometry;
          const prevMat = (previousHelper as any)?.material;
          prevGeom?.dispose?.();
          prevMat?.dispose?.();
        }
        if (meshTarget.userData && boundingBoxKey in meshTarget.userData) {
          delete meshTarget.userData[boundingBoxKey];
        }

        meshTarget.name = meshName;
        meshTarget.geometry = new THREE.BufferGeometry();
        meshTarget.material = getHiddenTextMaterial();
        meshTarget.position.copy(dimensions.position);
        meshTarget.rotation.copy(dimensions.rotation);
        try {
          const twoPi = Math.PI * 2;
          const ry = ((meshTarget.rotation.y % twoPi) + twoPi) % twoPi;
          if (Math.abs(ry - Math.PI) < 1e-3 && meshTarget.position.z < 0) {
            meshTarget.position.z += 0.2;
          }
        } catch {}
        meshTarget.visible = false;

        meshTarget.userData = {
          ...(meshTarget.userData || {}),
          fontUrl: EDITION_FONT_URL,
          __rawText: normalizedContent,
          __renderedText: "",
          __fontSize: dimensions.fontSize ?? 1,
          __boxWidth: dimensions.width,
          __boxHeight: dimensions.height,
          __alignment: dimensions.alignment ?? null,
        } as Record<string, unknown>;
        (meshTarget as any).text = "";
        if (
          previousGeometry &&
          typeof previousGeometry.dispose === "function"
        ) {
          previousGeometry.dispose();
        }
        disposeMaterialIfUnshared(previousMaterial);
        return meshTarget;
      }

      // Avoid expensive geometry regeneration if text hasn't changed
      let fontSize = dimensions.fontSize ?? 1;
      if (
        meshTarget.userData?.__rawText === normalizedContent &&
        meshTarget.userData?.__fontSize === fontSize &&
        meshTarget.userData?.__boxWidth === dimensions.width &&
        meshTarget.userData?.__boxHeight === dimensions.height
      ) {
        return meshTarget;
      }
      let textForGeometry = normalizedContent;

      const baseOptions: TextGeometryParameters = {
        font: fontToUse,
        size: fontSize,
        height: dimensions.depth,
        curveSegments: 12,
        bevelEnabled: false,
      };

      const effectiveGeometryOptions =
        meshName === "player_name"
          ? (dimensions.geometryOptions ?? undefined)
          : dimensions.geometryOptions
            ? {
                ...dimensions.geometryOptions,
                bevelEnabled: false,
                bevelThickness: 0,
                bevelSize: 0,
                bevelOffset: 0,
                bevelSegments: 0,
              }
            : undefined;

      const mergeGeometryOptions = (size: number): TextGeometryParameters => ({
        ...baseOptions,
        ...(effectiveGeometryOptions ?? {}),
        font: fontToUse,
        size,
        height: dimensions.depth,
      });

      const sharedMaterial = getSharedTextMaterial(dimensions.textColor);

      const measureTextWidth = (value: string, size: number) => {
        if (!value) return 0;
        return measureFontTextWidth(fontToUse, value, size);
      };

      const wrapTextContent = (value: string, size: number) => {
        if (!dimensions.wrapText) {
          return value;
        }
        return wrapTextToWidth(fontToUse, value, size, dimensions.width);
      };

      const originalContent = normalizedContent;
      let geometry: TextGeometry | null = null;
      let attempt = 0;
      const maxAttempts = dimensions.wrapText ? 6 : 1;

      while (attempt < maxAttempts) {
        textForGeometry = wrapTextContent(originalContent, fontSize);
        try {
          geometry = new textGeometryCtor(
            textForGeometry,
            mergeGeometryOptions(fontSize),
          );
        } catch {
          geometry?.dispose();
          return null;
        }

        geometry.computeBoundingBox();
        const baseBox = geometry.boundingBox;
        if (!baseBox || baseBox.isEmpty()) {
          geometry.dispose();
          return null;
        }

        const baseWidth =
          Math.abs(baseBox.max.x - baseBox.min.x) || Number.EPSILON;
        const baseHeight =
          Math.abs(baseBox.max.y - baseBox.min.y) || Number.EPSILON;
        const scaleFactor = Math.min(
          dimensions.width / baseWidth,
          dimensions.height / baseHeight,
        );

        if (
          scaleFactor < 0.99 &&
          dimensions.wrapText &&
          attempt < maxAttempts - 1
        ) {
          geometry.dispose();
          fontSize = Math.max(fontSize * Math.max(scaleFactor, 0.5), 0.1);
          attempt += 1;
          continue;
        }

        geometry.scale(scaleFactor, scaleFactor, 1);
        break;
      }

      if (!geometry) {
        return null;
      }

      geometry.computeBoundingBox();
      const scaledBox = geometry.boundingBox;
      if (scaledBox) {
        const center = new THREE.Vector3();
        scaledBox.getCenter(center);
        let translateX = -center.x;
        if (dimensions.alignment === "left") {
          translateX = -scaledBox.min.x - dimensions.width / 2;
        } else if (dimensions.alignment === "right") {
          translateX = -scaledBox.max.x + dimensions.width / 2;
        }
        geometry.translate(translateX, -center.y, -center.z);
      }

      const previousHelper = meshTarget.userData?.[boundingBoxKey] as
        | THREE.Object3D
        | undefined;
      if (previousHelper) {
        meshTarget.remove(previousHelper);
        const prevGeom = (previousHelper as any)?.geometry;
        const prevMat = (previousHelper as any)?.material;
        prevGeom?.dispose?.();
        prevMat?.dispose?.();
      }
      if (meshTarget.userData && boundingBoxKey in meshTarget.userData) {
        delete meshTarget.userData[boundingBoxKey];
      }

      meshTarget.name = meshName;
      meshTarget.geometry = geometry;
      meshTarget.material = sharedMaterial;
      meshTarget.position.copy(dimensions.position);
      meshTarget.rotation.copy(dimensions.rotation);
      // Apply slight Z bias for back-facing text to avoid z-fighting/occlusion through glass
      try {
        const twoPi = Math.PI * 2;
        const ry = ((meshTarget.rotation.y % twoPi) + twoPi) % twoPi;
        if (Math.abs(ry - Math.PI) < 1e-3 && meshTarget.position.z < 0) {
          meshTarget.position.z += 0.2;
        }
      } catch {}
      meshTarget.visible = true;
      meshTarget.frustumCulled = false;

      // Draw thin outline for the bounding box when requested
      if (dimensions.showBoundingBox) {
        const w = dimensions.width;
        const h = dimensions.height;
        const z = (dimensions.wireframeOffset?.z ?? 0) + 0;
        const verts = new Float32Array([
          -w / 2,
          -h / 2,
          z,
          w / 2,
          -h / 2,
          z,
          w / 2,
          -h / 2,
          z,
          w / 2,
          h / 2,
          z,
          w / 2,
          h / 2,
          z,
          -w / 2,
          h / 2,
          z,
          -w / 2,
          h / 2,
          z,
          -w / 2,
          -h / 2,
          z,
        ]);
        const lineGeom = new THREE.BufferGeometry();
        lineGeom.setAttribute("position", new THREE.BufferAttribute(verts, 3));
        const lineMat = new THREE.LineBasicMaterial({
          color: (dimensions.wireframeColor as any) ?? 0xcccccc,
          transparent: true,
          opacity: 0.9,
        });
        const helper = new THREE.LineSegments(lineGeom, lineMat);
        helper.name = `${meshName}_bbox`;
        meshTarget.add(helper);
        meshTarget.userData[boundingBoxKey] = helper;
      }

      if (previousGeometry && typeof previousGeometry.dispose === "function") {
        previousGeometry.dispose();
      }
      disposeMaterialIfUnshared(previousMaterial);

      (meshTarget as any).text = textForGeometry;
      meshTarget.userData = {
        ...(meshTarget.userData || {}),
        fontUrl: EDITION_FONT_URL,
        __rawText: normalizedContent,
        __renderedText: textForGeometry,
        __fontSize: fontSize,
        __boxWidth: dimensions.width,
        __boxHeight: dimensions.height,
        __alignment: dimensions.alignment ?? null,
      } as Record<string, unknown>;
      return meshTarget;
    },
    [
      textGeometryCtor,
      getHiddenTextMaterial,
      getSharedTextMaterial,
      disposeMaterialIfUnshared,
    ],
  );

  type SceneLinkedConfig = {
    meshName: string;
    boundingBoxKey: string;
    dimensions: TextBoundingBoxDimensions;
  };

  type SceneTextConfig = {
    meshName: string;
    boundingBoxKey: string;
    dimensions: TextBoundingBoxDimensions;
    linked?: SceneLinkedConfig;
  };

  const sceneTextConfigs = useMemo<Record<string, SceneTextConfig>>(
    () => ({
      PlayerName: {
        meshName: "player_name",
        boundingBoxKey: "step2BoundingBox",
        dimensions: STEP2_DIMENSIONS,
        linked: {
          meshName: "player_name_back",
          boundingBoxKey: "playerNameBackBoundingBox",
          dimensions: PLAYER_NAME_BACK_DIMENSIONS,
        },
      },
      ProductName: {
        meshName: "product_name",
        boundingBoxKey: "productNameBoundingBox",
        dimensions: PRODUCT_NAME_DIMENSIONS,
        linked: {
          meshName: "product_name_back",
          boundingBoxKey: "productNameBackBoundingBox",
          dimensions: PRODUCT_NAME_BACK_DIMENSIONS,
        },
      },
      SerialFront: {
        meshName: "serial_front",
        boundingBoxKey: "serialFrontBoundingBox",
        dimensions: SERIAL_FRONT_DIMENSIONS,
        linked: {
          meshName: "serial_back",
          boundingBoxKey: "serialBackBoundingBox",
          dimensions: SERIAL_BACK_DIMENSIONS,
        },
      },
      MintedFront: {
        meshName: "minted_front",
        boundingBoxKey: "mintedFrontBoundingBox",
        dimensions: MINTED_FRONT_DIMENSIONS,
      },
      Series: {
        meshName: "series_name",
        boundingBoxKey: "seriesNameBoundingBox",
        dimensions: SERIES_NAME_DIMENSIONS,
      },
      Tier: {
        meshName: "tier_name",
        boundingBoxKey: "tierNameBoundingBox",
        dimensions: TIER_NAME_DIMENSIONS,
      },
      Description: {
        meshName: "description_text",
        boundingBoxKey: "descriptionBoundingBox",
        dimensions: DESCRIPTION_TEXT_DIMENSIONS,
      },
      SetName: {
        meshName: "set_name",
        boundingBoxKey: "setNameBoundingBox",
        dimensions: SET_NAME_DIMENSIONS,
      },
    }),
    [],
  );

  const updateLinkedSceneMesh = useCallback(
    (
      frontMesh: THREE.Mesh,
      fontToUse: Font,
      textContent: string,
      linkedConfig: SceneLinkedConfig,
    ) => {
      const parent = frontMesh.parent ?? splineSceneRef.current;
      if (!parent) {
        return;
      }
      let linkedMesh = parent.getObjectByName(
        linkedConfig.meshName,
      ) as THREE.Mesh | null;
      if (!linkedMesh) {
        linkedMesh = new THREE.Mesh(
          new THREE.BufferGeometry(),
          getHiddenTextMaterial(),
        );
        linkedMesh.name = linkedConfig.meshName;
        parent.add(linkedMesh);
      }
      applyTextMeshWithBoundingBox({
        target: linkedMesh,
        fontToUse,
        textContent,
        dimensions: linkedConfig.dimensions,
        meshName: linkedConfig.meshName,
        boundingBoxKey: linkedConfig.boundingBoxKey,
      });
    },
    [applyTextMeshWithBoundingBox, getHiddenTextMaterial],
  );

  type CardMeshSpec = {
    meshName: string;
    boundingBoxKey: string;
    dimensions: TextBoundingBoxDimensions;
    ref: MutableRefObject<THREE.Mesh | null>;
  };

  const cardMeshSpecs = useMemo<CardMeshSpec[]>(
    () => [
      {
        meshName: "redeemed_count",
        boundingBoxKey: "redeemedCountBoundingBox",
        dimensions: REDEEMED_COUNT_DIMENSIONS,
        ref: redeemedCountMeshRef,
      },
      {
        meshName: "staked_count",
        boundingBoxKey: "stakedCountBoundingBox",
        dimensions: STAKED_COUNT_DIMENSIONS,
        ref: stakedCountMeshRef,
      },
      {
        meshName: "sale_count",
        boundingBoxKey: "saleCountBoundingBox",
        dimensions: SALE_COUNT_DIMENSIONS,
        ref: saleCountMeshRef,
      },
      {
        meshName: "unlisted_count",
        boundingBoxKey: "unlistedCountBoundingBox",
        dimensions: UNLISTED_COUNT_DIMENSIONS,
        ref: unlistedCountMeshRef,
      },
      {
        meshName: "in_packs_count",
        boundingBoxKey: "inPacksCountBoundingBox",
        dimensions: IN_PACKS_COUNT_DIMENSIONS,
        ref: inPacksCountMeshRef,
      },
      {
        meshName: "low_ask",
        boundingBoxKey: "lowAskBoundingBox",
        dimensions: LOW_ASK_DIMENSIONS,
        ref: lowAskMeshRef,
      },
      {
        meshName: "high_offer",
        boundingBoxKey: "highOfferBoundingBox",
        dimensions: HIGH_OFFER_DIMENSIONS,
        ref: highOfferMeshRef,
      },
      {
        meshName: "median_sale",
        boundingBoxKey: "medianSaleBoundingBox",
        dimensions: MEDIAN_SALE_DIMENSIONS,
        ref: medianSaleMeshRef,
      },
      {
        meshName: "team_score",
        boundingBoxKey: "teamScoreBoundingBox",
        dimensions: TEAM_SCORE_DIMENSIONS,
        ref: teamScoreMeshRef,
      },
      {
        meshName: "remaining_count",
        boundingBoxKey: "remainingCountBoundingBox",
        dimensions: REMAINING_COUNT_DIMENSIONS,
        ref: remainingCountMeshRef,
      },
      {
        meshName: "game_date",
        boundingBoxKey: "gameDateBoundingBox",
        dimensions: GAME_DATE_DIMENSIONS,
        ref: gameDateMeshRef,
      },
      {
        meshName: "stat_value1",
        boundingBoxKey: "statValue1BoundingBox",
        dimensions: STAT_VALUE1_DIMENSIONS,
        ref: statValue1MeshRef,
      },
      {
        meshName: "stat_value2",
        boundingBoxKey: "statValue2BoundingBox",
        dimensions: STAT_VALUE2_DIMENSIONS,
        ref: statValue2MeshRef,
      },
      {
        meshName: "stat_value3",
        boundingBoxKey: "statValue3BoundingBox",
        dimensions: STAT_VALUE3_DIMENSIONS,
        ref: statValue3MeshRef,
      },
      {
        meshName: "stat_value4",
        boundingBoxKey: "statValue4BoundingBox",
        dimensions: STAT_VALUE4_DIMENSIONS,
        ref: statValue4MeshRef,
      },
      {
        meshName: "stat_value5",
        boundingBoxKey: "statValue5BoundingBox",
        dimensions: STAT_VALUE5_DIMENSIONS,
        ref: statValue5MeshRef,
      },
      {
        meshName: "stat_name1",
        boundingBoxKey: "statName1BoundingBox",
        dimensions: STAT_NAME1_DIMENSIONS,
        ref: statName1MeshRef,
      },
      {
        meshName: "stat_name2",
        boundingBoxKey: "statName2BoundingBox",
        dimensions: STAT_NAME2_DIMENSIONS,
        ref: statName2MeshRef,
      },
      {
        meshName: "stat_name3",
        boundingBoxKey: "statName3BoundingBox",
        dimensions: STAT_NAME3_DIMENSIONS,
        ref: statName3MeshRef,
      },
      {
        meshName: "stat_name4",
        boundingBoxKey: "statName4BoundingBox",
        dimensions: STAT_NAME4_DIMENSIONS,
        ref: statName4MeshRef,
      },
      {
        meshName: "stat_name5",
        boundingBoxKey: "statName5BoundingBox",
        dimensions: STAT_NAME5_DIMENSIONS,
        ref: statName5MeshRef,
      },
    ],
    [
      redeemedCountMeshRef,
      stakedCountMeshRef,
      saleCountMeshRef,
      unlistedCountMeshRef,
      inPacksCountMeshRef,
      lowAskMeshRef,
      highOfferMeshRef,
      medianSaleMeshRef,
      teamScoreMeshRef,
      remainingCountMeshRef,
      gameDateMeshRef,
      statValue1MeshRef,
      statValue2MeshRef,
      statValue3MeshRef,
      statValue4MeshRef,
      statValue5MeshRef,
      statName1MeshRef,
      statName2MeshRef,
      statName3MeshRef,
      statName4MeshRef,
      statName5MeshRef,
    ],
  );

  const resolveMesh = useCallback(
    (
      scene: THREE.Object3D,
      meshName: string,
      ref?: MutableRefObject<THREE.Mesh | null>,
    ): THREE.Mesh | null => {
      // Only trust the ref if it's still part of this scene subtree
      if (ref?.current) {
        const stillInThisScene = scene.getObjectById(ref.current.id);
        if (stillInThisScene) {
          return ref.current;
        }
        // Stale ref from a previous scene instance
        ref.current = null;
      }

      const sceneResolved = scene.getObjectByName(
        meshName,
      ) as THREE.Mesh | null;
      if (sceneResolved) {
        if (ref) ref.current = sceneResolved;
        return sceneResolved;
      }
      return null;
    },
    [],
  );

  const updateCardTextMesh = useCallback(
    (spec: CardMeshSpec, fontToUse: Font, textContent: string) => {
      const parent = cardRef.current ?? splineSceneRef.current;
      if (!parent) {
        return;
      }
      let mesh = resolveMesh(parent, spec.meshName, spec.ref);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.BufferGeometry(),
          getHiddenTextMaterial(),
        );
        mesh.name = spec.meshName;
        parent.add(mesh);
        spec.ref.current = mesh;
      }
      const updated = applyTextMeshWithBoundingBox({
        target: mesh,
        fontToUse,
        textContent,
        dimensions: spec.dimensions,
        meshName: spec.meshName,
        boundingBoxKey: spec.boundingBoxKey,
      });
      if (updated) {
        spec.ref.current = updated as THREE.Mesh;
      }
    },
    [applyTextMeshWithBoundingBox, getHiddenTextMaterial, resolveMesh],
  );

  const replaceTextForObject = useCallback(
    (
      scene: THREE.Object3D,
      objectName: string,
      fontToUse: Font,
      textContent: string,
    ) => {
      const target = scene.getObjectByName(objectName);
      if (!target) {
        return null;
      }

      const config = sceneTextConfigs[objectName];
      if (config) {
        const updatedMesh = applyTextMeshWithBoundingBox({
          target,
          fontToUse,
          textContent,
          dimensions: config.dimensions,
          meshName: config.meshName,
          boundingBoxKey: config.boundingBoxKey,
        });
        if (updatedMesh && config.linked) {
          updateLinkedSceneMesh(
            updatedMesh as THREE.Mesh,
            fontToUse,
            textContent,
            config.linked,
          );
        }
        return updatedMesh;
      }

      target.updateWorldMatrix(true, true);
      const targetBox = new THREE.Box3().setFromObject(target);
      const targetIsMesh = (target as any)?.isMesh === true;

      const targetSize = new THREE.Vector3();
      let targetBoxValid = !targetBox.isEmpty();
      if (targetBoxValid) {
        targetBox.getSize(targetSize);
      }

      if (
        !targetBoxValid ||
        targetSize.lengthSq() === 0 ||
        targetSize.x <= 0 ||
        targetSize.y <= 0
      ) {
        if (!targetIsMesh) {
          return null;
        }
        const meshTarget = target as THREE.Mesh;
        targetSize.set(
          Math.max(Math.abs(meshTarget.scale.x), Number.EPSILON),
          Math.max(Math.abs(meshTarget.scale.y), Number.EPSILON),
          Math.max(Math.abs(meshTarget.scale.z), Number.EPSILON),
        );
      }

      const targetCenterWorld = targetBoxValid
        ? targetBox.getCenter(new THREE.Vector3())
        : target.getWorldPosition(new THREE.Vector3());
      const targetCenterLocal = target.worldToLocal(targetCenterWorld.clone());

      let geometry: TextGeometry;
      try {
        geometry = new textGeometryCtor(textContent, {
          font: fontToUse,
          size: 1,
          height: STEP2_DIMENSIONS.depth,
          curveSegments: 24,
          bevelEnabled: false,
        });
      } catch {
        return null;
      }

      geometry.computeBoundingBox();
      const baseBox = geometry.boundingBox;
      if (!baseBox || baseBox.isEmpty()) {
        geometry.dispose();
        return null;
      }
      const baseSize = new THREE.Vector3();
      baseBox.getSize(baseSize);

      const safeBaseSizeX = baseSize.x || Number.EPSILON;
      const safeBaseSizeY = baseSize.y || Number.EPSILON;
      const safeBaseSizeZ = baseSize.z || Number.EPSILON;

      let scaleFactor = Math.min(
        targetSize.x / safeBaseSizeX,
        targetSize.y / safeBaseSizeY,
        targetSize.z > 0 ? targetSize.z / safeBaseSizeZ : Infinity,
      );

      if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) {
        scaleFactor = 1;
      }

      geometry.scale(scaleFactor, scaleFactor, scaleFactor);
      geometry.computeBoundingBox();
      const scaledBox = geometry.boundingBox;
      if (!scaledBox || scaledBox.isEmpty()) {
        geometry.dispose();
        return null;
      }

      const centerOffset = new THREE.Vector3();
      scaledBox.getCenter(centerOffset);
      geometry.translate(-centerOffset.x, -centerOffset.y, -centerOffset.z);

      const sharedMaterial = getSharedTextMaterial();

      const existingChildren = [...target.children];
      for (const child of existingChildren) {
        target.remove(child);
        disposeChildMesh(child);
      }

      if (targetIsMesh) {
        const meshTarget = target as THREE.Mesh;
        const oldGeometry = meshTarget.geometry as
          | THREE.BufferGeometry
          | undefined;
        const oldMaterial = meshTarget.material as
          | THREE.Material
          | THREE.Material[]
          | undefined;
        const originalPosition = meshTarget.position.clone();
        const originalRotation = meshTarget.rotation.clone();
        const originalScale = meshTarget.scale.clone();

        meshTarget.geometry = geometry;
        meshTarget.material = sharedMaterial;
        meshTarget.position.copy(originalPosition);
        meshTarget.rotation.copy(originalRotation);
        meshTarget.scale.copy(originalScale);

        if (oldGeometry && typeof oldGeometry.dispose === "function") {
          oldGeometry.dispose();
        }
        disposeMaterialIfUnshared(oldMaterial);
        (meshTarget as any).text = textContent;
        return meshTarget;
      }

      const newMesh = new THREE.Mesh(geometry, sharedMaterial);
      newMesh.position.copy(targetCenterLocal);
      target.add(newMesh);
      (target as any).text = textContent.toUpperCase();
      return newMesh;
    },
    [
      sceneTextConfigs,
      applyTextMeshWithBoundingBox,
      updateLinkedSceneMesh,
      disposeChildMesh,
      textGeometryCtor,
      getSharedTextMaterial,
      disposeMaterialIfUnshared,
    ],
  );

  useEffect(() => {
    return () => {
      for (const material of textMaterialCacheRef.current.values()) {
        material.dispose();
      }
      textMaterialCacheRef.current.clear();
      if (hiddenTextMaterialRef.current) {
        hiddenTextMaterialRef.current.dispose();
        hiddenTextMaterialRef.current = null;
      }
    };
  }, []);

  const replaceSceneTextTargets = useCallback(() => {
    const scene = splineSceneRef.current;
    const fontToUse = effectiveFont;
    if (!scene || !fontToUse) {
      return;
    }

    for (const name of TEXT_TARGET_NAMES) {
      const overrideValue = dynamicTextOverrides[name] ?? "";
      const textContent = CASE_SENSITIVE_TEXT_TARGETS.has(name)
        ? overrideValue
        : overrideValue.toUpperCase();
      replaceTextForObject(scene, name, fontToUse, textContent);
    }

    const mintedTexts = (() => {
      if (minted === null || minted === undefined) {
        return { inPacks: "", remaining: "" };
      }
      const mintedStr = String(minted).trim();
      if (mintedStr.length === 0) {
        return { inPacks: "", remaining: "" };
      }
      return { inPacks: mintedStr, remaining: mintedStr };
    })();

    if (!isInTrophyCase) {
      const formatGameDate = (value: unknown): string => {
        if (value === null || value === undefined) return "";
        const str = String(value).trim();
        return str.length > 0 ? str : "";
      };

      const cardTextByMeshName: Record<string, string> = {
        redeemed_count: "0", // Hardcoded to 0, ignoring database value
        staked_count:
          stakedCount !== null && stakedCount !== undefined
            ? String(stakedCount)
            : "",
        sale_count:
          activeListingsCount !== null && activeListingsCount !== undefined
            ? String(activeListingsCount)
            : "",
        unlisted_count: (() => {
          const m = minted ?? 0;
          const inp = inPacksCount ?? 0;
          const alc = activeListingsCount ?? 0;
          const sc = stakedCount ?? 0;
          const rc = 0; // Hardcoded to 0, ignoring database value
          const unlistedCount = Number(m) - inp - alc - sc - rc;
          return String(Math.max(0, unlistedCount));
        })(),
        in_packs_count:
          inPacksCount !== null && inPacksCount !== undefined
            ? String(inPacksCount)
            : "",
        remaining_count: mintedTexts.remaining,
        low_ask: lowAsk
          ? `$${Math.round(Number(lowAsk.replace("$", "")))}`
          : "",
        high_offer: highOffer
          ? `$${Math.round(Number(highOffer.replace("$", "")))}`
          : "",
        median_sale: rollingMedianSale
          ? `$${Math.round(Number(rollingMedianSale.replace("$", "")))}`
          : "",
        team_score: dynamicTextOverrides.TeamScore ?? "",
        game_date: formatGameDate(gameDate),
        stat_value1: toText(statValue1),
        stat_value2: toText(statValue2),
        stat_value3: toText(statValue3),
        stat_value4: toText(statValue4),
        stat_value5: toText(statValue5),
        stat_name1: toText(statName1),
        stat_name2: toText(statName2),
        stat_name3: toText(statName3),
        stat_name4: toText(statName4),
        stat_name5: toText(statName5),
      };

      for (const spec of cardMeshSpecs) {
        const textContent = cardTextByMeshName[spec.meshName] ?? "";
        // Skip rendering stats/market fields if data doesn't exist (very CPU-heavy)
        if (!textContent || textContent.trim().length === 0) continue;
        updateCardTextMesh(spec, fontToUse, textContent);
      }
    }
  }, [
    dynamicTextOverrides,
    effectiveFont,
    replaceTextForObject,
    cardMeshSpecs,
    updateCardTextMesh,
    minted,
    gameDate,
    lowAsk,
    highOffer,
    rollingMedianSale,
    statValue1,
    statValue2,
    statValue3,
    statValue4,
    statValue5,
    statName1,
    statName2,
    statName3,
    statName4,
    statName5,
    activeListingsCount,
    stakedCount,
    inPacksCount,
  ]);

  // Update bar widths when scene loads (barInitCounter changes) or counts change
  useEffect(() => {
    if (!cardRef.current && !splineSceneRef.current) {
      return; // Scene not loaded yet
    }

    if (isInTrophyCase) {
      return; // Skip trophy case
    }

    // Always recalculate bar widths with fresh data
    // This ensures bars show correct proportions as data arrives
    const m = Number(minted ?? 0);
    const inp = Number(inPacksCount ?? 0);
    const alc = Number(activeListingsCount ?? 0);
    const sc = Number(stakedCount ?? 0);
    const rc = 0;

    const updateBarWidth = (bar: THREE.Mesh | null, count: number) => {
      if (!bar) return;

      // Calculate width as percentage of minted
      const barWidth = m > 0 ? (count / m) * 110 : 0;
      const safeWidth = Math.max(0.1, barWidth); // Ensure minimum width for visibility

      const newGeometry = new THREE.BoxGeometry(safeWidth, 12, 1);
      newGeometry.translate(-safeWidth / 2, 0, 0);

      const oldGeometry = bar.geometry;
      bar.geometry = newGeometry;
      if (oldGeometry && oldGeometry !== newGeometry) {
        try {
          (oldGeometry as THREE.BufferGeometry).dispose();
        } catch {}
      }
    };

    // Update all bars atomically with current data
    const unlistedCount = Math.max(0, m - inp - alc - sc - rc);
    updateBarWidth(inPacksBarRef.current, inp);
    updateBarWidth(unlistedBarRef.current, unlistedCount);
    updateBarWidth(forSaleBarRef.current, alc);
    updateBarWidth(stakedBarRef.current, sc);
    updateBarWidth(redeemedBarRef.current, rc);
  }, [
    minted,
    inPacksCount,
    activeListingsCount,
    stakedCount,
    isInTrophyCase,
    barInitCounter, // Trigger when bars are created
  ])

  // Separate effect to update selected element meshes without triggering scene reload
  // This runs after scene is loaded and updates marketplace/stat data without re-rendering
  useEffect(() => {
    if (!cardRef.current && !splineSceneRef.current) {
      return; // Scene not loaded yet
    }

    if (isInTrophyCase) {
      return; // Skip trophy case
    }

    const parent = cardRef.current ?? splineSceneRef.current;
    if (!parent) return;

    // Prepare text content for selected elements
    const selectedElementTextByMeshName: Record<string, string> = {
      redeemed_count: "0", // Hardcoded to 0, ignoring database value
      staked_count:
        stakedCount !== null && stakedCount !== undefined
          ? String(stakedCount)
          : "",
      sale_count:
        activeListingsCount !== null && activeListingsCount !== undefined
          ? String(activeListingsCount)
          : "",
      unlisted_count: (() => {
        const m = minted ?? 0;
        const inp = inPacksCount ?? 0;
        const alc = activeListingsCount ?? 0;
        const sc = stakedCount ?? 0;
        const rc = 0; // Hardcoded to 0, ignoring database value
        const unlistedCount = Number(m) - inp - alc - sc - rc;
        return String(Math.max(0, unlistedCount));
      })(),
      in_packs_count:
        inPacksCount !== null && inPacksCount !== undefined
          ? String(inPacksCount)
          : "",
      low_ask: lowAsk
        ? `$${Math.round(Number(lowAsk.replace("$", "")))}`
        : "",
      high_offer: highOffer
        ? `$${Math.round(Number(highOffer.replace("$", "")))}`
        : "",
      median_sale: rollingMedianSale
        ? `$${Math.round(Number(rollingMedianSale.replace("$", "")))}`
        : "",
    };

    // Update only the selected element meshes
    const selectedMeshNames = [
      "redeemed_count",
      "staked_count",
      "sale_count",
      "unlisted_count",
      "in_packs_count",
      "low_ask",
      "high_offer",
      "median_sale",
    ];

    for (const spec of cardMeshSpecs) {
      if (!selectedMeshNames.includes(spec.meshName)) {
        continue; // Skip non-selected elements
      }

      const textContent = selectedElementTextByMeshName[spec.meshName] ?? "";
      if (!textContent || textContent.trim().length === 0) {
        // Don't render if no data
        continue;
      }

      updateCardTextMesh(spec, effectiveFont, textContent);
    }
  }, [
    activeListingsCount,
    stakedCount,
    inPacksCount,
    lowAsk,
    highOffer,
    rollingMedianSale,
    minted,
    effectiveFont,
    updateCardTextMesh,
    cardMeshSpecs,
    isInTrophyCase,
    fetchedRmvLowAsk,
    fetchedRmvHighOffer,
    fetchedRmvMedianSale,
  ]);

  // Helper function to convert values to text
  const toText = (value: unknown) =>
    value === null || value === undefined ? "" : String(value);

  // Helper to check if a mesh has valid rendered geometry
  const hasValidGeometry = useCallback((obj: any) => {
    if (!obj || !obj.isMesh) return false;
    const g = obj.geometry as THREE.BufferGeometry | undefined;
    if (!g) return false;
    const pos = g.attributes?.position;
    if (!pos || pos.count === 0) return false;
    return true;
  }, []);

  // Ensure all text meshes (including deferred data) render even after initial card render
  const deferredTextRetryTimerRef = useRef<number | null>(null);
  const deferredTextRetryAttemptsRef = useRef(0);

  const retryMissingTextMeshes = useCallback(() => {
    if (snapshotMode) return;
    if (repairInProgressRef.current) return;
    if (!splineSceneRef.current || !effectiveFont) return;

    repairInProgressRef.current = true;
    try {
      const scene = splineSceneRef.current;

      const hasValidGeometry = (obj: any) => {
        if (!obj || !obj.isMesh) return false;
        const g = obj.geometry as THREE.BufferGeometry | undefined;
        if (!g) return false;
        g.computeBoundingBox();
        const bb = g.boundingBox;
        return !!bb && !bb.isEmpty();
      };

      let remaining = 0;

      // Check all sceneTextConfigs
      for (const [configKey, config] of Object.entries(sceneTextConfigs)) {
        const mesh = scene.getObjectByName(config.meshName) as any;
        if (!hasValidGeometry(mesh)) {
          remaining++;
          const overrideValue = (dynamicTextOverrides as any)[configKey] ?? "";
          const textContent = CASE_SENSITIVE_TEXT_TARGETS.has(configKey as any)
            ? overrideValue
            : String(overrideValue).toUpperCase();
          if (textContent.trim().length > 0) {
            replaceTextForObject(scene, configKey, effectiveFont, textContent);
          }
        }
      }

      const formatGameDate = (value: unknown): string => {
        if (value === null || value === undefined) return "";
        const str = String(value).trim();
        return str.length > 0 ? str : "";
      };

      // Check all cardMeshSpecs
      for (const spec of cardMeshSpecs) {
        // Skip rendering for sale_count only - unlisted_count is now calculated
        if (spec.meshName === "sale_count") {
          continue;
        }

        const mesh =
          (scene.getObjectByName(spec.meshName) as THREE.Mesh | null) ??
          spec.ref.current;
        if (!hasValidGeometry(mesh)) {
          remaining++;
          let textContent = "";

          // Determine text content based on mesh name
          if (spec.meshName === "redeemed_count") {
            // Placeholder: render 0 (will be overwritten by logic)
            textContent = "0";
          } else if (spec.meshName === "staked_count") {
            // Render staked count if available
            if (stakedCount !== null && stakedCount !== undefined) {
              textContent = String(stakedCount);
            }
          } else if (spec.meshName === "in_packs_count") {
            // Render in-packs count if available
            if (inPacksCount !== null && inPacksCount !== undefined) {
              textContent = String(inPacksCount);
            }
          } else if (spec.meshName === "low_ask") {
            // Use fetched RMV data first, then fall back to prop
            const value = fetchedRmvLowAsk || lowAsk;
            if (!value) continue;
            textContent = `$${Math.round(Number(value.replace("$", "")))}`;
          } else if (spec.meshName === "high_offer") {
            // Use fetched RMV data first, then fall back to prop
            const value = fetchedRmvHighOffer || highOffer;
            if (!value) continue;
            textContent = `$${Math.round(Number(value.replace("$", "")))}`;
          } else if (spec.meshName === "median_sale") {
            // Use fetched RMV data first, then fall back to prop
            const value = fetchedRmvMedianSale || rollingMedianSale;
            if (!value) continue;
            textContent = `$${Math.round(Number(value.replace("$", "")))}`;
          } else if (spec.meshName === "team_score") {
            textContent = dynamicTextOverrides.TeamScore ?? "";
          } else if (spec.meshName === "game_date") {
            textContent = formatGameDate(gameDate);
          } else if (spec.meshName === "stat_value1") {
            textContent = toText(statValue1);
          } else if (spec.meshName === "stat_value2") {
            textContent = toText(statValue2);
          } else if (spec.meshName === "stat_value3") {
            textContent = toText(statValue3);
          } else if (spec.meshName === "stat_value4") {
            textContent = toText(statValue4);
          } else if (spec.meshName === "stat_value5") {
            textContent = toText(statValue5);
          } else if (spec.meshName === "stat_name1") {
            textContent = toText(statName1);
          } else if (spec.meshName === "stat_name2") {
            textContent = toText(statName2);
          } else if (spec.meshName === "stat_name3") {
            textContent = toText(statName3);
          } else if (spec.meshName === "stat_name4") {
            textContent = toText(statName4);
          } else if (spec.meshName === "stat_name5") {
            textContent = toText(statName5);
          }

          if (textContent.trim().length > 0) {
            updateCardTextMesh(spec, effectiveFont, textContent);
          }
        }
      }

      const maxAttempts = isQueueCarousel ? 60 : 40;
      const delayMs = isQueueCarousel ? 100 : 200;

      if (remaining > 0 && deferredTextRetryAttemptsRef.current < maxAttempts) {
        deferredTextRetryAttemptsRef.current += 1;
        deferredTextRetryTimerRef.current = window.setTimeout(
          retryMissingTextMeshes,
          delayMs,
        );
      } else {
        deferredTextRetryAttemptsRef.current = 0;
        if (deferredTextRetryTimerRef.current) {
          window.clearTimeout(deferredTextRetryTimerRef.current);
          deferredTextRetryTimerRef.current = null;
        }
      }
    } finally {
      repairInProgressRef.current = false;
    }
  }, [
    snapshotMode,
    effectiveFont,
    sceneTextConfigs,
    dynamicTextOverrides,
    replaceTextForObject,
    cardMeshSpecs,
    updateCardTextMesh,
    isQueueCarousel,
    gameDate,
    minted,
    lowAsk,
    highOffer,
    rollingMedianSale,
    statValue1,
    statValue2,
    statValue3,
    statValue4,
    statValue5,
    statName1,
    statName2,
    statName3,
    statName4,
    statName5,
    activeListingsCount,
    stakedCount,
    inPacksCount,
    fetchedRmvLowAsk,
    fetchedRmvHighOffer,
    fetchedRmvMedianSale,
  ]);

  // Ensure back text (linked meshes) render even after initial card render
  const backTextRepairTimerRef = useRef<number | null>(null);
  const backTextRepairAttemptsRef = useRef(0);
  const backDataRefetchTriggeredRef = useRef(false);
  const scheduleBackTextRepair = useCallback(() => {
    if (snapshotMode) return;
    if (repairInProgressRef.current) return;
    if (!splineSceneRef.current || !effectiveFont) return;

    repairInProgressRef.current = true;
    try {
      const scene = splineSceneRef.current;
      const links: Array<{
        frontKey: keyof typeof sceneTextConfigs;
        linkedName: string;
      }> = [] as any;
      try {
        for (const [frontKey, cfg] of Object.entries(sceneTextConfigs)) {
          if ((cfg as any).linked) {
            links.push({
              frontKey: frontKey as any,
              linkedName: (cfg as any).linked.meshName,
            });
          }
        }
      } catch {}
      const hasValidGeometry = (obj: any) => {
        if (!obj || !obj.isMesh) return false;
        const g = obj.geometry as THREE.BufferGeometry | undefined;
        if (!g) return false;
        g.computeBoundingBox();
        const bb = g.boundingBox;
        return !!bb && !bb.isEmpty();
      };

      const maxAttempts = isQueueCarousel ? 60 : 40;
      const delayMs = isQueueCarousel ? 100 : 150;
      const refetchThreshold = isQueueCarousel ? 20 : 10;

      const tryOnce = async () => {
        if (!splineSceneRef.current || !effectiveFont) return;
        let remaining = 0;

        // Check linked back-side text geometries from sceneTextConfigs
        for (const { frontKey, linkedName } of links) {
          const linked = scene.getObjectByName(linkedName) as any;
          if (!hasValidGeometry(linked)) {
            remaining++;
            const overrideValue = (dynamicTextOverrides as any)[frontKey] ?? "";
            const textContent = CASE_SENSITIVE_TEXT_TARGETS.has(frontKey as any)
              ? overrideValue
              : String(overrideValue).toUpperCase();
            replaceTextForObject(
              scene,
              frontKey as any,
              effectiveFont,
              textContent,
            );
          }
        }

        // Check card mesh back-side text geometries (game_date, stat_value*, stat_name*)
        const formatGameDate = (value: unknown): string => {
          if (value === null || value === undefined) return "";
          const str = String(value).trim();
          return str.length > 0 ? str : "";
        };

        for (const spec of cardMeshSpecs) {
          // Skip rendering for sale_count only - unlisted_count is now calculated
          if (spec.meshName === "sale_count") {
            continue;
          }

          const mesh =
            (scene.getObjectByName(spec.meshName) as THREE.Mesh | null) ??
            spec.ref.current;
          if (!hasValidGeometry(mesh)) {
            remaining++;
            let textContent = "";

            // Determine text content based on mesh name
            if (spec.meshName === "redeemed_count") {
              // Placeholder: render 0 (will be overwritten by logic)
              textContent = "0";
            } else if (spec.meshName === "staked_count") {
              // Render staked count if available
              if (stakedCount !== null && stakedCount !== undefined) {
                textContent = String(stakedCount);
              }
            } else if (spec.meshName === "in_packs_count") {
              // Render in-packs count if available
              if (inPacksCount !== null && inPacksCount !== undefined) {
                textContent = String(inPacksCount);
              }
            } else if (spec.meshName === "low_ask") {
            // Use fetched RMV data first, then fall back to prop
            const value = fetchedRmvLowAsk || lowAsk;
            if (!value) continue;
            textContent = `$${Math.round(Number(value.replace("$", "")))}`;
          } else if (spec.meshName === "high_offer") {
            // Use fetched RMV data first, then fall back to prop
            const value = fetchedRmvHighOffer || highOffer;
            if (!value) continue;
            textContent = `$${Math.round(Number(value.replace("$", "")))}`;
          } else if (spec.meshName === "median_sale") {
            // Use fetched RMV data first, then fall back to prop
            const value = fetchedRmvMedianSale || rollingMedianSale;
            if (!value) continue;
            textContent = `$${Math.round(Number(value.replace("$", "")))}`;
          } else if (spec.meshName === "team_score") {
              textContent = dynamicTextOverrides.TeamScore ?? "";
            } else if (spec.meshName === "game_date") {
              textContent = formatGameDate(gameDate);
            } else if (spec.meshName === "stat_value1") {
              textContent = toText(statValue1);
            } else if (spec.meshName === "stat_value2") {
              textContent = toText(statValue2);
            } else if (spec.meshName === "stat_value3") {
              textContent = toText(statValue3);
            } else if (spec.meshName === "stat_value4") {
              textContent = toText(statValue4);
            } else if (spec.meshName === "stat_value5") {
              textContent = toText(statValue5);
            } else if (spec.meshName === "stat_name1") {
              textContent = toText(statName1);
            } else if (spec.meshName === "stat_name2") {
              textContent = toText(statName2);
            } else if (spec.meshName === "stat_name3") {
              textContent = toText(statName3);
            } else if (spec.meshName === "stat_name4") {
              textContent = toText(statName4);
            } else if (spec.meshName === "stat_name5") {
              textContent = toText(statName5);
            }

            if (textContent.trim().length > 0) {
              updateCardTextMesh(spec, effectiveFont, textContent);
            }
          }
        }

        // If we still have missing back data and we haven't triggered a refetch yet, do it now
        if (
          remaining > 0 &&
          !isQueueCarousel &&
          onRefetchMissingData &&
          !backDataRefetchTriggeredRef.current &&
          backTextRepairAttemptsRef.current >= refetchThreshold
        ) {
          backDataRefetchTriggeredRef.current = true;
          console.log(
            "[EditionSplineScene] Back data missing, triggering refetch",
          );
          try {
            await onRefetchMissingData();
          } catch (err) {
            console.error("[EditionSplineScene] Refetch failed:", err);
          }
        }

        if (remaining > 0 && backTextRepairAttemptsRef.current < maxAttempts) {
          backTextRepairAttemptsRef.current += 1;
          backTextRepairTimerRef.current = window.setTimeout(tryOnce, delayMs);
        } else {
          backTextRepairAttemptsRef.current = 0;
          if (backTextRepairTimerRef.current) {
            window.clearTimeout(backTextRepairTimerRef.current);
            backTextRepairTimerRef.current = null;
          }
        }
      };

      if (backTextRepairTimerRef.current) {
        window.clearTimeout(backTextRepairTimerRef.current);
        backTextRepairTimerRef.current = null;
      }
      backTextRepairAttemptsRef.current = 0;
      backDataRefetchTriggeredRef.current = false;
      backTextRepairTimerRef.current = window.setTimeout(tryOnce, 0);
    } finally {
      repairInProgressRef.current = false;
    }
  }, [
    snapshotMode,
    sceneTextConfigs,
    effectiveFont,
    replaceTextForObject,
    cardMeshSpecs,
    updateCardTextMesh,
    isQueueCarousel,
    onRefetchMissingData,
    dynamicTextOverrides,
    minted,
    lowAsk,
    highOffer,
    rollingMedianSale,
    gameDate,
    statValue1,
    statValue2,
    statValue3,
    statValue4,
    statValue5,
    statName1,
    statName2,
    statName3,
    statName4,
    statName5,
    activeListingsCount,
    stakedCount,
    inPacksCount,
    redeemedCount,
  ]);

  // Unified "apply until complete" effect with requestAnimationFrame retry
  useEffect(() => {
    const scene = splineSceneRef.current;
    const fontToUse = effectiveFont;

    if (!scene || !fontToUse) return;

    let raf = 0;
    let attempts = 0;
    const maxAttempts = isQueueCarousel ? 120 : 60;

    const applyAllText = () => {
      attempts++;
      const missing: string[] = [];

      // 1) Apply primary fields (sceneTextConfigs)
      for (const name of TEXT_TARGET_NAMES) {
        const overrideValue = dynamicTextOverrides[name] ?? "";
        const textContent = CASE_SENSITIVE_TEXT_TARGETS.has(name)
          ? overrideValue
          : overrideValue.toUpperCase();

        if (textContent.trim().length > 0) {
          const target = scene.getObjectByName(name);
          if (target) {
            const config = sceneTextConfigs[name];
            if (config) {
              const updated = applyTextMeshWithBoundingBox({
                target,
                fontToUse,
                textContent,
                dimensions: config.dimensions,
                meshName: config.meshName,
                boundingBoxKey: config.boundingBoxKey,
              });
              if (!updated || !hasValidGeometry(updated)) {
                missing.push(name);
              } else if (config.linked) {
                // Apply linked back-side mesh
                updateLinkedSceneMesh(
                  updated as THREE.Mesh,
                  fontToUse,
                  textContent,
                  config.linked,
                );
              }
            }
          } else {
            missing.push(name);
          }
        }
      }

      // 2) Apply stat/market fields (cardMeshSpecs)
      if (!isInTrophyCase) {
        const formatGameDate = (value: unknown): string => {
          if (value === null || value === undefined) return "";
          const str = String(value).trim();
          return str.length > 0 ? str : "";
        };

        const buildCardTextContent = (meshName: string): string => {
          if (meshName === "redeemed_count") {
            // Hardcoded to 0, ignoring database value
            return "0";
          }
          if (meshName === "staked_count") {
            return stakedCount !== null && stakedCount !== undefined
              ? String(stakedCount)
              : "";
          }
          if (meshName === "sale_count") {
            return activeListingsCount !== null &&
              activeListingsCount !== undefined
              ? String(activeListingsCount)
              : "";
          }
          if (meshName === "unlisted_count") {
            // Calculate: minted - inPacks - forSale - staked - redeemed
            // Treat any nulls as zero
            const m = minted ?? 0;
            const inp = inPacksCount ?? 0;
            const alc = activeListingsCount ?? 0;
            const sc = stakedCount ?? 0;
            const rc = 0; // Hardcoded to 0, ignoring database value
            const unlistedCount = Number(m) - inp - alc - sc - rc;
            return String(Math.max(0, unlistedCount));
          }
          if (meshName === "in_packs_count") {
            return inPacksCount !== null && inPacksCount !== undefined
              ? String(inPacksCount)
              : "";
          }
          if (meshName === "remaining_count") {
            return minted !== null && minted !== undefined
              ? String(minted)
              : "";
          }
          if (meshName === "low_ask") {
            if (!lowAsk) return "";
            return `$${Math.round(Number(lowAsk.replace("$", "")))}`;
          }
          if (meshName === "high_offer") {
            if (!highOffer) return "";
            return `$${Math.round(Number(highOffer.replace("$", "")))}`;
          }
          if (meshName === "median_sale") {
            if (!rollingMedianSale) return "";
            return `$${Math.round(Number(rollingMedianSale.replace("$", "")))}`;
          }
          if (meshName === "team_score")
            return dynamicTextOverrides.TeamScore ?? "";
          if (meshName === "game_date") return formatGameDate(gameDate);
          if (meshName === "stat_value1") return toText(statValue1);
          if (meshName === "stat_value2") return toText(statValue2);
          if (meshName === "stat_value3") return toText(statValue3);
          if (meshName === "stat_value4") return toText(statValue4);
          if (meshName === "stat_value5") return toText(statValue5);
          if (meshName === "stat_name1") return toText(statName1);
          if (meshName === "stat_name2") return toText(statName2);
          if (meshName === "stat_name3") return toText(statName3);
          if (meshName === "stat_name4") return toText(statName4);
          if (meshName === "stat_name5") return toText(statName5);
          return "";
        };

        for (const spec of cardMeshSpecs) {
          const textContent = buildCardTextContent(spec.meshName);
          if (textContent.trim().length > 0) {
            const parent = cardRef.current ?? scene;
            let mesh = resolveMesh(parent, spec.meshName, spec.ref);

            if (!mesh) {
              mesh = new THREE.Mesh(
                new THREE.BufferGeometry(),
                getHiddenTextMaterial(),
              );
              mesh.name = spec.meshName;
              parent.add(mesh);
              spec.ref.current = mesh;
            }

            const updated = applyTextMeshWithBoundingBox({
              target: mesh,
              fontToUse,
              textContent,
              dimensions: spec.dimensions,
              meshName: spec.meshName,
              boundingBoxKey: spec.boundingBoxKey,
            });

            if (!updated || !hasValidGeometry(updated)) {
              missing.push(spec.meshName);
            } else {
              spec.ref.current = updated as THREE.Mesh;
            }
          }
        }
      }

      // Keep retrying if anything missing and we have attempts left
      if (missing.length > 0 && attempts < maxAttempts) {
        raf = requestAnimationFrame(applyAllText);
      }
    };

    raf = requestAnimationFrame(applyAllText);
    return () => cancelAnimationFrame(raf);
  }, [
    effectiveFont,
    dynamicTextOverrides,
    sceneTextConfigs,
    cardMeshSpecs,
    applyTextMeshWithBoundingBox,
    updateLinkedSceneMesh,
    resolveMesh,
    hasValidGeometry,
    getHiddenTextMaterial,
    isInTrophyCase,
    isQueueCarousel,
    minted,
    lowAsk,
    highOffer,
    rollingMedianSale,
    gameDate,
    statValue1,
    statValue2,
    statValue3,
    statValue4,
    statValue5,
    statName1,
    statName2,
    statName3,
    statName4,
    statName5,
    activeListingsCount,
    stakedCount,
    inPacksCount,
    redeemedCount,
  ]);

  useEffect(() => {
    replaceSceneTextTargetsRef.current = replaceSceneTextTargets;
    scheduleBackTextRepairRef.current = scheduleBackTextRepair;
  }, [replaceSceneTextTargets, scheduleBackTextRepair]);

  useEffect(() => {
    void replaceSceneTextTargets();
    scheduleBackTextRepair();
    retryMissingTextMeshes();
    return () => {
      if (backTextRepairTimerRef.current) {
        window.clearTimeout(backTextRepairTimerRef.current);
        backTextRepairTimerRef.current = null;
      }
      if (deferredTextRetryTimerRef.current) {
        window.clearTimeout(deferredTextRetryTimerRef.current);
        deferredTextRetryTimerRef.current = null;
      }
    };
  }, [
    replaceSceneTextTargets,
    scheduleBackTextRepair,
    retryMissingTextMeshes,
    minted,
    lowAsk,
    highOffer,
    rollingMedianSale,
    gameDate,
    statValue1,
    statValue2,
    statValue3,
    statValue4,
    statValue5,
    statName1,
    statName2,
    statName3,
    statName4,
    statName5,
    activeListingsCount,
    stakedCount,
    inPacksCount,
  ]);

  useEffect(() => {
    if (isQueueCarousel && edition_id !== null && edition_id !== undefined) {
      redeemedCountMeshRef.current = null;
      stakedCountMeshRef.current = null;
      saleCountMeshRef.current = null;
      unlistedCountMeshRef.current = null;
      inPacksCountMeshRef.current = null;
      lowAskMeshRef.current = null;
      highOfferMeshRef.current = null;
      medianSaleMeshRef.current = null;
      teamScoreMeshRef.current = null;
      remainingCountMeshRef.current = null;
      gameDateMeshRef.current = null;
      statValue1MeshRef.current = null;
      statValue2MeshRef.current = null;
      statValue3MeshRef.current = null;
      statValue4MeshRef.current = null;
      statValue5MeshRef.current = null;
      statName1MeshRef.current = null;
      statName2MeshRef.current = null;
      statName3MeshRef.current = null;
      statName4MeshRef.current = null;
      statName5MeshRef.current = null;
      inPacksBarRef.current = null;
      unlistedBarRef.current = null;
      forSaleBarRef.current = null;
      stakedBarRef.current = null;
      redeemedBarRef.current = null;
      scheduleBackTextRepair();
      retryMissingTextMeshes();
    }
  }, [
    edition_id,
    isQueueCarousel,
    scheduleBackTextRepair,
    retryMissingTextMeshes,
  ]);

  // Fetch RMV metrics: low_ask, high_offer, rolling_median_sale
  // Falls back to props if RMV fails
  useEffect(() => {
    if (!edition_id) {
      setFetchedRmvLowAsk(null);
      setFetchedRmvHighOffer(null);
      setFetchedRmvMedianSale(null);
      return;
    }

    const baseUrl = (import.meta as any).env.SUPABASE_URL as string | undefined;
    const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as string | undefined;
    if (!baseUrl || !anonKey) return;

    const root = baseUrl.replace(/\/$/, "");
    const url = `${root}/rest/v1/RMV?edition_id=eq.${encodeURIComponent(
      edition_id,
    )}&select=low_ask,high_offer,rolling_median_sale`;

    let cancelled = false;

    const formatWei = (value: string | number | null): string | null => {
      if (!value) return null;
      try {
        const bigValue = BigInt(String(value).trim());
        const wholePart = bigValue / BigInt(1e18);
        const remainder = bigValue % BigInt(1e18);
        const decimal = Number(wholePart) + Number(remainder) / 1e18;
        return `$${decimal.toFixed(2)}`;
      } catch {
        return null;
      }
    };

    fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
    })
      .then((res) => res.json())
      .then((rows) => {
        if (cancelled) return;

        if (Array.isArray(rows) && rows[0]) {
          const row = rows[0];
          setFetchedRmvLowAsk(formatWei(row.low_ask));
          setFetchedRmvHighOffer(formatWei(row.high_offer));
          setFetchedRmvMedianSale(formatWei(row.rolling_median_sale));
        } else {
          // No RMV data, use prop fallbacks
          setFetchedRmvLowAsk(lowAsk ?? null);
          setFetchedRmvHighOffer(highOffer ?? null);
          setFetchedRmvMedianSale(rollingMedianSale ?? null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn(`[EditionSplineScene] RMV fetch error, using fallback props:`, err);
        // RMV query failed (500 error, timeout, etc) - use prop fallbacks
        setFetchedRmvLowAsk(lowAsk ?? null);
        setFetchedRmvHighOffer(highOffer ?? null);
        setFetchedRmvMedianSale(rollingMedianSale ?? null);
      });

    return () => {
      cancelled = true;
    };
  }, [edition_id, lowAsk, highOffer, rollingMedianSale]);

  // Retrieve the preloaded font from cache (preloaded in AppLayout)
  useEffect(() => {
    if (font !== undefined) {
      return;
    }
    const cached = fontCache.get(EDITION_FONT_URL);
    if (!cached) return;

    if (cached instanceof Promise) {
      cached
        .then((loadedFont) => {
          setFallbackFont(loadedFont);
        })
        .catch(() => {});
    } else {
      setFallbackFont(cached);
    }
  }, [font]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setLoading(true);
    setWebglError(null);

    highlightVideoTextureRef.current = null;
    highlightVideoControlRef.current = null;
    glassMatRef.current = null;
    glassBaseColorRef.current = null;

    const cleanupFns: Array<() => void> = [];
    const overlayMeshes: THREE.Mesh[] = [];

    const getSize = () => ({
      width: container.clientWidth,
      height: container.clientHeight,
    });
    const { width, height } = getSize();

    const camera = new THREE.PerspectiveCamera(45, width / height, 70, 100000);
    const cameraPosZ = cameraZ !== null ? cameraZ : 713;
    camera.position.set(0, 0, cameraPosZ);
    camera.quaternion.setFromEuler(new THREE.Euler(0, 0, 0));

    const scene = new THREE.Scene();

    const normalizedTierValue =
      tierValue === null || tierValue === undefined
        ? ""
        : String(tierValue).trim();
    const normalizedBadgeValue =
      badge1 === null || badge1 === undefined ? "" : String(badge1).trim();
    const normalizedBadgeValueUpper = normalizedBadgeValue.toUpperCase();

    const normalizedBadge2Value =
      badge2 === null || badge2 === undefined ? "" : String(badge2).trim();
    const normalizedBadge2ValueUpper = normalizedBadge2Value.toUpperCase();

    const normalizedBadge3Value =
      badge3 === null || badge3 === undefined ? "" : String(badge3).trim();
    const normalizedBadge3ValueUpper = normalizedBadge3Value.toUpperCase();
    const allowTierSpotlights =
      normalizedTierValue === "Epic Tier" ||
      normalizedTierValue === "Rare Tier";
    const shouldDisplayBadgeFill =
      normalizedBadgeValueUpper === "CP" ||
      normalizedBadgeValueUpper === "RY" ||
      normalizedBadgeValueUpper === "CY";

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(0, 20, 400);
    dirLight.castShadow = false;
    scene.add(dirLight);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    let blueSpotlight: THREE.SpotLight | null = null;
    let blueSpotlightTarget: THREE.Object3D | null = null;
    let orangeSpotlight: THREE.SpotLight | null = null;

    if (allowTierSpotlights) {
      blueSpotlight = new THREE.SpotLight(0x004fff, 10);
      blueSpotlight.position.set(-400, 400, 30);
      blueSpotlight.distance = 1800;
      blueSpotlight.decay = 2;
      blueSpotlight.angle = 10;
      blueSpotlight.castShadow = true;
      scene.add(blueSpotlight);

      blueSpotlightTarget = new THREE.Object3D();
      blueSpotlightTarget.position.set(0, 0, 0);
      scene.add(blueSpotlightTarget);
      blueSpotlight.target = blueSpotlightTarget;

      orangeSpotlight = new THREE.SpotLight(0xff6300, 10);
      orangeSpotlight.position.set(400, -400, 30);
      orangeSpotlight.distance = 1800;
      orangeSpotlight.decay = 2;
      orangeSpotlight.angle = 10;
      orangeSpotlight.castShadow = true;
      scene.add(orangeSpotlight);
    }

    const dirTarget = new THREE.Object3D();
    scene.add(dirTarget);
    dirLight.target = dirTarget;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (err) {
      console.error("[EditionSplineScene] WebGL context creation failed:", err);
      setWebglError(String(err));
      setLoading(false);
      return;
    }

    if (!renderer) {
      console.error("[EditionSplineScene] Failed to create WebGL renderer");
      setWebglError("Failed to create 3D renderer");
      setLoading(false);
      return;
    }

    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(width, height);
    renderer.setClearColor(0xe3e3ed, 0.23);
    renderer.setClearAlpha(0.23);
    container.appendChild(renderer.domElement);
    renderer.domElement.style.pointerEvents = "none";
    renderer.domElement.style.position = "relative";
    renderer.domElement.style.zIndex = "1";
    if (isInTrophyCase) {
      renderer.domElement.style.cssText = `
        width: 100% !important;
        height: 100% !important;
        position: absolute !important;
        inset: 0 !important;
        pointer-events: none;
        z-index: 1 !important;
      `;
    }

    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    scene.background = null;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.125;
    controls.enabled = false;
    controls.enableZoom = false;
    controls.enableRotate = false;
    controls.enablePan = false;

    const videoTextures: THREE.VideoTexture[] = [];

    const badgeTextureLoader = new THREE.TextureLoader();

    const getBadgeTexture = (
      key: string,
      url: string,
      rendererInstance: THREE.WebGLRenderer,
    ) => {
      const cached = badgeTextureCache.get(key);
      if (cached) {
        return cached;
      }
      const tex = badgeTextureLoader.load(url, (loadedTex) => {
        loadedTex.needsUpdate = true;
      });
      if ((tex as any).colorSpace !== undefined) {
        (tex as any).colorSpace =
          (THREE as any).SRGBColorSpace ?? THREE.SRGBColorSpace;
      } else if ((tex as any).encoding !== undefined) {
        (tex as any).encoding =
          (THREE as any).sRGBEncoding ?? THREE.sRGBEncoding;
      }
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      const maxAnisotropy =
        typeof rendererInstance.capabilities.getMaxAnisotropy === "function"
          ? rendererInstance.capabilities.getMaxAnisotropy()
          : ((rendererInstance.capabilities as any).maxAnisotropy ?? 1);
      tex.anisotropy = Math.max(1, Math.min(maxAnisotropy ?? 1, 8));
      badgeTextureCache.set(key, tex);
      return tex;
    };

    let badgeGroup: THREE.Group | null = null;
    let badgeParent: THREE.Object3D | null = null;
    let badgeFillGeometry: THREE.PlaneGeometry | null = null;
    let badgeFillMaterial: THREE.MeshBasicMaterial | null = null;
    let badgeTexture: THREE.Texture | null = null;

    let badge2Group: THREE.Group | null = null;
    let badge2Parent: THREE.Object3D | null = null;
    let badge2FillGeometry: THREE.PlaneGeometry | null = null;
    let badge2FillMaterial: THREE.MeshBasicMaterial | null = null;
    let badge2Texture: THREE.Texture | null = null;

    let badge3Group: THREE.Group | null = null;
    let badge3Parent: THREE.Object3D | null = null;
    let badge3FillGeometry: THREE.PlaneGeometry | null = null;
    let badge3FillMaterial: THREE.MeshBasicMaterial | null = null;
    let badge3Texture: THREE.Texture | null = null;

    let teamBoxGroup: THREE.Group | null = null;
    let teamBoxParent: THREE.Object3D | null = null;
    let teamBoxFillGeometry: THREE.PlaneGeometry | null = null;
    let teamBoxFillMaterial: THREE.MeshBasicMaterial | null = null;
    let teamBoxTexture: THREE.Texture | null = null;

    let cdsLogoGroup: THREE.Group | null = null;
    let cdsLogoParent: THREE.Object3D | null = null;
    let cdsLogoGeometry: THREE.PlaneGeometry | null = null;
    let cdsLogoMaterial: THREE.MeshBasicMaterial | null = null;
    let cdsLogoTexture: THREE.Texture | null = null;

    let ownedCalloutGroup: THREE.Group | null = null;
    let ownedCalloutParent: THREE.Object3D | null = null;
    let ownedCalloutTextMesh: THREE.Mesh | null = null;

    let ownerNameGroup: THREE.Group | null = null;
    let ownerNameParent: THREE.Object3D | null = null;
    let ownerNameTextMesh: THREE.Mesh | null = null;

    const badgeTextureCache = new Map<string, THREE.Texture>();

    const createHlsVideoTexture = (url: string) => {
      const video = document.createElement("video");
      video.setAttribute("playsinline", "");
      video.autoplay = autoPlay;
      video.muted = true;
      video.loop = false;
      video.playsInline = true;
      video.crossOrigin = "anonymous";

      const tryPlay = () => {
        const ctrl = highlightVideoControlRef.current;
        if (ctrl && ctrl.video === video && ctrl.shouldStayFrozen) {
          return;
        }
        const p = video.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      };

      let hls: Hls | null = null;
      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, tryPlay);
        hls.on(Hls.Events.LEVEL_LOADED, tryPlay);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
        video.addEventListener("loadedmetadata", tryPlay);
        video.addEventListener("canplay", tryPlay);
      }

      const onPointer = () => tryPlay();
      const onVisibility = () => {
        if (!document.hidden) tryPlay();
      };
      window.addEventListener("pointerdown", onPointer);
      document.addEventListener("visibilitychange", onVisibility);

      const texture = new THREE.VideoTexture(video);
      if (
        (texture as any).colorSpace !== undefined &&
        (THREE as any).SRGBColorSpace !== undefined
      ) {
        (texture as any).colorSpace = (THREE as any).SRGBColorSpace;
      } else if (
        (texture as any).encoding !== undefined &&
        (THREE as any).sRGBEncoding !== undefined
      ) {
        (texture as any).encoding = (THREE as any).sRGBEncoding;
      }
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.format = THREE.RGBAFormat;

      videoTextures.push(texture);

      cleanupFns.push(() => {
        window.removeEventListener("pointerdown", onPointer);
        document.removeEventListener("visibilitychange", onVisibility);
        video.removeEventListener("loadedmetadata", tryPlay);
        video.removeEventListener("canplay", tryPlay);
      });

      return { video, texture, hls };
    };

    const loader = new SplineLoader();
    loader.load(
      resolvedSceneUrl,
      (splineScene: THREE.Object3D) => {
        scene.add(splineScene);
        splineSceneRef.current = splineScene;

        splineScene.traverse((child: any) => {
          if (
            child &&
            (child as any).isLight &&
            (child.type === "DirectionalLight" || child.type === "SpotLight")
          ) {
            (child as any).intensity = 0;
          }
        });

        splineScene.traverse((child: any) => {
          if (child?.name === "Card") cardRef.current = child as THREE.Object3D;
        });
        if (cardRef.current) {
          (cardRef.current as any).rotation.y = 0;
        }

        const calloutParent = cardRef.current ?? scene;

        // Create bars with placeholder geometry - widths will be set by the bar update effect
        // This avoids baking stale data into bars at scene creation time
        const barMaterial = new THREE.MeshStandardMaterial({ color: 0x767676 });
        const placeholderWidth = 0.1;

        const createBar = (yPos: number, name: string, ref: React.MutableRefObject<THREE.Mesh | null>) => {
          const barGeometry = new THREE.BoxGeometry(placeholderWidth, 12, 1);
          barGeometry.translate(-placeholderWidth / 2, 0, 0);
          const bar = new THREE.Mesh(barGeometry, barMaterial);
          bar.name = name;
          bar.position.set(10, yPos, -10);
          bar.scale.set(1, 1, 1);
          calloutParent.add(bar);
          ref.current = bar;
        };

        // Create all bars as placeholders - bar update effect will set correct widths
        createBar(95, "inPacksBar", inPacksBarRef);
        createBar(80, "unlistedBar", unlistedBarRef);
        createBar(65, "forSaleBar", forSaleBarRef);
        createBar(50, "stakedBar", stakedBarRef);
        createBar(35, "redeemedBar", redeemedBarRef);

        // Trigger bar width initialization effect
        setBarInitCounter(prev => prev + 1);

        // Create semi-transparent black overlay
        const overlayGeometry = new THREE.BoxGeometry(240, 33, 1);
        const overlayMaterial = new THREE.ShaderMaterial({
          uniforms: {
            color: { value: new THREE.Color(0x000000) },
            opacity: { value: 0.25 },
            blurAmount: { value: 2.0 },
          },
          vertexShader: `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform vec3 color;
            uniform float opacity;
            uniform float blurAmount;
            varying vec2 vUv;

            void main() {
              // Create smooth fade effects on all edges with completely transparent borders
              float fadeAmount = blurAmount * 0.25;
              // More gradual vertical fade (Y direction)
              float edgeFadeY = smoothstep(0.0, fadeAmount * 0.8, vUv.y) *
                               smoothstep(1.0, 1.0 - fadeAmount * 0.8, vUv.y);
              // No horizontal fade (X direction) - only vertical
              float edgeFadeX = 1.0;
              float alpha = edgeFadeY * edgeFadeX;
              // Ensure edges are completely transparent
              if (alpha < 0.01) discard;
              gl_FragColor = vec4(color, opacity * alpha);
            }
          `,
          transparent: true,
          side: THREE.DoubleSide,
          wireframe: false,
          fog: false,
        });
        const overlay = new THREE.Mesh(overlayGeometry, overlayMaterial);
        overlay.name = "overlay";
        overlay.position.set(0, 117, 8);
        overlay.scale.set(1, 1, 1);
        calloutParent.add(overlay);

        // Create second overlay with same settings at different position
        const overlay2Geometry = new THREE.BoxGeometry(240, 35, 1.2);
        const overlay2Material = new THREE.ShaderMaterial({
          uniforms: {
            color: { value: new THREE.Color(0x000000) },
            opacity: { value: 0.2 },
            blurAmount: { value: 2.0 },
          },
          vertexShader: `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform vec3 color;
            uniform float opacity;
            uniform float blurAmount;
            varying vec2 vUv;

            void main() {
              // Create smooth fade effects on all edges with completely transparent borders
              float fadeAmount = blurAmount * 0.25;
              // More gradual vertical fade (Y direction)
              float edgeFadeY = smoothstep(0.0, fadeAmount * 0.8, vUv.y) *
                               smoothstep(1.0, 1.0 - fadeAmount * 0.8, vUv.y);
              // No horizontal fade (X direction) - only vertical
              float edgeFadeX = 1.0;
              float alpha = edgeFadeY * edgeFadeX;
              // Ensure edges are completely transparent
              if (alpha < 0.01) discard;
              gl_FragColor = vec4(color, opacity * alpha);
            }
          `,
          transparent: true,
          side: THREE.DoubleSide,
          wireframe: false,
          fog: false,
        });
        const overlay2 = new THREE.Mesh(overlay2Geometry, overlay2Material);
        overlay2.name = "overlay2";
        overlay2.position.set(0, -18, 7.5);
        overlay2.scale.set(1, 1, 1);
        calloutParent.add(overlay2);

        if (!snapshotMode) {
          ownedCalloutGroup = new THREE.Group();
          ownedCalloutGroup.name = "owned_callout";
          ownedCalloutGroup.position.copy(OWNED_CALLOUT_POSITION);
          ownedCalloutGroup.userData.boundingBox = {
            width: OWNED_CALLOUT_DIMENSIONS.width,
            height: OWNED_CALLOUT_DIMENSIONS.height,
            depth: OWNED_CALLOUT_DIMENSIONS.depth,
          };

          ownedCalloutTextMesh = new THREE.Mesh(
            new THREE.BufferGeometry(),
            getHiddenTextMaterial(),
          );
          ownedCalloutTextMesh.name = "owned_callout_text";
          ownedCalloutGroup.add(ownedCalloutTextMesh);

          calloutParent.add(ownedCalloutGroup);
          ownedCalloutParent = calloutParent;

          if (effectiveFont) {
            const updatedOwnedCalloutMesh = applyTextMeshWithBoundingBox({
              target: ownedCalloutTextMesh,
              fontToUse: effectiveFont,
              textContent: ownedCalloutText,
              dimensions: OWNED_CALLOUT_DIMENSIONS,
              meshName: ownedCalloutTextMesh.name,
              boundingBoxKey: OWNED_CALLOUT_BOUNDING_BOX_KEY,
            });
            if (updatedOwnedCalloutMesh) {
              ownedCalloutTextMesh = updatedOwnedCalloutMesh as THREE.Mesh;
            }
          }

          ownerNameGroup = new THREE.Group();
          ownerNameGroup.name = "owner_name";
          ownerNameGroup.position.copy(OWNER_NAME_POSITION);
          ownerNameGroup.userData.boundingBox = {
            width: OWNER_NAME_DIMENSIONS.width,
            height: OWNER_NAME_DIMENSIONS.height,
            depth: OWNER_NAME_DIMENSIONS.depth,
          };

          ownerNameTextMesh = new THREE.Mesh(
            new THREE.BufferGeometry(),
            getHiddenTextMaterial(),
          );
          ownerNameTextMesh.name = "owner_name_text";
          ownerNameGroup.add(ownerNameTextMesh);

          calloutParent.add(ownerNameGroup);
          ownerNameParent = calloutParent;

          if (effectiveFont) {
            const updatedOwnerNameMesh = applyTextMeshWithBoundingBox({
              target: ownerNameTextMesh,
              fontToUse: effectiveFont,
              textContent: ownerNameText,
              dimensions: OWNER_NAME_DIMENSIONS,
              meshName: ownerNameTextMesh.name,
              boundingBoxKey: OWNER_NAME_BOUNDING_BOX_KEY,
            });
            if (updatedOwnerNameMesh) {
              ownerNameTextMesh = updatedOwnerNameMesh as THREE.Mesh;
            }
          }
        }

        badgeGroup = new THREE.Group();
        badgeGroup.name = "BadgeBoundingBox";
        badgeGroup.position.set(105, -17, 8.25);
        badgeGroup.userData.boundingBox = {
          width: BADGE_BOUNDING_SIZE,
          height: BADGE_BOUNDING_SIZE,
        };

        if (shouldDisplayBadgeFill) {
          const badgeTextureKey: "cp" | "ry" | "cy" =
            normalizedBadgeValueUpper === "RY"
              ? "ry"
              : normalizedBadgeValueUpper === "CY"
                ? "cy"
                : "cp";
          const badgeTextureUrl =
            badgeTextureKey === "ry"
              ? "/images/RY_badge_white.webp"
              : badgeTextureKey === "cy"
                ? "/images/CY_badge_white.webp"
                : "/images/CP_badge_white.webp";

          badgeFillGeometry = new THREE.PlaneGeometry(
            BADGE_BOUNDING_SIZE,
            BADGE_BOUNDING_SIZE,
          );
          badgeTexture = getBadgeTexture(
            badgeTextureKey,
            badgeTextureUrl,
            renderer,
          );

          badgeFillMaterial = new THREE.MeshBasicMaterial({
            map: badgeTexture,
            transparent: true,
            side: THREE.DoubleSide,
          });
          const badgeFill = new THREE.Mesh(
            badgeFillGeometry,
            badgeFillMaterial,
          );
          badgeFill.position.set(0, 0, 0.3);
          badgeGroup.add(badgeFill);
        }

        badgeParent = cardRef.current ?? scene;
        badgeParent.add(badgeGroup);

        badge2Group = new THREE.Group();
        badge2Group.name = "Badge2";
        badge2Group.position.set(80, -17, 8.25);
        badge2Group.userData.boundingBox = {
          width: BADGE_BOUNDING_SIZE,
          height: BADGE_BOUNDING_SIZE,
        };

        if (
          normalizedBadge2ValueUpper === "RY" ||
          normalizedBadge2ValueUpper === "CY"
        ) {
          const badge2TextureKey: "ry" | "cy" =
            normalizedBadge2ValueUpper === "RY" ? "ry" : "cy";
          const badge2TextureUrl =
            badge2TextureKey === "ry"
              ? "/images/RY_badge_white.webp"
              : "/images/CY_badge_white.webp";

          badge2FillGeometry = new THREE.PlaneGeometry(
            BADGE_BOUNDING_SIZE,
            BADGE_BOUNDING_SIZE,
          );
          badge2Texture = getBadgeTexture(
            badge2TextureKey,
            badge2TextureUrl,
            renderer,
          );
          badge2FillMaterial = new THREE.MeshBasicMaterial({
            map: badge2Texture,
            transparent: true,
            side: THREE.DoubleSide,
          });
          const badge2Fill = new THREE.Mesh(
            badge2FillGeometry,
            badge2FillMaterial,
          );
          badge2Fill.position.set(0, 0, 0.3);
          badge2Group.add(badge2Fill);
        }

        badge2Parent = cardRef.current ?? scene;
        badge2Parent.add(badge2Group);

        badge3Group = new THREE.Group();
        badge3Group.name = "Badge3";
        badge3Group.position.set(55, -17, 8.25);
        badge3Group.userData.boundingBox = {
          width: BADGE_BOUNDING_SIZE,
          height: BADGE_BOUNDING_SIZE,
        };

        if (normalizedBadge3ValueUpper === "CY") {
          badge3FillGeometry = new THREE.PlaneGeometry(
            BADGE_BOUNDING_SIZE,
            BADGE_BOUNDING_SIZE,
          );
          badge3Texture = getBadgeTexture(
            "cy",
            "/images/CY_badge_white.webp",
            renderer,
          );
          badge3FillMaterial = new THREE.MeshBasicMaterial({
            map: badge3Texture,
            transparent: true,
            side: THREE.DoubleSide,
          });
          const badge3Fill = new THREE.Mesh(
            badge3FillGeometry,
            badge3FillMaterial,
          );
          badge3Fill.position.set(0, 0, 0.3);
          badge3Group.add(badge3Fill);
        }

        badge3Parent = cardRef.current ?? scene;
        badge3Parent.add(badge3Group);

        // Create team_box
        teamBoxGroup = new THREE.Group();
        teamBoxGroup.name = "TeamBox";
        teamBoxGroup.position.set(-105, -17, 8.25);
        teamBoxGroup.userData.boundingBox = {
          width: BADGE_BOUNDING_SIZE,
          height: BADGE_BOUNDING_SIZE,
        };

        if (team) {
          const teamCrestUrl = getTeamCrest(team);
          if (teamCrestUrl) {
            teamBoxFillGeometry = new THREE.PlaneGeometry(
              BADGE_BOUNDING_SIZE,
              BADGE_BOUNDING_SIZE,
            );
            teamBoxTexture = new THREE.TextureLoader().load(teamCrestUrl);
            teamBoxFillMaterial = new THREE.MeshBasicMaterial({
              map: teamBoxTexture,
              transparent: true,
              side: THREE.DoubleSide,
            });
            const teamBoxFill = new THREE.Mesh(
              teamBoxFillGeometry,
              teamBoxFillMaterial,
            );
            teamBoxFill.position.set(0, 0, 0.3);
            teamBoxGroup.add(teamBoxFill);
          }
        }

        teamBoxParent = cardRef.current ?? scene;
        teamBoxParent.add(teamBoxGroup);

        requestAnimationFrame(() => setLoading(false));

        cdsLogoGroup = new THREE.Group();
        cdsLogoGroup.name = "CDSlogo";
        cdsLogoGroup.position.set(-109, -165, -10.3);
        cdsLogoGroup.rotation.set(0, Math.PI, 0);
        cdsLogoGroup.userData.boundingBox = {
          width: 25,
          height: 25,
          depth: 1,
        };

        cdsLogoGeometry = new THREE.PlaneGeometry(25, 25);
        cdsLogoTexture = getBadgeTexture(
          "cdsLogo",
          "/images/cds-logo-title.webp",
          renderer,
        );
        cdsLogoMaterial = new THREE.MeshBasicMaterial({
          map: cdsLogoTexture,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const cdsLogoMesh = new THREE.Mesh(cdsLogoGeometry, cdsLogoMaterial);
        cdsLogoMesh.position.set(0, 0, 0);
        cdsLogoGroup.add(cdsLogoMesh);

        cdsLogoParent = cardRef.current ?? scene;
        cdsLogoParent.add(cdsLogoGroup);

        cleanupFns.push(() => {
          try {
            if (
              ownedCalloutParent &&
              ownedCalloutGroup &&
              ownedCalloutParent.children.includes(ownedCalloutGroup)
            ) {
              ownedCalloutParent.remove(ownedCalloutGroup);
            }
          } catch {}
          try {
            ownedCalloutTextMesh?.geometry?.dispose?.();
          } catch {}

          try {
            if (
              ownerNameParent &&
              ownerNameGroup &&
              ownerNameParent.children.includes(ownerNameGroup)
            ) {
              ownerNameParent.remove(ownerNameGroup);
            }
          } catch {}
          try {
            ownerNameTextMesh?.geometry?.dispose?.();
          } catch {}

          ownedCalloutGroup = null;
          ownedCalloutParent = null;
          ownedCalloutTextMesh = null;
          ownerNameGroup = null;
          ownerNameParent = null;
          ownerNameTextMesh = null;

          try {
            if (
              badgeParent &&
              badgeGroup &&
              badgeParent.children.includes(badgeGroup)
            ) {
              badgeParent.remove(badgeGroup);
            }
          } catch {}
          try {
            if (
              badge2Parent &&
              badge2Group &&
              badge2Parent.children.includes(badge2Group)
            ) {
              badge2Parent.remove(badge2Group);
            }
          } catch {}
          try {
            if (
              badge3Parent &&
              badge3Group &&
              badge3Parent.children.includes(badge3Group)
            ) {
              badge3Parent.remove(badge3Group);
            }
          } catch {}
          try {
            if (
              cdsLogoParent &&
              cdsLogoGroup &&
              cdsLogoParent.children.includes(cdsLogoGroup)
            ) {
              cdsLogoParent.remove(cdsLogoGroup);
            }
          } catch {}
          try {
            badgeFillGeometry?.dispose();
          } catch {}
          try {
            badgeFillMaterial?.dispose();
          } catch {}
          try {
            badgeTexture?.dispose();
          } catch {}

          try {
            badge2FillGeometry?.dispose();
          } catch {}
          try {
            badge2FillMaterial?.dispose();
          } catch {}
          try {
            badge2Texture?.dispose();
          } catch {}

          try {
            badge3FillGeometry?.dispose();
          } catch {}
          try {
            badge3FillMaterial?.dispose();
          } catch {}
          try {
            badge3Texture?.dispose();
          } catch {}

          try {
            teamBoxFillGeometry?.dispose();
          } catch {}
          try {
            teamBoxFillMaterial?.dispose();
          } catch {}
          try {
            teamBoxTexture?.dispose();
          } catch {}

          try {
            cdsLogoGeometry?.dispose();
          } catch {}
          try {
            cdsLogoMaterial?.dispose();
          } catch {}
          try {
            cdsLogoTexture?.dispose();
          } catch {}

          badgeTextureCache.forEach((tex) => {
            try {
              tex.dispose();
            } catch {}
          });
          badgeTextureCache.clear();

          badgeGroup = null;
          badgeParent = null;
          badgeFillGeometry = null;
          badgeFillMaterial = null;
          badgeTexture = null;
          badge2Group = null;
          badge2Parent = null;
          badge2FillGeometry = null;
          badge2FillMaterial = null;
          badge2Texture = null;
          badge3Group = null;
          badge3Parent = null;
          badge3FillGeometry = null;
          badge3FillMaterial = null;
          badge3Texture = null;
          teamBoxGroup = null;
          teamBoxParent = null;
          teamBoxFillGeometry = null;
          teamBoxFillMaterial = null;
          teamBoxTexture = null;
          cdsLogoGroup = null;
          cdsLogoParent = null;
          cdsLogoGeometry = null;
          cdsLogoMaterial = null;
          cdsLogoTexture = null;
        });

        if (replaceSceneTextTargetsRef.current) {
          replaceSceneTextTargetsRef.current();
        }
        if (scheduleBackTextRepairRef.current) {
          scheduleBackTextRepairRef.current();
        }

        let highlightMesh: any = null;
        splineScene.traverse((child: any) => {
          if (child.name === "HighlightVideo" && child.isMesh) {
            highlightMesh = child;
            highlightMeshRef.current = child as THREE.Mesh;
          }
        });

        if (highlightMesh && resolvedOverlayUrl) {
          const toThumbnailUrl = (): string | null => {
            if (!resolvedOverlayUrl) return null;
            const m = resolvedOverlayUrl.match(
              /stream\.mux\.com\/(.*?)\.m3u8/i,
            );
            const id = m && m[1] ? m[1] : null;
            return id
              ? `https://image.mux.com/${id}/thumbnail.png?time=5`
              : null;
          };

          const supportsHlsPlayback = () => {
            try {
              const v = document.createElement("video");
              return (
                Hls.isSupported() ||
                !!v.canPlayType("application/vnd.apple.mpegurl")
              );
            } catch {
              return false;
            }
          };

          if (
            isFirefoxMobile ||
            !supportsHlsPlayback() ||
            isInTrophyCase ||
            snapshotMode
          ) {
            const thumb = toThumbnailUrl();
            if (thumb) {
              const applyFallback = (thumbUrl: string) => {
                if (!highlightMeshRef.current) return;
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => {
                  const maxDim = 1024;
                  const iw = img.naturalWidth || maxDim;
                  const ih = img.naturalHeight || maxDim;
                  const scale = maxDim / Math.max(iw, ih);
                  const w = Math.max(2, Math.round(iw * scale));
                  const h = Math.max(2, Math.round(ih * scale));
                  const canvas = document.createElement("canvas");
                  canvas.width = w;
                  canvas.height = h;
                  const ctx = canvas.getContext("2d");
                  if (!ctx) return;
                  ctx.drawImage(img, 0, 0, w, h);

                  if (!isInTrophyCase) {
                    const message1 =
                      "Video does not play in-relic on Firefox mobile";
                    const message2 = "Change browsers for best experience";
                    let fontSize = Math.round(h * 0.06);
                    ctx.font = `${fontSize}px sans-serif`;
                    const maxTextWidth = w * 0.9;
                    while (
                      (ctx.measureText(message1).width > maxTextWidth ||
                        ctx.measureText(message2).width > maxTextWidth) &&
                      fontSize > 10
                    ) {
                      fontSize -= 2;
                      ctx.font = `${fontSize}px sans-serif`;
                    }
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.shadowColor = "rgba(0,0,0,0.7)";
                    ctx.shadowBlur = Math.round(fontSize * 0.5);
                    ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.1));
                    ctx.strokeStyle = "rgba(0,0,0,0.75)";
                    ctx.fillStyle = "#ffffff";
                    const x = w / 2;
                    const y = h / 2;
                    const lineHeight = Math.round(fontSize * 1.3);
                    try {
                      ctx.strokeText(message1, x, y - lineHeight * 0.5);
                      ctx.fillText(message1, x, y - lineHeight * 0.5);
                      ctx.strokeText(message2, x, y + lineHeight * 0.5);
                      ctx.fillText(message2, x, y + lineHeight * 0.5);
                    } catch {}
                  }

                  const tex = new THREE.CanvasTexture(canvas);
                  if (
                    (tex as any).colorSpace !== undefined &&
                    (THREE as any).SRGBColorSpace !== undefined
                  ) {
                    (tex as any).colorSpace = (THREE as any).SRGBColorSpace;
                  } else if (
                    (tex as any).encoding !== undefined &&
                    (THREE as any).sRGBEncoding !== undefined
                  ) {
                    (tex as any).encoding = (THREE as any).sRGBEncoding;
                  }
                  tex.needsUpdate = true;
                  const mat = new THREE.MeshBasicMaterial({
                    map: tex,
                    side: THREE.DoubleSide,
                  });
                  try {
                    highlightMesh.material = mat;
                  } catch {}
                  cleanupFns.push(() => {
                    try {
                      (tex as any).dispose?.();
                    } catch {}
                    try {
                      mat.dispose();
                    } catch {}
                  });
                };
                img.src = thumbUrl;
              };
              applyFallback(thumb);
            }
          } else {
            const { texture, video, hls } =
              createHlsVideoTexture(resolvedOverlayUrl);

            const material = new THREE.MeshBasicMaterial({
              map: texture,
              side: THREE.DoubleSide,
            });
            highlightMesh.material = material;

            highlightVideoTextureRef.current = texture as THREE.VideoTexture;

            const highlightControl = {
              video,
              freeze: () => {},
              midTime: null as number | null,
              shouldStayFrozen: false,
            };
            highlightVideoControlRef.current = highlightControl;

            const applyThumbnailToHighlight = (thumbUrl: string) => {
              if (!highlightMeshRef.current) return;
              const tl = new THREE.TextureLoader();
              const t = tl.load(thumbUrl, (loaded) => {
                if (
                  (loaded as any).colorSpace !== undefined &&
                  (THREE as any).SRGBColorSpace !== undefined
                ) {
                  (loaded as any).colorSpace = (THREE as any).SRGBColorSpace;
                } else if (
                  (loaded as any).encoding !== undefined &&
                  (THREE as any).sRGBEncoding !== undefined
                ) {
                  (loaded as any).encoding = (THREE as any).sRGBEncoding;
                }
                loaded.needsUpdate = true;
              });
              try {
                const mat = highlightMeshRef.current.material as any;
                if (mat) {
                  mat.map = t;
                  mat.needsUpdate = true;
                }
              } catch {}
            };

            const freezeAtMidFrame = () => {
              const thumb = toThumbnailUrl();
              if (thumb) applyThumbnailToHighlight(thumb);
              highlightControl.midTime = null;
              highlightControl.shouldStayFrozen = true;
              try {
                video.pause();
              } catch {}
            };

            highlightControl.freeze = freezeAtMidFrame;

            const onEnded = () => {
              const thumb = toThumbnailUrl();
              if (thumb) applyThumbnailToHighlight(thumb);
              freezeAtMidFrame();
            };
            const onPlay = () => {
              if (!highlightControl.shouldStayFrozen) return;
              try {
                video.pause();
              } catch {}
              if (highlightControl.midTime != null) {
                try {
                  if (
                    Math.abs(video.currentTime - highlightControl.midTime) >
                    0.01
                  ) {
                    video.currentTime = highlightControl.midTime;
                  }
                } catch {}
              }
            };
            video.addEventListener("ended", onEnded);
            video.addEventListener("play", onPlay);

            cleanupFns.push(() => {
              try {
                video.removeEventListener("ended", onEnded);
              } catch {}
              try {
                video.removeEventListener("play", onPlay);
              } catch {}
              if (highlightVideoControlRef.current?.video === video) {
                highlightVideoControlRef.current = null;
              }
              try {
                video.pause();
              } catch {}
              try {
                (texture as any).dispose?.();
              } catch {}
              try {
                material.dispose();
              } catch {}
              try {
                hls?.destroy();
              } catch {}
            });
          }
        }

        try {
          const targets: any[] = [];
          splineScene.traverse((child: any) => {
            if (
              child?.isMesh &&
              (child.name === "CardMaterial" ||
                child.material?.name === "CardMaterial")
            ) {
              targets.push(child);
            }
          });

          if (targets.length > 0) {
            const glassMat = new THREE.MeshPhysicalMaterial({
              transmission: 0.7,
              transparent: true,
              opacity: 1,
              metalness: 0.05,
              roughness: 0.25,
              iridescence: 0.4,
              iridescenceIOR: 1.2,
              clearcoat: 0.85,
              clearcoatRoughness: 0.2,
              ior: 1.8,
              thickness: 6,
              envMapIntensity: 1.4,
              specularIntensity: 0.44,
              side: THREE.DoubleSide,
            });

            const shouldRenderRhombusOverlay =
              normalizedTierValue === "Epic Tier";

            let rhombusAlpha: THREE.Texture | null = null;
            let rhombusMaterial: THREE.MeshStandardMaterial | null = null;

            if (shouldRenderRhombusOverlay) {
              rhombusAlpha = createRhombusMaskTexture({
                coverage: 0.05,
                backgroundValue: 0,
                fillValue: 1,
                maxShapes: 400,
              });

              rhombusMaterial = new THREE.MeshStandardMaterial({
                name: "CardRhombusOverlay",
                color: new THREE.Color(0xffffff),
                metalness: 0.8,
                roughness: 0.25,
                transparent: true,
                opacity: 0.85,
                side: THREE.DoubleSide,
                depthWrite: false,
              });
              rhombusMaterial.envMapIntensity = 0;
              rhombusMaterial.emissive = new THREE.Color(0x000000);
              rhombusMaterial.emissiveIntensity = 0;
              rhombusMaterial.alphaTest = 0.05;
              rhombusMaterial.polygonOffset = true;
              rhombusMaterial.polygonOffsetFactor = -0.5;
              rhombusMaterial.polygonOffsetUnits = -1;
              if (rhombusAlpha) {
                rhombusAlpha.needsUpdate = true;
                rhombusMaterial.alphaMap = rhombusAlpha;
              }
            }

            glassMat.color.lerp(new THREE.Color("#FFFFFF"), 0.2);
            glassMatRef.current = glassMat;
            glassBaseColorRef.current = glassMat.color.clone();
            if (highlightVideoTextureRef.current) {
              glassMat.emissive = new THREE.Color(0xffffff);
              (glassMat as any).emissiveMap =
                highlightVideoTextureRef.current as any;
              glassMat.emissiveIntensity = 3;
            }
            glassMat.needsUpdate = true;

            targets.forEach((mesh: any) => {
              try {
                mesh.material?.dispose?.();
              } catch {}
              mesh.material = glassMat;

              if (
                shouldRenderRhombusOverlay &&
                rhombusMaterial &&
                mesh.isMesh
              ) {
                const overlayMesh = new THREE.Mesh(
                  mesh.geometry,
                  rhombusMaterial,
                );
                overlayMesh.name = `${mesh.name ?? "CardMaterial"}_RhombusOverlay`;
                overlayMesh.castShadow = false;
                overlayMesh.receiveShadow = false;
                overlayMesh.renderOrder = (mesh.renderOrder ?? 0) + 0.01;
                overlayMesh.frustumCulled = mesh.frustumCulled;
                overlayMesh.layers.mask = mesh.layers.mask;
                overlayMesh.visible = mesh.visible;
                overlayMesh.matrixAutoUpdate = true;
                overlayMesh.position.set(0, 0, 0);
                overlayMesh.quaternion.identity();
                overlayMesh.scale.set(1, 1, 1);

                mesh.add(overlayMesh);
                overlayMeshes.push(overlayMesh as THREE.Mesh);
              }
            });

            cleanupFns.push(() => {
              try {
                glassMat.dispose();
              } catch {}
              try {
                rhombusMaterial?.dispose();
              } catch {}
              try {
                rhombusAlpha?.dispose();
              } catch {}
              if (shouldRenderRhombusOverlay) {
                overlayMeshes.forEach((overlay) => {
                  try {
                    if (overlay.parent) {
                      overlay.parent.remove(overlay);
                    }
                  } catch {}
                });
              }
            });
          }
        } catch {}
      },
      undefined,
      (error) => {
        console.error("[EditionSplineScene] Scene loading error:", error);
        setWebglError("Failed to load 3D scene");
        setLoading(false);
      },
    );

    const onWindowResize = () => {
      const { width: w, height: h } = getSize();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (isInTrophyCase) {
        renderer.domElement.style.cssText = `
          width: 100% !important;
          height: 100% !important;
          position: absolute !important;
          inset: 0 !important;
          pointer-events: none;
          z-index: 1 !important;
        `;
      }
    };

    window.addEventListener("resize", onWindowResize);

    let resizeObserverRaf = 0;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeObserverRaf) cancelAnimationFrame(resizeObserverRaf);
      resizeObserverRaf = requestAnimationFrame(onWindowResize);
    });
    resizeObserver.observe(container);

    let snapshotFrameCount = 0;
    const animate = () => {
      for (const vt of videoTextures) {
        const vid = vt.image as HTMLVideoElement | undefined;
        if (vid && !vid.paused && !vid.ended && vid.readyState >= 2) {
          vt.needsUpdate = true;
        } else {
          vt.needsUpdate = false;
        }
      }

      const card = cardRef.current as any;
      if (card) {
        try {
          const cardWorld = card.getWorldPosition(tmpV3Ref.current);
          dirTarget.position.copy(cardWorld);
          dirLight.target.updateMatrixWorld();
        } catch {}
        const now = performance.now();
        if (tweenRef.current) {
          const { start, from, to, duration, easing } = tweenRef.current;
          const t = Math.min(1, (now - start) / duration);
          const v = easing(t);
          card.rotation.y = from + (to - from) * v;
          if (t >= 1) tweenRef.current = null;
        } else if (rotateLoopRef.current) {
          const elapsed =
            (now - rotateStartRef.current) % rotateDurationRef.current;
          const progress = elapsed / rotateDurationRef.current;
          const TWO_PI = Math.PI * 2;
          let rotation = rotateBaseRef.current + progress * TWO_PI;
          rotation = ((rotation % TWO_PI) + TWO_PI) % TWO_PI;
          card.rotation.y = rotation;
        }
      }

      if (glassMatRef.current && glassBaseColorRef.current) {
        const rotY = cardRef.current ? cardRef.current.rotation.y : 0;
        const TWO_PI = Math.PI * 2;
        const hue = (((rotY % TWO_PI) + TWO_PI) % TWO_PI) / TWO_PI;
        rainbowColorRef.current.setHSL(hue, 1, 0.5);
        const rainbowStrength = Math.abs(Math.sin(rotY));
        glassMatRef.current.color
          .copy(glassBaseColorRef.current)
          .lerp(rainbowColorRef.current, 0.1 * rainbowStrength);
        glassMatRef.current.needsUpdate = true;
      }

      if (glassMatRef.current) {
        const tex = highlightVideoTextureRef.current;
        const vid = tex?.image as HTMLVideoElement | undefined;
        const playing = !!(
          vid &&
          !vid.paused &&
          !vid.ended &&
          vid.readyState >= 2
        );
        glassMatRef.current.emissiveIntensity = playing ? 0.25 : 0.0;
      }

      try {
        controls.update();
        renderer.render(scene, camera);
      } catch (err) {
        console.error("[EditionSplineScene] Animation loop error:", err);
        // Continue animation loop even if render fails
      }

      if (snapshotMode && !loading) {
        snapshotFrameCount++;
        if (snapshotFrameCount >= 2) {
          (window as any).SNAPSHOT_READY = true;
          renderer.setAnimationLoop(null as any);
        }
      }
    };
    renderer.setAnimationLoop(animate);

    return () => {
      splineSceneRef.current = null;
      cardRef.current = null;

      redeemedCountMeshRef.current = null;
      stakedCountMeshRef.current = null;
      saleCountMeshRef.current = null;
      unlistedCountMeshRef.current = null;
      inPacksCountMeshRef.current = null;
      lowAskMeshRef.current = null;
      highOfferMeshRef.current = null;
      medianSaleMeshRef.current = null;
      teamScoreMeshRef.current = null;
      remainingCountMeshRef.current = null;
      gameDateMeshRef.current = null;
      statValue1MeshRef.current = null;
      statValue2MeshRef.current = null;
      statValue3MeshRef.current = null;
      statValue4MeshRef.current = null;
      statValue5MeshRef.current = null;
      statName1MeshRef.current = null;
      statName2MeshRef.current = null;
      statName3MeshRef.current = null;
      statName4MeshRef.current = null;
      statName5MeshRef.current = null;
      inPacksBarRef.current = null;
      unlistedBarRef.current = null;
      forSaleBarRef.current = null;
      stakedBarRef.current = null;
      redeemedBarRef.current = null;

      // Reset bar init counter when scene is destroyed so it's ready for next scene
      setBarInitCounter(0);

      try {
        renderer.setAnimationLoop(null as any);
      } catch {}
      try {
        window.removeEventListener("resize", onWindowResize);
        if (resizeObserverRaf) cancelAnimationFrame(resizeObserverRaf);
        resizeObserver.disconnect();
      } catch {}
      try {
        controls.dispose();
      } catch {}
      try {
        renderer.dispose();
      } catch {}
      try {
        scene.traverse((obj: any) => {
          if (obj.geometry) obj.geometry.dispose?.();
          if (obj.material) {
            if (Array.isArray(obj.material))
              obj.material.forEach((m: any) => m.dispose?.());
            else obj.material.dispose?.();
          }
        });
      } catch {}
      try {
        container.removeChild(renderer.domElement);
      } catch {}
      try {
        scene.remove(dirLight);
        scene.remove(dirTarget);
        scene.remove(ambientLight);
        if (blueSpotlight) scene.remove(blueSpotlight);
        if (orangeSpotlight) scene.remove(orangeSpotlight);
        if (blueSpotlightTarget) scene.remove(blueSpotlightTarget);
      } catch {}
      cleanupFns.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
    };
  }, [
    resolvedSceneUrl,
    resolvedOverlayUrl,
    tierValue,
    badge1,
    badge2,
    badge3,
    effectiveFont,
    applyTextMeshWithBoundingBox,
    getHiddenTextMaterial,
    ownedCalloutText,
    ownerNameText,
    isFirefoxMobile,
    snapshotMode,
    minted,
  ]);

  const maintainHighlightVideoFreeze = () => {
    const ctrl = highlightVideoControlRef.current;
    if (!ctrl || !ctrl.shouldStayFrozen) return;
    const { video, midTime } = ctrl;
    try {
      if (!video.paused) video.pause();
    } catch {}
    if (
      midTime != null &&
      video.paused &&
      Math.abs(video.currentTime - midTime) <= 0.05
    ) {
      return;
    }
    ctrl.freeze();
  };

  const hideVideoOverlay = () => {
    if (overlayVideoRef.current) {
      try {
        overlayVideoRef.current.pause();
      } catch {}
    }
    if (overlayHlsRef.current) {
      try {
        overlayHlsRef.current.destroy();
      } catch {}
      overlayHlsRef.current = null;
    }
  };

  const handleFront = () => {
    setMode("front");
    hideVideoOverlay();
    const ctrl = highlightVideoControlRef.current;
    if (ctrl) {
      ctrl.shouldStayFrozen = false;
      ctrl.midTime = null;
      const { video } = ctrl;
      const isPlaying = !video.paused && !video.ended;
      if (!isPlaying) {
        try {
          video.currentTime = 0;
        } catch {}
        try {
          if (highlightMeshRef.current && highlightVideoTextureRef.current) {
            const mat = highlightMeshRef.current.material as any;
            if (mat) {
              mat.map = highlightVideoTextureRef.current;
              mat.needsUpdate = true;
            }
          }
        } catch {}
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {});
        }
      }
    }
    startTweenTo(0, 1200, easeInOutCubic);
  };

  const handleBack = () => {
    setMode("back");
    hideVideoOverlay();
    scheduleBackTextRepair();
    maintainHighlightVideoFreeze();
    startTweenTo(Math.PI, 1200, easeInOutCubic);
  };

  const handleRotate = () => {
    setMode("rotate");
    hideVideoOverlay();
    maintainHighlightVideoFreeze();
    tweenRef.current = null;
    const card = cardRef.current;
    if (card) {
      const TWO_PI = Math.PI * 2;
      rotateBaseRef.current = ((card.rotation.y % TWO_PI) + TWO_PI) % TWO_PI;
    } else {
      rotateBaseRef.current = 0;
    }
    rotateLoopRef.current = true;
    rotateStartRef.current = performance.now();
  };

  const ensureOverlayVideo = () => {
    const video = overlayVideoRef.current;
    if (!video || !resolvedOverlayUrl) return;
    video.muted = false;
    video.volume = 1.0;
    video.controls = false;
    video.playsInline = true as any;
    const tryPlay = () => {
      try {
        video.muted = false;
        video.volume = 1.0;
        video.controls = false;
      } catch {}
      const p = video.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };
    if (overlayHlsRef.current) {
      tryPlay();
      return;
    }
    if (Hls.isSupported()) {
      const h = new Hls();
      overlayHlsRef.current = h;
      h.loadSource(resolvedOverlayUrl);
      h.attachMedia(video);
      h.on(Hls.Events.MANIFEST_PARSED, tryPlay);
      h.on(Hls.Events.LEVEL_LOADED, tryPlay);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = resolvedOverlayUrl;
      video.addEventListener("loadedmetadata", tryPlay, { once: true });
      video.addEventListener("canplay", tryPlay, { once: true });
    }
  };

  const handleVideo = () => {
    const duration = 1200;
    rotateLoopRef.current = false;
    tweenRef.current = null;
    maintainHighlightVideoFreeze();
    tweenToAndWait(0, duration, easeInOutCubic).then(() => {
      setMode("video");
      if (resolvedOverlayUrl) {
        setTimeout(ensureOverlayVideo, 0);
      }
    });
  };

  const hasOverlayVideo = Boolean(resolvedOverlayUrl);

  const controlButtonBase = "relative border border-slate-300";

  return (
    <div
      className={cn("w-full h-full", className)}
      style={{ backgroundColor: "transparent" }}
    >
      <div
        className="flex h-full w-full flex-col"
        style={{ backgroundColor: "transparent" }}
      >
        <div
          ref={containerRef}
          className="relative w-full flex-1 overflow-hidden border border-black/10 lg:h-[605px]"
          style={{ backgroundColor: "transparent" }}
        >
          {/* Background image */}
          {showBackgroundImage && (
            <div
              className="absolute z-0"
              style={{
                top: 0,
                left: 0,
                right: 0,
                height: "calc(100% + 40px)",
                backgroundImage: "url('/images/table.webp')",
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                filter: isDarkMode ? "brightness(0.25)" : "brightness(1)",
              }}
            />
          )}
          {loading && !webglError && (
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="text-base text-black">
                  Retrieving this relic from the vault
                </div>
                <div className="h-[4.5rem] w-[4.5rem] border-2 border-black border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
          )}
          {webglError && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-100">
              <div className="flex flex-col items-center gap-4 px-4 text-center">
                <div className="text-base text-slate-800 font-medium">
                  Unable to load 3D view
                </div>
                <div className="text-sm text-slate-600">{webglError}</div>
                <div className="text-xs text-slate-500 mt-2">
                  Please try a different browser or device with WebGL support.
                </div>
              </div>
            </div>
          )}
          {mode === "video" && hasOverlayVideo && !isInTrophyCase && (
            <div className="absolute inset-0 bg-black/80 z-10 flex flex-col items-center justify-center">
              {playerName && (
                <div
                  className="absolute top-0 left-0 right-0 text-center"
                  style={{
                    color: "rgba(196, 196, 196, 1)",
                    fontFamily: "Roboto, sans-serif",
                    fontSize: "24px",
                    fontWeight: "100",
                    textShadow: "2px 2px 4px rgba(128, 128, 128, 0.6)",
                  }}
                >
                  {playerName}
                </div>
              )}
              {gameDate && (
                <div
                  className="absolute left-0 right-0 text-center"
                  style={{
                    top: "32px",
                    color: "rgba(196, 196, 196, 1)",
                    fontFamily: "Roboto, sans-serif",
                    fontSize: "24px",
                    fontWeight: "100",
                    textShadow: "2px 2px 4px rgba(128, 128, 128, 0.6)",
                  }}
                >
                  {gameDate}
                </div>
              )}
              {minted && (
                <div
                  className="absolute left-0 right-0 text-center"
                  style={{
                    top: "64px",
                    color: "rgba(196, 196, 196, 1)",
                    fontFamily: "Roboto, sans-serif",
                    fontSize: "24px",
                    fontWeight: "100",
                  }}
                >
                  {serialNumber
                    ? `#${serialNumber} of ${minted} to ever exist`
                    : `One of ${minted} to ever exist`}
                </div>
              )}
              {team && (
                <div
                  className="absolute bottom-0 left-0"
                  style={{
                    width: "60px",
                    height: "60px",
                    filter: "drop-shadow(2px 2px 4px rgba(128, 128, 128, 0.6))",
                  }}
                >
                  <img
                    src={getTeamCrest(team) || ""}
                    alt={team}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              {badge1 && getBadgeImageUrl(badge1) && (
                <div
                  className="absolute bottom-0"
                  style={{
                    right: "0px",
                    width: "60px",
                    height: "60px",
                    filter: "drop-shadow(2px 2px 4px rgba(128, 128, 128, 0.6))",
                  }}
                >
                  <img
                    src={getBadgeImageUrl(badge1)}
                    alt="Badge 1"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              {badge2 && getBadgeImageUrl(badge2) && (
                <div
                  className="absolute bottom-0"
                  style={{
                    right: "60px",
                    width: "60px",
                    height: "60px",
                    filter: "drop-shadow(2px 2px 4px rgba(128, 128, 128, 0.6))",
                  }}
                >
                  <img
                    src={getBadgeImageUrl(badge2)}
                    alt="Badge 2"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              {badge3 && getBadgeImageUrl(badge3) && (
                <div
                  className="absolute bottom-0"
                  style={{
                    right: "120px",
                    width: "60px",
                    height: "60px",
                    filter: "drop-shadow(2px 2px 4px rgba(128, 128, 128, 0.6))",
                  }}
                >
                  <img
                    src={getBadgeImageUrl(badge3)}
                    alt="Badge 3"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              {isSerialPage && ownerNameText && (
                <div
                  className="absolute left-0 right-0 text-center"
                  style={{
                    bottom: "64px",
                    color: "rgba(196, 196, 196, 1)",
                    fontFamily: "Roboto, sans-serif",
                    fontSize: "24px",
                    fontWeight: "100",
                    textShadow: "2px 2px 4px rgba(128, 128, 128, 0.6)",
                  }}
                >
                  Owned by {ownerNameText}
                </div>
              )}
              <video
                ref={overlayVideoRef}
                className="w-full h-full object-contain"
                playsInline
                autoPlay={autoPlay}
                controls={false}
              />
            </div>
          )}
        </div>
        {showControls && !snapshotMode ? (
          <div className="w-full grid grid-cols-4 gap-2 items-stretch max-[380px]:text-xs h-[45px] md:h-[40px]">
            {mode === "front" ? (
              <button
                type="button"
                onClick={handleFront}
                className="w-full relative rounded border border-slate-300 bg-white text-slate-800 shadow-[0_5px_0_0_rgba(226,232,240,1)] px-1 py-0.5 sm:px-3 sm:py-1.5 text-sm sm:text-base focus:outline-none flex items-center justify-center"
              >
                <span
                  className="inline-flex items-center gap-1 whitespace-nowrap text-[18px] leading-[18px] sm:leading-[11px] md:text-[20px] md:leading-[20px]"
                >
                  FRONT
                </span>
              </button>
            ) : (
              <FilterStyleButton
                type="button"
                onClick={handleFront}
                className="w-full px-1 py-0.5 sm:px-3 sm:py-1.5 flex items-center justify-center"
              >
                <span
                  className="inline-flex items-center gap-1 whitespace-nowrap text-[18px] leading-[18px] sm:leading-[11px] md:text-[20px] md:leading-[20px]"
                >
                  FRONT
                </span>
              </FilterStyleButton>
            )}

            {mode === "back" ? (
              <button
                type="button"
                onClick={handleBack}
                className="w-full relative rounded border border-slate-300 bg-white text-slate-800 shadow-[0_5px_0_0_rgba(226,232,240,1)] px-1 py-0.5 sm:px-3 sm:py-1.5 text-sm sm:text-base focus:outline-none flex items-center justify-center"
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-1 whitespace-nowrap text-[18px] leading-[18px] sm:leading-[11px] md:text-[20px] md:leading-[20px]",
                    isQueueCarousel
                      ? "max-sm:text-sm"
                      : "max-sm:text-base max-sm:leading-4",
                  )}
                >
                  BACK
                </span>
              </button>
            ) : (
              <FilterStyleButton
                type="button"
                onClick={handleBack}
                className="w-full px-1 py-0.5 sm:px-3 sm:py-1.5 flex items-center justify-center"
              >
                <span
                  className="inline-flex items-center gap-1 whitespace-nowrap text-[18px] leading-[18px] sm:leading-[11px] md:text-[20px] md:leading-[20px]"
                >
                  BACK
                </span>
              </FilterStyleButton>
            )}

            {mode === "rotate" ? (
              <button
                type="button"
                onClick={handleRotate}
                className="w-full relative rounded border border-slate-300 bg-white text-slate-800 shadow-[0_5px_0_0_rgba(226,232,240,1)] px-1 py-0.5 sm:px-3 sm:py-1.5 text-sm sm:text-base focus:outline-none flex items-center justify-center"
              >
                <span
                  className="inline-flex items-center gap-1 whitespace-nowrap text-[18px] leading-[18px] sm:leading-[11px] md:text-[20px] md:leading-[20px]"
                >
                  ROTATE
                </span>
              </button>
            ) : (
              <FilterStyleButton
                type="button"
                onClick={handleRotate}
                className="w-full px-1 py-0.5 sm:px-3 sm:py-1.5 flex items-center justify-center"
              >
                <span
                  className="inline-flex items-center gap-1 whitespace-nowrap text-[18px] leading-[18px] sm:leading-[11px] md:text-[20px] md:leading-[20px]"
                >
                  ROTATE
                </span>
              </FilterStyleButton>
            )}

            {mode === "video" ? (
              <button
                type="button"
                onClick={handleVideo}
                disabled={!hasOverlayVideo}
                className="w-full relative rounded border border-slate-300 bg-white text-slate-800 shadow-[0_5px_0_0_rgba(226,232,240,1)] px-1 py-0.5 sm:px-3 sm:py-1.5 text-sm sm:text-base focus:outline-none disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center"
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-1 whitespace-nowrap text-sm sm:text-xs leading-[14px] sm:leading-[11px]",
                    isQueueCarousel
                      ? "max-sm:text-sm"
                      : "max-sm:text-base max-sm:leading-4",
                  )}
                >
                  <div className="text-[18px] md:text-[20px] md:leading-[20px]">VIDEO </div>
                  <Volume2 className="ml-0 h-[18px] w-[18px] md:h-[20px] md:w-[20px]" />
                </span>
              </button>
            ) : (
              <FilterStyleButton
                type="button"
                onClick={handleVideo}
                disabled={!hasOverlayVideo}
                className="w-full px-1 py-0.5 sm:px-3 sm:py-1.5 flex items-center justify-center"
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-1 whitespace-nowrap text-sm sm:text-xs leading-[14px] sm:leading-[11px]",
                    isQueueCarousel
                      ? "max-sm:text-sm"
                      : "max-sm:text-base max-sm:leading-4",
                  )}
                >
                  <div className="text-[18px] md:text-[20px] md:leading-[20px]">VIDEO </div>
                  <Volume2 className="ml-0 h-[18px] w-[18px] md:h-[20px] md:w-[20px]" />
                </span>
              </FilterStyleButton>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
