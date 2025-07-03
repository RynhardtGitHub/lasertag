// Fixed renderBoxes function to prevent webcam freezing
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
  
  // Only set canvas size once when it changes, not every frame
  if (videoSource && videoSource.videoWidth > 0 && videoSource.videoHeight > 0) {
    if (canvasRef.width !== videoSource.videoWidth || canvasRef.height !== videoSource.videoHeight) {
      canvasRef.width = videoSource.videoWidth;
      canvasRef.height = videoSource.videoHeight;
    }
  }
  
  // Clear the canvas
  ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);

  const colors = new Colors();

  const font = `${Math.max(
    Math.round(Math.max(ctx.canvas.width, ctx.canvas.height) / 40),
    14
  )}px Arial`;
  
  ctx.font = font;
  ctx.textBaseline = "top";

  const canvasCenterX = canvasRef.width / 2;
  const canvasCenterY = canvasRef.height / 2;
  const centerStripLeft = canvasRef.width * 0.45;
  const centerStripRight = canvasRef.width * 0.55;

  let targetLocked=false;

  // Process detection boxes first
  for (let i = 0; i < scores_data.length; ++i) {
    if (scores_data[i] > classThreshold && classes_data[i] === 0) {
      const color = colors.get(classes_data[i]);

      let [x1, y1, x2, y2] = boxes_data.slice(i * 4, (i + 1) * 4);
      x1 *= canvasRef.width * ratios[0];
      x2 *= canvasRef.width * ratios[0];
      y1 *= canvasRef.height * ratios[1];
      y2 *= canvasRef.height * ratios[1];

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

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(Math.min(ctx.canvas.width, ctx.canvas.height) / 200, 2.5);
      ctx.strokeRect(x1, y1, width, height);
    }
  }

  let centerColor;
  if (videoSource && videoSource.videoWidth > 0 && targetLocked) {
      try {
          centerColor = getEnhancedCenterColor(videoSource, 10);
      } catch (error) {
          console.warn("Color detection error:", error);
      }

      if (!centerColor) {
        return;
      }
      onPlayerDetected(centerColor);
      // Draw crosshair
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(canvasCenterX - 20, canvasCenterY);
      ctx.lineTo(canvasCenterX + 20, canvasCenterY);
      ctx.moveTo(canvasCenterX, canvasCenterY - 20);
      ctx.lineTo(canvasCenterX, canvasCenterY + 20);
      ctx.stroke();

  }
};


// Enhanced function to get the center color with more robust sampling
function getEnhancedCenterColor(videoSource, size = 30) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // Use full resolution
  canvas.width = videoSource.videoWidth;
  canvas.height = videoSource.videoHeight;

  ctx.drawImage(videoSource, 0, 0);

  const centerX = Math.floor(canvas.width / 2);
  const centerY = Math.floor(canvas.height / 2);
  
  // Sample multiple points around center for more robust detection
  const samplePoints = [
    { x: centerX, y: centerY }, // Center
    { x: centerX - 10, y: centerY }, // Left
    { x: centerX + 10, y: centerY }, // Right
    { x: centerX, y: centerY - 10 }, // Top
    { x: centerX, y: centerY + 10 }, // Bottom
  ];

  let totalR = 0, totalG = 0, totalB = 0;
  let validSamples = 0;

  try {
    for (const point of samplePoints) {
      if (point.x >= 0 && point.x < canvas.width && 
          point.y >= 0 && point.y < canvas.height) {
        
        const imageData = ctx.getImageData(
          Math.max(0, point.x - size/2),
          Math.max(0, point.y - size/2),
          Math.min(size, canvas.width - point.x + size/2),
          Math.min(size, canvas.height - point.y + size/2)
        );
        
        const data = imageData.data;
        let r = 0, g = 0, b = 0, pixels = 0;

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 0) { // Valid pixel
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            pixels++;
          }
        }

        if (pixels > 0) {
          totalR += r / pixels;
          totalG += g / pixels;
          totalB += b / pixels;
          validSamples++;
        }
      }
    }

    if (validSamples === 0) {
      return { r: 0, g: 0, b: 0 };
    }

    return {
      r: Math.round(totalR / validSamples),
      g: Math.round(totalG / validSamples),
      b: Math.round(totalB / validSamples),
    };

  } catch (error) {
    console.error("Enhanced color detection error:", error);
    return { r: 0, g: 0, b: 0 };
  }
}

// Colors class to manage a palette of colors and convert hex to rgba
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
