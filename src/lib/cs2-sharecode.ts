const DICTIONARY = 'ABCDEFGHJKLMNOPQRSTUVWXYZabcdefhijkmnopqrstuvwxyz23456789';
const DICTIONARY_LENGTH = BigInt(DICTIONARY.length);
const SHARECODE_PATTERN = /^CSGO(-?[\w]{5}){5}$/;

export interface MatchInformation {
  matchId: bigint;
  reservationId: bigint;
  tvPort: number;
}

export interface Crosshair {
  length: number;
  red: number;
  green: number;
  blue: number;
  gap: number;
  alphaEnabled: boolean;
  alpha: number;
  outlineEnabled: boolean;
  outline: number;
  color: number;
  thickness: number;
  centerDotEnabled: boolean;
  splitDistance: number;
  fixedCrosshairGap: number;
  innerSplitAlpha: number;
  outerSplitAlpha: number;
  splitSizeRatio: number;
  tStyleEnabled: boolean;
  deployedWeaponGapEnabled: boolean;
  /**
   * 0 => Default
   * 1 => Default static
   * 2 => Classic
   * 3 => Classic dynamic
   * 4 => Classic static
   */
  style: number;
}

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export function getCrosshairPreviewColor(crosshair: Pick<Crosshair, 'color' | 'red' | 'green' | 'blue'>): RGBColor {
  switch (crosshair.color) {
    case 0:
      return { r: 255, g: 0, b: 0 };
    case 1:
      return { r: 0, g: 255, b: 0 };
    case 2:
      return { r: 255, g: 255, b: 0 };
    case 3:
      return { r: 0, g: 0, b: 255 };
    case 4:
      return { r: 0, g: 255, b: 255 };
    case 5:
      return { r: crosshair.red, g: crosshair.green, b: crosshair.blue };
    default:
      return { r: 0, g: 255, b: 255 };
  }
}
export class InvalidShareCode extends Error {
  public constructor() {
    super('Invalid share code');
    Object.setPrototypeOf(this, InvalidShareCode.prototype);
  }
}

export class InvalidCrosshairShareCode extends Error {
  public constructor() {
    super('Invalid crosshair share code');
    Object.setPrototypeOf(this, InvalidCrosshairShareCode.prototype);
  }
}

function bytesToHex(bytes: number[]): string {
  return Array.from(bytes, (byte) => {
    return ('0' + (byte & 0xff).toString(16)).slice(-2);
  }).join('');
}

function bytesToBigInt(bytes: number[]): bigint {
  const hex = bytesToHex(bytes);

  return BigInt(`0x${hex}`);
}

function stringToBytes(str: string): number[] {
  const bytes: number[] = [];

  for (let i = 0; i < str.length; i += 2) {
    bytes.push(parseInt(str.slice(i, i + 2), 16));
  }

  return bytes;
}

function int16ToBytes(number: number): number[] {
  return [(number & 0x0000ff00) >> 8, number & 0x000000ff];
}

function uint8ToInt8(number: number) {
  return (number << 24) >> 24;
}

function sumArray(array: number[]) {
  return array.reduce((previousValue, value) => {
    return previousValue + value;
  }, 0);
}

function shareCodeToBytes(shareCode: string) {
  if (!shareCode.match(SHARECODE_PATTERN)) {
    throw new InvalidShareCode();
  }

  shareCode = shareCode.replace(/CSGO|-/g, '');
  const chars = Array.from(shareCode).reverse();
  let big = BigInt(0);
  for (let i = 0; i < chars.length; i++) {
    big = big * DICTIONARY_LENGTH + BigInt(DICTIONARY.indexOf(chars[i]));
  }

  const str = big.toString(16).padStart(36, '0');
  const bytes = stringToBytes(str);

  return bytes;
}

function bytesToShareCode(bytes: number[]) {
  const hex = bytesToHex(bytes);
  let total = BigInt(`0x${hex}`);
  let chars = '';
  for (let i = 0; i < 25; i++) {
    const rem = total % DICTIONARY_LENGTH;
    chars += DICTIONARY[Number(rem)];
    total = total / DICTIONARY_LENGTH;
  }

  return `CSGO-${chars.slice(0, 5)}-${chars.slice(5, 10)}-${chars.slice(10, 15)}-${chars.slice(15, 20)}-${chars.slice(
    20,
    25
  )}`;
}

/**
 * Match fields should come from a CDataGCCStrike15_v2_MatchInfo protobuf message.
 * https://github.com/SteamDatabase/Protobufs/blob/master/csgo/cstrike15_gcmessages.proto (lookup for `CDataGCCStrike15_v2_MatchInfo`).
 */
export function encodeMatch({ matchId, reservationId, tvPort }: MatchInformation): string {
  const matchBytes = stringToBytes(matchId.toString(16)).reverse();
  const reservationBytes = stringToBytes(reservationId.toString(16)).reverse();
  const tvBytes = int16ToBytes(tvPort).reverse();
  const bytes = [...matchBytes, ...reservationBytes, ...tvBytes];
  const shareCode = bytesToShareCode(bytes);

  return shareCode;
}

export function decodeMatchShareCode(shareCode: string): MatchInformation {
  const bytes = shareCodeToBytes(shareCode);

  return {
    matchId: bytesToBigInt(bytes.slice(0, 8).reverse()),
    reservationId: bytesToBigInt(bytes.slice(8, 16).reverse()),
    tvPort: Number(bytesToBigInt(bytes.slice(16, 18).reverse())),
  };
}

export function decodeCrosshairShareCode(shareCode: string): Crosshair {
  const bytes = shareCodeToBytes(shareCode);
  const size = sumArray(bytes.slice(1)) % 256;

  if (bytes[0] !== size) {
    throw new InvalidCrosshairShareCode();
  }

  const crosshair: Crosshair = {
    gap: uint8ToInt8(bytes[2]) / 10,
    outline: bytes[3] / 2,
    red: bytes[4],
    green: bytes[5],
    blue: bytes[6],
    alpha: bytes[7],
    splitDistance: bytes[8],
    fixedCrosshairGap: uint8ToInt8(bytes[9]) / 10,
    color: bytes[10] & 7,
    outlineEnabled: (bytes[10] & 8) === 8,
    innerSplitAlpha: (bytes[10] >> 4) / 10,
    outerSplitAlpha: (bytes[11] & 0xf) / 10,
    splitSizeRatio: (bytes[11] >> 4) / 10,
    thickness: bytes[12] / 10,
    centerDotEnabled: ((bytes[13] >> 4) & 1) === 1,
    deployedWeaponGapEnabled: ((bytes[13] >> 4) & 2) === 2,
    alphaEnabled: ((bytes[13] >> 4) & 4) === 4,
    tStyleEnabled: ((bytes[13] >> 4) & 8) === 8,
    style: (bytes[13] & 0xf) >> 1,
    length: bytes[14] / 10,
  };

  return crosshair;
}

export const clampCrosshairNumber = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
};

export const clampCrosshair = (crosshair: Crosshair): Crosshair => ({
  ...crosshair,
  length: clampCrosshairNumber(crosshair.length, 0, 10),
  gap: clampCrosshairNumber(crosshair.gap, -10, 10),
  thickness: clampCrosshairNumber(crosshair.thickness, 0.5, 6),
  outline: clampCrosshairNumber(crosshair.outline, 0, 3),
  alpha: Math.round(clampCrosshairNumber(crosshair.alpha, 0, 255)),
  red: Math.round(clampCrosshairNumber(crosshair.red, 0, 255)),
  green: Math.round(clampCrosshairNumber(crosshair.green, 0, 255)),
  blue: Math.round(clampCrosshairNumber(crosshair.blue, 0, 255)),
  color: Math.round(clampCrosshairNumber(crosshair.color, 0, 5)),
  style: Math.round(clampCrosshairNumber(crosshair.style, 0, 4)),
  splitDistance: Math.round(clampCrosshairNumber(crosshair.splitDistance, 0, 16)),
  fixedCrosshairGap: clampCrosshairNumber(crosshair.fixedCrosshairGap, -10, 10),
  innerSplitAlpha: clampCrosshairNumber(crosshair.innerSplitAlpha, 0, 1),
  outerSplitAlpha: clampCrosshairNumber(crosshair.outerSplitAlpha, 0, 1),
  splitSizeRatio: clampCrosshairNumber(crosshair.splitSizeRatio, 0, 1),
});

export function encodeCrosshair(crosshair: Crosshair): string {
  const normalized = clampCrosshair(crosshair);
  const bytes: number[] = [
    0,
    1,
    Math.round(normalized.gap * 10) & 0xff,
    Math.round(normalized.outline * 2),
    normalized.red,
    normalized.green,
    normalized.blue,
    normalized.alpha,
    normalized.splitDistance,
    Math.round(normalized.fixedCrosshairGap * 10) & 0xff,
    (normalized.color & 7) | (Number(normalized.outlineEnabled) << 3) | (Math.round(normalized.innerSplitAlpha * 10) << 4),
    Math.round(normalized.outerSplitAlpha * 10) | (Math.round(normalized.splitSizeRatio * 10) << 4),
    Math.round(normalized.thickness * 10),
    (normalized.style << 1) |
      (Number(normalized.centerDotEnabled) << 4) |
      (Number(normalized.deployedWeaponGapEnabled) << 5) |
      (Number(normalized.alphaEnabled) << 6) |
      (Number(normalized.tStyleEnabled) << 7),
    Math.round(normalized.length * 10),
    0,
    0,
    0,
  ];

  bytes[0] = sumArray(bytes) & 0xff;

  const shareCode = bytesToShareCode(bytes);

  return shareCode;
}

export function crosshairToConVars(crosshair: Crosshair): string {
  return `
cl_crosshair_drawoutline "${Number(crosshair.outlineEnabled)}"
cl_crosshair_dynamic_maxdist_splitratio "${crosshair.splitSizeRatio}"
cl_crosshair_dynamic_splitalpha_innermod "${crosshair.innerSplitAlpha}"
cl_crosshair_dynamic_splitalpha_outermod "${crosshair.outerSplitAlpha}"
cl_crosshair_dynamic_splitdist "${crosshair.splitDistance}"
cl_crosshair_outlinethickness "${crosshair.outline}"
cl_crosshair_t "${Number(crosshair.tStyleEnabled)}"
cl_crosshairalpha "${crosshair.alpha}"
cl_crosshaircolor "${crosshair.color}"
cl_crosshaircolor_b "${crosshair.blue}"
cl_crosshaircolor_g "${crosshair.green}"
cl_crosshaircolor_r "${crosshair.red}"
cl_crosshairdot "${Number(crosshair.centerDotEnabled)}"
cl_crosshairgap "${crosshair.gap}"
cl_crosshairgap_useweaponvalue "${Number(crosshair.deployedWeaponGapEnabled)}"
cl_crosshairsize "${crosshair.length}"
cl_crosshairstyle "${crosshair.style}"
cl_crosshairthickness "${crosshair.thickness}"
cl_crosshairusealpha "${Number(crosshair.alphaEnabled)}"
cl_fixedcrosshairgap "${crosshair.fixedCrosshairGap}"
`.trim();
}
