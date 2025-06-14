"use strict";

/**
 * Halftone ASCII Art Generator
 * ----------------------------
 * Loads an image, generates a halftone dot matrix, renders it to canvases,
 * and converts the result to ASCII art.
 */

// DOM & Canvas Elements
const imageInput = document.getElementById("imageInput");
const originalCanvas = document.createElement("canvas");
const grayscaleCanvas = document.createElement("canvas");
const matrixCanvas = document.createElement("canvas");
const asciiCanvas = document.createElement("canvas");

// Offscreen full-resolution canvas for exports
const fullResCanvas = document.createElement('canvas');
const fullResCtx = fullResCanvas.getContext('2d');

originalCanvas.id = "originalCanvas";
grayscaleCanvas.id = "grayscaleCanvas";
matrixCanvas.id = "matrixCanvas";
asciiCanvas.id = "asciiCanvas";

// Create and insert matrix canvas below existing canvases
const canvasContainer = document.getElementById("canvasContainer");

canvasContainer.appendChild(originalCanvas);
canvasContainer.appendChild(grayscaleCanvas);
canvasContainer.appendChild(matrixCanvas);
canvasContainer.appendChild(asciiCanvas);


const exportSelect = document.getElementById('exportCanvasSelect');
const downloadBtn   = document.getElementById('downloadBtn');

/**
 * Download a canvas element as a PNG file.
 * @param {HTMLCanvasElement} canvas - The canvas to export
 * @param {string} filename - The filename for download
 */
function downloadCanvas(canvas, filename) {
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = filename;
  link.click();
}

downloadBtn.addEventListener('click', () => {
  const selectedId = exportSelect.value;
  const srcCanvas  = document.getElementById(selectedId);
  if (!srcCanvas) {
    console.error('Canvas not found:', selectedId);
    return;
  }
  let exportCanvas = srcCanvas;
  if (selectedId === 'originalCanvas') {
    // For the original, export the full-resolution copy
    exportCanvas = fullResCanvas;
  } else {
    // Scale other canvases up to full original resolution
    const temp = document.createElement('canvas');
    temp.width  = fullResCanvas.width;
    temp.height = fullResCanvas.height;
    const tctx = temp.getContext('2d');
    tctx.drawImage(srcCanvas, 0, 0, temp.width, temp.height);
    exportCanvas = temp;
  }
  downloadCanvas(exportCanvas, `${selectedId}.png`);
});

// Show only the selected canvas to reduce clutter
exportSelect.addEventListener('change', () => {
  const canvasIds = ['grayscaleCanvas', 'matrixCanvas', 'asciiCanvas'];
  canvasIds.forEach(id => {
    const c = document.getElementById(id);
    if (c) {
      c.style.display = (id === exportSelect.value) ? 'block' : 'none';
    }
  });
});
// Initialize display state
exportSelect.dispatchEvent(new Event('change'));

const asciiCtx = asciiCanvas.getContext("2d");
const matrixCtx = matrixCanvas.getContext("2d");
const originalCtx = originalCanvas.getContext("2d");
const grayscaleCtx = grayscaleCanvas.getContext("2d");

const dotSizeSlider = document.getElementById("dotSize");
const alphaSlider = document.getElementById("alphaThres");
const ramp = " .,☆:~;*o✿O@@"
let dotSize = parseInt(dotSizeSlider.value);
let imgData; // store image data for halftone

let halftoneMatrix = []; // will store matrix of dot values


// Event Listeners
dotSizeSlider.addEventListener("input", () => {
    dotSize = parseInt(dotSizeSlider.value);
    console.log("Dot size changed to:", dotSize);
    drawHalftone();
});

alphaSlider.addEventListener("input", () => {
    drawHalftone();
});

/**
 * Generates the halftone dot matrix from the current image data,
 * draws the matrix on the grayscale and matrix canvases,
 * and triggers ASCII rendering.
 *
 * @returns {void}
 */
function drawHalftone() {
  if (!imgData) return;
  // Prepare full-resolution halftone on offscreen canvas
  fullResCanvas.width = originalCanvas.width;
  fullResCanvas.height = originalCanvas.height;
  fullResCtx.clearRect(0, 0, fullResCanvas.width, fullResCanvas.height);
  halftoneMatrix = [];
  const { width, height, data: pixels } = imgData;
  grayscaleCanvas.width = width;
  grayscaleCanvas.height = height;
  grayscaleCtx.clearRect(0, 0, width, height);

  // Loop over pixels in strides of dotSize to adjust density
  for (let y = 0; y < height; y += dotSize) {
    const row = [];
    for (let x = 0; x < width; x += dotSize) {
      const index = (y * width + x) * 4;
      const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2], a = pixels[index + 3];
      // brightness threshold from alpha slider
      const brightThreshold = parseInt(alphaSlider.value);
      // compute grayscale
      const gray = 0.3 * r + 0.59 * g + 0.11 * b;
      // skip too bright or transparent
      if (a < brightThreshold || gray > brightThreshold) {
        row.push(0);
        continue;
      }
      // radius scales with dotSize (halved)
      const radius = (1 - gray / 255) * (dotSize / 2);
      row.push(radius);
      if (radius > 0) {
        grayscaleCtx.beginPath();
        grayscaleCtx.arc(x + dotSize / 2, y + dotSize / 2, radius, 0, Math.PI * 2);
        grayscaleCtx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
        grayscaleCtx.fill();
        // Mirror drawing to full-resolution canvas
        fullResCtx.beginPath();
        fullResCtx.arc(x, y, radius, 0, Math.PI * 2);
        fullResCtx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
        fullResCtx.fill();
      }
    }
    halftoneMatrix.push(row);
  }
  drawMatrix();
  drawASCII();
}

/**
 * Renders the halftoneMatrix as solid circles on matrixCanvas.
 *
 * @returns {void}
 */
function drawMatrix() {
  if (halftoneMatrix.length === 0) return;
  const rows = halftoneMatrix.length;
  const cols = halftoneMatrix[0].length;
  // size matrixCanvas to match halftone grid
  matrixCanvas.width = cols * dotSize;
  matrixCanvas.height = rows * dotSize;
  matrixCtx.clearRect(0, 0, matrixCanvas.width, matrixCanvas.height);

  for (let ry = 0; ry < rows; ry++) {
    for (let cx = 0; cx < cols; cx++) {
      const radius = halftoneMatrix[ry][cx];
      if (radius > 0) {
        matrixCtx.beginPath();
        matrixCtx.arc(
          cx * dotSize + dotSize / 2,
          ry * dotSize + dotSize / 2,
          radius,
          0,
          Math.PI * 2
        );
        matrixCtx.fillStyle = "#000";
        matrixCtx.fill();
      }
    }
  }
}

/**
 * Converts halftoneMatrix values into characters using the ramp
 * and draws them on asciiCanvas.
 *
 * @returns {void}
 */
function drawASCII() {
  if (halftoneMatrix.length === 0) return;
  const rows = halftoneMatrix.length;
  const cols = halftoneMatrix[0].length;
  // size asciiCanvas to match character grid
  asciiCanvas.width  = cols * dotSize;
  asciiCanvas.height = rows * dotSize;
  asciiCtx.clearRect(0, 0, asciiCanvas.width, asciiCanvas.height);
  // set monospace bold font sized to dotSize
  asciiCtx.font = `bold ${dotSize}px monospace`;
  asciiCtx.fillStyle = '#000';
  asciiCtx.textBaseline = 'top';
  for (let ry = 0; ry < rows; ry++) {
    for (let cx = 0; cx < cols; cx++) {
      const radius = halftoneMatrix[ry][cx];
      // normalize radius to 0..1
      const norm = radius / (dotSize / 2);
      // Map normalized radius [0..1] to ramp index, clamped to [0, ramp.length-1]
      const idx = Math.min(
        ramp.length - 1,
        Math.floor(norm * (ramp.length - 1))
      );
      const ch = ramp[idx] || ' ';
      asciiCtx.fillText(ch, cx * dotSize, ry * dotSize);
    }
  }
}

imageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  //display original image on canvas
  const img = new Image();
  img.onload = function () {
    // Capture the full original image at its natural resolution
    fullResCanvas.width = img.width;
    fullResCanvas.height = img.height;
    fullResCtx.clearRect(0, 0, img.width, img.height);
    fullResCtx.drawImage(img, 0, 0);

    originalCanvas.width = img.width;
    originalCanvas.height = img.height;
    originalCtx.drawImage(img, 0, 0);

    imgData = originalCtx.getImageData(0, 0, img.width, img.height);
    drawHalftone();
    
  }
  img.src = URL.createObjectURL(file);
});
