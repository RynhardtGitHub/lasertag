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
    // Handle different source types (canvas, img element, video)
    let img;
    if (source instanceof HTMLCanvasElement) {
      img = tf.browser.fromPixels(source);
    } else if (source instanceof HTMLImageElement || source instanceof HTMLVideoElement) {
      img = tf.browser.fromPixels(source);
    } else {
      // Already a tensor
      img = source;
    }
    
    // Get source width and height
    const [h, w] = img.shape.slice(0, 2);
    const maxSize = Math.max(w, h); // get max size
    
    // Create padding configuration for square image
    const padH = maxSize - h;
    const padW = maxSize - w;
    
    const imgPadded = img.pad([
      [0, padH], // padding y [bottom only]
      [0, padW], // padding x [right only] 
      [0, 0],    // no padding for channels
    ]);
    
    // Calculate ratios for later box coordinate conversion
    xRatio = maxSize / w;
    yRatio = maxSize / h;
    
    // Resize to model input size and normalize
    return tf.image
      .resizeBilinear(imgPadded, [modelWidth, modelHeight])
      .div(255.0) // normalize to [0,1]
      .expandDims(0); // add batch dimension [1, height, width, channels]
  });
  
  return [input, xRatio, yRatio];
};


/**
 * Function to detect objects in an image or video frame using YOLOv5 model
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
  
  // Check if video source is ready
  if (imgSource instanceof HTMLVideoElement) {
    if (imgSource.videoWidth === 0 || imgSource.videoHeight === 0) {
      console.log("Video not ready for detection");
      return;
    }
  }
  
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
