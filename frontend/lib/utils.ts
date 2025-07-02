import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility function to merge class names conditionally.
 * It uses clsx for conditional class names and twMerge to handle Tailwind CSS conflicts.
 * @param {...ClassValue} inputs - Class names or conditions to merge.
 * @returns {string} - Merged class names.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Represents a color in RGB format.
 * @typedef {Object} Color
 * @property {number} r - Red component (0-255).
 * @property {number} g - Green component (0-255).
 * @property {number} b - Blue component (0-255).
 */
export type Color = { r: number; g: number; b: number };

/**
 * Calculates the weighted RGB distance between two colors.
 * This function uses a weighted formula to account for human perception of color differences.
 * @param {Color} color1 - The first color object with r, g, b properties.
 * @param {Color} color2 - The second color object with r, g, b properties.
 * @returns {number} - The weighted RGB distance between the two colors.
 */
function weightedRgbDistance(color1:Color, 
  color2:Color) {
  const dr = color1.r - color2.r;
  const dg = color1.g - color2.g;
  const db = color1.b - color2.b;
  
  // Weight green more as human eye is more sensitive to it
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
}


/**
 * Checks if a detected color matches a target color within a given threshold.
 * @param {string} detectedColor - The detected color in hex format (e.g., "#FF5733").
 * @param {string} targetColor - The target color in hex format (e.g., "#FF5733").
 * @param {number} threshold - The maximum distance for a color to be considered a match.
 * @returns {{ isMatch: boolean, distance: number }} - An object indicating if the colors match and the distance.
 */
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


/**
 * Finds the closest color from a list of target colors to a detected color.
 * @param {string} detectedColor - The detected color in hex format (e.g., "#FF5733").
 * @param {string[]} targetColors - Array of target colors in hex format.
 * @param {number} threshold - The maximum distance for a color to be considered a match.
 * @returns {{color: string | null, index: number, distance: number, isMatch: boolean}} - The closest color and its index.
 */
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
  const scaledTarget = targetColor;

  let closest: { r: number; g: number; b: number } | null = null;
  let minDistance = Infinity;

  for (const color of colorList) {
    const scaledColor = color;
    console.log("scaledColor", scaledColor, "scaledTarget", scaledTarget);
    
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

/**
 * Converts RGB values to a hex color string.
 * @param {number} r - Red component (0-255).
 * @param {number} g - Green component (0-255).
 * @param {number} b - Blue component (0-255).
 * @returns {string} - The hex color string (e.g., "#FF5733").
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return "#" +
    [r, g, b]
      .map(c => c.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
}

/**
 * Converts a hex color string to an RGB object.
 * @param {string} hex - The hex color string (e.g., "#FF5733").
 * @returns {{ r: number, g: number, b: number } | null} - The RGB object or null if invalid.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace(/^#/, "");
  if (cleaned.length !== 6) return null;

  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);

  return { r, g, b };
}
