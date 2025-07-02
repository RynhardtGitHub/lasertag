import labels from "./labels.json";
import Tesseract from "tesseract.js";

/**
 * Perform OCR on a specific region of the canvas
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {number} x - X coordinate of the region
 * @param {number} y - Y coordinate of the region
 * @param {number} width - Width of the region
 * @param {number} height - Height of the region
 * @returns {Promise<string>} - Detected text
 */
async function performOCROnRegion(canvas, x, y, width, height) {
  try {
    const ctx = canvas.getContext("2d");
    
    // Clamp coordinates to stay within canvas bounds
    const clampedX = Math.max(0, Math.min(x, canvas.width - 1));
    const clampedY = Math.max(0, Math.min(y, canvas.height - 1));
    const clampedWidth = Math.min(width, canvas.width - clampedX);
    const clampedHeight = Math.min(height, canvas.height - clampedY);
    
    // Skip if region is too small
    if (clampedWidth < 10 || clampedHeight < 10) {
      return "";
    }
    
    // Extract image data from the bounding box region
    const imageData = ctx.getImageData(clampedX, clampedY, clampedWidth, clampedHeight);
    
    // Create a temporary canvas for OCR
    const ocrCanvas = document.createElement("canvas");
    ocrCanvas.width = clampedWidth;
    ocrCanvas.height = clampedHeight;
    const ocrCtx = ocrCanvas.getContext("2d");
    ocrCtx.putImageData(imageData, 0, 0);
    
    // Perform OCR on the region
    const {
      data: { text },
    } = await Tesseract.recognize(ocrCanvas, "eng", {
      params: { 
        tessedit_char_whitelist: "ABPURM0123456789",
        tessedit_pageseg_mode: 8 // Treat the image as a single word
      },
    });
    
    return text.trim();
  } catch (error) {
    console.error("OCR error:", error);
    return "";
  }
}

/**
 * Render prediction boxes with OCR
 * @param {HTMLCanvasElement} canvasRef canvas tag reference
 * @param {HTMLVideoElement} videoSource video source for OCR
 * @param {number} classThreshold class threshold
 * @param {Array} boxes_data boxes array
 * @param {Array} scores_data scores array
 * @param {Array} classes_data class array
 * @param {Array[Number]} ratios boxes ratio [xRatio, yRatio]
 * @param {Function} onPlayerDetected callback when player with ID is detected
 */
export const renderBoxes = async (
  canvasRef,
  videoSource,
  classThreshold,
  boxes_data,
  scores_data,
  classes_data,
  ratios,
  onPlayerDetected = null
) => {
  const ctx = canvasRef.getContext("2d");
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); // clean canvas

  // First, draw the video frame to the canvas for OCR
  // if (videoSource && videoSource.videoWidth > 0) {
  //   canvasRef.width = videoSource.videoWidth;
  //   canvasRef.height = videoSource.videoHeight;
  //   ctx.drawImage(videoSource, 0, 0);
  // }

  const colors = new Colors();

  // font configs
  const font = `${Math.max(
    Math.round(Math.max(ctx.canvas.width, ctx.canvas.height) / 40),
    14
  )}px Arial`;
  ctx.font = font;
  ctx.textBaseline = "top";
  
  const canvasCenterX = canvasRef.width / 2;
  const canvasCenterY = canvasRef.height / 2;
  let detected = false;
  let targetLocked = false;
  let detectedColor;

  const centerStripLeft = canvasRef.width / 2 - canvasRef.width * 0.1; // 20% wide center strip
  const centerStripRight = canvasRef.width / 2 + canvasRef.width * 0.1;

  // Draw center crosshair
  // ctx.beginPath();
  // ctx.arc(canvasCenterX, canvasCenterY, 5, 0, 2 * Math.PI);
  // ctx.fillStyle = "#FF0000";
  // ctx.fill();
  // ctx.strokeStyle = "#fff";
  // ctx.lineWidth = 2;
  // ctx.stroke();

  // Process each detection
  for (let i = 0; i < scores_data.length; ++i) {
    // filter based on class threshold and only detect persons (class 0)
    if (scores_data[i] > classThreshold && classes_data[i] === 0) {
      detected = true;
      const klass = labels[classes_data[i]];
      const color = colors.get(classes_data[i]);
      const score = (scores_data[i] * 100).toFixed(1);

      let [x1, y1, x2, y2] = boxes_data.slice(i * 4, (i + 1) * 4);
      x1 *= canvasRef.width * ratios[0];
      x2 *= canvasRef.width * ratios[0];
      y1 *= canvasRef.height * ratios[1];
      y2 *= canvasRef.height * ratios[1];

      // Skip detections outside center strip
      if (x2 < centerStripLeft || x1 > centerStripRight) {
        continue;
      }

      const isInBox =
        canvasCenterX >= x1 &&
        canvasCenterX <= x2 &&
        canvasCenterY >= y1 &&
        canvasCenterY <= y2;

      if (isInBox) {
        targetLocked = true;
      }

      const width = x2 - x1;
      const height = y2 - y1;

      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(Math.min(ctx.canvas.width, ctx.canvas.height) / 200, 2.5);
      ctx.strokeRect(x1, y1, width, height);

      // Perform OCR on the bounding box region
      let detectedText = "";
      try {
        console.log("HERE")
        detectedText = await performOCROnRegion(canvasRef, 0, 0, canvasRef.width, canvasRef.height);
        console.log(`OCR detected text: "${detectedText}" in bounding box [${x1}, ${y1}, ${x2}, ${y2}]`);
        
        // Extract valid player IDs from detected text
        const matchedDigits = detectedText.match(/[ABPURM0-9]+/gi);
        if (matchedDigits && matchedDigits.length > 0) {
          const playerId = matchedDigits[0];
          if (playerId.length >= 1 && playerId.length <= 2) {
            console.log(`Detected player ID: ${playerId} in bounding box`);
            
            // Call callback if provided and player is targeted
            if (onPlayerDetected && isInBox) {
              onPlayerDetected(playerId, detectedColor);
            }
            
            // Update the label to include detected ID
            detectedText = playerId;
          }
        }
      } catch (error) {
        console.error("OCR processing error:", error);
      }

      // Draw the label background
      // ctx.fillStyle = color;
      // const labelText = detectedText ? 
      //   `${klass} - ${score}% - ID: ${detectedText}` : 
      //   `${klass} - ${score}%`;
      // const textWidth = ctx.measureText(labelText).width;
      // const textHeight = parseInt(font, 10);
      // const yText = y1 - (textHeight + ctx.lineWidth);
      
      // ctx.fillRect(
      //   x1 - 1,
      //   yText < 0 ? 0 : yText,
      //   textWidth + ctx.lineWidth,
      //   textHeight + ctx.lineWidth
      // );

      // Draw labels
      // ctx.fillStyle = "#ffffff";
      // ctx.fillText(labelText, x1 - 1, yText < 0 ? 0 : yText);
    }
  }

  // Update UI elements
  // const aimStatusEl = document.getElementById("aim-status");
  // if (aimStatusEl && targetLocked) {
  //   aimStatusEl.innerHTML = targetLocked ? "🎯 Aimed at person!" : "";
  //   const colorStatusEl = document.getElementById("center-color");
  //   if (colorStatusEl && detectedColor) {
  //     colorStatusEl.innerHTML = `🎨 Center color: rgb(${detectedColor.r}, ${detectedColor.g}, ${detectedColor.b})`;
  //     colorStatusEl.style.color = `rgb(${detectedColor.r}, ${detectedColor.g}, ${detectedColor.b})`;
  //   }
  // }
};

class Colors {
  constructor() {
    this.palette = [
      "#FF3838", "#FF9D97", "#FF701F", "#FFB21D", "#CFD231", "#48F90A",
      "#92CC17", "#3DDB86", "#1A9334", "#00D4BB", "#2C99A8", "#00C2FF",
      "#344593", "#6473FF", "#0018EC", "#8438FF", "#520085", "#CB38FF",
      "#FF95C8", "#FF37C7",
    ];
    this.n = this.palette.length;
  }

  get = (i) => this.palette[Math.floor(i) % this.n];

  static hexToRgba = (hex, alpha) => {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `rgba(${[parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)].join(
          ", "
        )}, ${alpha})`
      : null;
  };
}