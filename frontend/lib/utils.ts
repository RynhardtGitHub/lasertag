import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type Color = { r: number; g: number; b: number };

function weightedRgbDistance(color1:Color, 
  color2:Color) {
  const dr = color1.r - color2.r;
  const dg = color1.g - color2.g;
  const db = color1.b - color2.b;
  
  // Weight green more as human eye is more sensitive to it
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
}


function isColorMatch(detectedColor:string, targetColor:string, threshold = 50) {
  // Handle hex colors
  let scaledTarget;
  let scaledColor;
  
  if (typeof targetColor === 'string') {
    scaledTarget = hexToRgb(targetColor);
  }

  scaledColor = hexToRgb(detectedColor);

  if (!scaledTarget || !scaledColor) {
    return { isMatch: false, distance: Infinity };
  }

  
  const distance = weightedRgbDistance(scaledColor, scaledTarget);
  return {
    isMatch: distance <= threshold,
    distance: distance
  };
}


export function findClosestColor(detectedColor:string, targetColors:string[], threshold = 50) {
  let closestColor = null;
  let minDistance = Infinity;
  let closestIndex = -1;
  
  targetColors.forEach((target, index) => {
    const targetRgb = typeof target === 'string' ? hexToRgb(target) : target;
    const detectedRGB = typeof target === 'string' ? hexToRgb(detectedColor) : target;

    if (!targetRgb || !detectedRGB) {
      return; // Skip invalid colors
    }
    // Calculate the weighted RGB distance
    const distance = weightedRgbDistance(detectedRGB, targetRgb);
    
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = target;
      closestIndex = index;
    }
  });
  
  return {
    color: closestColor,
    index: closestIndex,
    distance: minDistance,
    isMatch: minDistance <= threshold
  };
}



/**
 * Get the closest color from a list based on RGB Manhatten distance.
 * @param {{r: number, g: number, b: number}} targetColor - The target color.
 * @param {Array<{r: number, g: number, b: number}>} colorList - Array of color objects.
 * @returns {{r: number, g: number, b: number}} - Closest color.
 */
export function getClosestColor(
  targetColor: { r: number; g: number; b: number },
  colorList: Array<{ r: number; g: number; b: number }>
) {
  // const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));

  // const brightness = (c: { r: number; g: number; b: number }) =>
  //   0.299 * c.r + 0.587 * c.g + 0.114 * c.b;

  // const scaleToBrightness = (c: { r: number; g: number; b: number }, targetB = 180) => {
  //   const b = brightness(c);
  //   if (b === 0) return c; // avoid division by zero
  //   const factor = targetB / b;
  //   return {
  //     r: clamp(c.r * factor),
  //     g: clamp(c.g * factor),
  //     b: clamp(c.b * factor),
  //   };
  // };

  // const scaledTarget = scaleToBrightness(targetColor);
  const scaledTarget = targetColor;

  let closest: { r: number; g: number; b: number } | null = null;
  let minDistance = Infinity;

  for (const color of colorList) {
    // const scaledColor = scaleToBrightness(color);
    const scaledColor = color;
    // console.log("Scaled Color:", JSON.stringify(scaledColor), "Target Color:", JSON.stringify(scaledTarget));
    
    const distance =
      Math.pow(scaledColor.r - scaledTarget.r, 2) +
      Math.pow(scaledColor.g - scaledTarget.g, 2) +
      Math.pow(scaledColor.b - scaledTarget.b, 2);

    if (distance < minDistance) {
      minDistance = distance;
      closest = color;
    }
  }

  return closest;
}


export function rgbToHex(r: number, g: number, b: number): string {
  return "#" +
    [r, g, b]
      .map(c => c.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace(/^#/, "");
  if (cleaned.length !== 6) return null;

  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);

  return { r, g, b };
}
