import * as tf from "@tensorflow/tfjs";
import { renderBoxes } from "./renderBox";

/**
 * Preprocess image / frame before forwarded into the model
 * @param {HTMLVideoElement|HTMLImageElement} source
 * @param {Number} modelWidth
 * @param {Number} modelHeight
 * @returns input tensor, xRatio and yRatio
 */
const preprocess = (source, modelWidth, modelHeight) => {
  let xRatio, yRatio; // ratios for boxes
  const input = tf.tidy(() => {
    const img = tf.browser.fromPixels(source);
    // padding image to square => [n, m] to [n, n], n > m
    const [h, w] = img.shape.slice(0, 2); // get source width and height
    const maxSize = Math.max(w, h); // get max size
    const imgPadded = img.pad([
      [0, maxSize - h], // padding y [bottom only]
      [0, maxSize - w], // padding x [right only]
      [0, 0],
    ]);
    xRatio = maxSize / w; // update xRatio
    yRatio = maxSize / h; // update yRatio
    return tf.image
      .resizeBilinear(imgPadded, [modelWidth, modelHeight]) // resize frame
      .div(255.0) // normalize
      .expandDims(0); // add batch
  });
  return [input, xRatio, yRatio];
};

/**
 * Function to detect image with OCR integration.
 * @param {HTMLImageElement|HTMLVideoElement} imgSource image/video source
 * @param {tf.GraphModel} net loaded YOLOv5 tensorflow.js model
 * @param {Array} inputShape model input shape
 * @param {Number} classThreshold class threshold
 * @param {HTMLCanvasElement} canvasRef canvas reference
 * @param {Function} onPlayerDetected callback when player with ID is detected
 */
export const detectImage = async (
  imgSource, 
  net, 
  inputShape, 
  classThreshold, 
  canvasRef, 
  onPlayerDetected = null
) => {
  const [modelWidth, modelHeight] = inputShape.slice(1, 3); // get model width and height
  console.log("Model dimensions:", modelWidth, modelHeight);
  
  tf.engine().startScope(); // start scoping tf engine
  
  try {
    const [input, xRatio, yRatio] = preprocess(imgSource, modelWidth, modelHeight);
    
    const res = await net.executeAsync(input);
    const [boxes, scores, classes] = res.slice(0, 3);
    const boxes_data = boxes.dataSync();
    const scores_data = scores.dataSync();
    const classes_data = classes.dataSync();
    
    // Call enhanced renderBoxes with OCR integration
    await renderBoxes(
      canvasRef, 
      imgSource, // Pass video source for OCR
      classThreshold, 
      boxes_data, 
      scores_data, 
      classes_data, 
      [xRatio, yRatio],
      onPlayerDetected // Pass callback for player detection
    );
    
    tf.dispose(res); // clear memory
    tf.dispose(input); // clear input tensor
  } catch (error) {
    console.error("Detection error:", error);
  }
  
  tf.engine().endScope(); // end of scoping
};

/**
 * Function to detect video from every source with OCR integration.
 * @param {HTMLVideoElement} vidSource video source
 * @param {tf.GraphModel} model loaded YOLOv5 tensorflow.js model
 * @param {Array} inputShape model input shape
 * @param {Number} classThreshold class threshold
 * @param {HTMLCanvasElement} canvasRef canvas reference
 * @param {Function} onPlayerDetected callback when player with ID is detected
 */
export const detectVideo = (
  vidSource, 
  model, 
  inputShape, 
  classThreshold, 
  canvasRef, 
  onPlayerDetected = null
) => {
  const [modelWidth, modelHeight] = inputShape.slice(1, 3); // get model width and height
  
  let isDetecting = false; // Prevent multiple concurrent detections
  
  /**
   * Function to detect every frame from video
   */
  const detectFrame = async () => {
    if (vidSource.videoWidth === 0 && vidSource.srcObject === null) {
      const ctx = canvasRef.getContext("2d");
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); // clean canvas
      return; // handle if source is closed
    }
    
    if (isDetecting) {
      requestAnimationFrame(detectFrame);
      return;
    }
    
    isDetecting = true;
    tf.engine().startScope(); // start scoping tf engine
    
    try {
      const [input, xRatio, yRatio] = preprocess(vidSource, modelWidth, modelHeight);
      
      const res = await model.executeAsync(input);
      const [boxes, scores, classes] = res.slice(0, 3);
      const boxes_data = boxes.dataSync();
      const scores_data = scores.dataSync();
      const classes_data = classes.dataSync();
      
      await renderBoxes(
        canvasRef,
        vidSource, // Pass video source for OCR
        classThreshold,
        boxes_data,
        scores_data,
        classes_data,
        [xRatio, yRatio],
        onPlayerDetected // Pass callback for player detection
      );
      
      tf.dispose(res); // clear memory
      tf.dispose(input); // clear input tensor
    } catch (error) {
      console.error("Video detection error:", error);
    }
    
    tf.engine().endScope(); // end of scoping
    isDetecting = false;
    
    requestAnimationFrame(detectFrame); // get another frame
  };
  
  detectFrame(); // initialize to detect every frame
};