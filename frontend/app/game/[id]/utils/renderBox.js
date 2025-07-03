import labels from "./labels.json";
import { getWebSocket } from "@/lib/websocket";

export const setupCanvasScaling = (canvasRef, scaleFactor = 0.8) => {
  // Scale the canvas visually using CSS transform
  canvasRef.style.transform = `scale(${scaleFactor})`;
  canvasRef.style.transformOrigin = 'center center';
  
  // Optional: Adjust positioning if needed
  canvasRef.style.position = 'absolute';
  canvasRef.style.top = '50%';
  canvasRef.style.left = '50%';
  canvasRef.style.marginTop = `-${canvasRef.height * scaleFactor / 2}px`;
  canvasRef.style.marginLeft = `-${canvasRef.width * scaleFactor / 2}px`;
};

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

          //TODO REMOVE THIS
          // const { r, g, b } = centerColor;
          // const text = `RGB: (${r}, ${g}, ${b})`;

          // const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          // ctx.fillStyle = brightness > 125 ? "black" : "white";

          // ctx.font = "16px Arial";
          // ctx.textBaseline = "bottom";
          // ctx.fillText(text, canvasCenterX + 10, canvasCenterY - 10);
      } catch (error) {
          console.warn("Color detection error:", error);
      }

      if (!centerColor) {
        return;
      }
      onPlayerDetected(centerColor);

      const { r, g, b } = centerColor;
      const text = `RGB: (${r}, ${g}, ${b})`;

      // Draw color info with better visibility
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(canvasCenterX + 15, canvasCenterY - 30, 150, 25);
      
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      ctx.fillStyle = brightness > 125 ? "white" : "yellow";
      ctx.font = "14px Arial";
      ctx.textBaseline = "middle";
      ctx.fillText(text, canvasCenterX + 20, canvasCenterY - 17);
      ctx.restore();

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

// Optimized detectVideo function with better frame management
export const detectVideo = (
  vidSource, 
  model, 
  inputShape, 
  classThreshold, 
  canvasRef, 
  onPlayerDetected = null
) => {
  const [modelWidth, modelHeight] = inputShape.slice(1, 3);
  
  let isDetecting = false;
  let animationId = null;
  let lastFrameTime = 0;
  const targetFPS = 30; // Limit to 30 FPS to prevent overload
  const frameInterval = 1000 / targetFPS;
  
  const detectFrame = async (currentTime) => {
    // Throttle frame rate
    if (currentTime - lastFrameTime < frameInterval) {
      animationId = requestAnimationFrame(detectFrame);
      return;
    }
    lastFrameTime = currentTime;
    
    // Check if video is still valid and playing
    if (!vidSource || vidSource.readyState < 2 || vidSource.videoWidth === 0 || vidSource.videoHeight === 0) {
      animationId = requestAnimationFrame(detectFrame);
      return;
    }
    
    if (isDetecting) {
      animationId = requestAnimationFrame(detectFrame);
      return;
    }
    
    isDetecting = true;
    
    try {
      // Use a more efficient detection approach
      tf.engine().startScope();
      
      const [input, xRatio, yRatio] = preprocess(vidSource, modelWidth, modelHeight);
      
      const res = await model.executeAsync(input);
      const [boxes, scores, classes] = res.slice(0, 3);
      const boxes_data = boxes.dataSync();
      const scores_data = scores.dataSync();
      const classes_data = classes.dataSync();
      
      await renderBoxes(
        canvasRef,
        vidSource,
        classThreshold,
        boxes_data,
        scores_data,
        classes_data,
        [xRatio, yRatio],
        onPlayerDetected
      );
      
      // Clean up tensors
      tf.dispose([res, input]);
      tf.engine().endScope();
      
    } catch (error) {
      console.error("Video detection error:", error);
      tf.engine().endScope();
    }
    
    isDetecting = false;
    animationId = requestAnimationFrame(detectFrame);
  };
  
  // Start detection loop
  animationId = requestAnimationFrame(detectFrame);
  
  // Return cleanup function
  return () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  };
};

function getCenterColor(videoSource, size = 20) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // Use full resolution for better accuracy
  canvas.width = videoSource.videoWidth;
  canvas.height = videoSource.videoHeight;

  ctx.drawImage(videoSource, 0, 0);

  const centerX = Math.floor(canvas.width / 2);
  const centerY = Math.floor(canvas.height / 2);
  
  // Use larger sampling area for more stable color detection
  const regionSize = Math.max(size, 30);

  try {
    const imageData = ctx.getImageData(
      centerX - regionSize / 2,
      centerY - regionSize / 2,
      regionSize,
      regionSize
    );
    const data = imageData.data;

    // Sample with outlier rejection for more stable color
    const samples = [];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) { // Check alpha channel
        samples.push({
          r: data[i],
          g: data[i + 1],
          b: data[i + 2]
        });
      }
    }

    if (samples.length === 0) {
      return { r: 0, g: 0, b: 0 };
    }

    // Use median values to reduce noise
    samples.sort((a, b) => a.r - b.r);
    const medianR = samples[Math.floor(samples.length / 2)].r;
    
    samples.sort((a, b) => a.g - b.g);
    const medianG = samples[Math.floor(samples.length / 2)].g;
    
    samples.sort((a, b) => a.b - b.b);
    const medianB = samples[Math.floor(samples.length / 2)].b;

    return { 
      r: Math.round(medianR), 
      g: Math.round(medianG), 
      b: Math.round(medianB) 
    };
    
  } catch (error) {
    console.error("Error getting image data:", error);
    return { r: 0, g: 0, b: 0 };
  }
}

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

// // Keep the working getCenterColor function
// function getCenterColor(videoSource, size = 10) {
//   let shrinkFactor = 1;

//   const canvas = document.createElement("canvas");
//   const ctx = canvas.getContext("2d");

//   canvas.width = Math.floor(videoSource.videoWidth / shrinkFactor);
//   canvas.height = Math.floor(videoSource.videoHeight / shrinkFactor);

//   ctx.drawImage(videoSource, 0, 0);
//   // Shrink the bounding box to the center region

//   const centerX = Math.floor(canvas.width / 2);
//   const centerY = Math.floor(canvas.height / 2);
//   const regionSize = size;

//   const imageData = ctx.getImageData(
//     centerX - regionSize / 2,
//     centerY - regionSize / 2,
//     regionSize,
//     regionSize
//   );
//   const data = imageData.data;

//   let r = 0, g = 0, b = 0;
//   const totalPixels = regionSize * regionSize;

//   for (let i = 0; i < data.length; i += 4) {
//     r += data[i];
//     g += data[i + 1];
//     b += data[i + 2];
//   }

//   r = Math.round(r / totalPixels);
//   g = Math.round(g / totalPixels);
//   b = Math.round(b / totalPixels);

//   return { r, g, b };
// }

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
