"use strict";

// Handles loading images from a file input
class ImageLoader {
  /**
   * @param {HTMLInputElement} inputElem
   * @param {(img: HTMLImageElement) => void} callback
   */
  constructor(inputElem, callback) {
    this.inputElem = inputElem;
    this.callback = callback;
    this.inputElem.addEventListener('change', this._onChange.bind(this));
  }

  _onChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => this.callback(img);
    img.src = URL.createObjectURL(file);
  }
}

// Generates the halftone radius matrix
class HalftoneGenerator {
  /**
   * @param {ImageData} imgData
   * @param {number} dotSize
   * @param {number} alphaThreshold
   * @returns {number[][]}
   */
  static generate(imgData, dotSize, alphaThreshold) {
    const { width, height, data } = imgData;
    const matrix = [];
    for (let y = 0; y < height; y += dotSize) {
      const row = [];
      for (let x = 0; x < width; x += dotSize) {
        const idx = (y * width + x) * 4;
        const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
        const gray = 0.3*r + 0.59*g + 0.11*b;
        if (a < alphaThreshold || gray > alphaThreshold) {
          row.push(0);
        } else {
          const radius = (1 - gray/255) * (dotSize/2);
          row.push(radius);
        }
      }
      matrix.push(row);
    }
    return matrix;
  }
}

// Renders halftone as filled blocks
class HalftoneRenderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); }
  /** @param {number[][]} matrix @param {number} dotSize */
  render(matrix, dotSize) {
    const rows = matrix.length;
    const cols = matrix[0]?.length || 0;
    this.canvas.width = cols * dotSize;
    this.canvas.height = rows * dotSize;
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    for (let y=0; y<rows; y++) {
      for (let x=0; x<cols; x++) {
        const rad = matrix[y][x];
        if (rad>0) {
          const gray = 255 - Math.round(rad/(dotSize/2)*255);
          this.ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
          this.ctx.fillRect(x*dotSize, y*dotSize, dotSize, dotSize);
        }
      }
    }
  }
}

// Renders halftone as circles
class MatrixRenderer {
  constructor(canvas) { this.canvas=canvas; this.ctx=canvas.getContext('2d'); }
  render(matrix, dotSize) {
    const rows=matrix.length, cols=matrix[0]?.length||0;
    this.canvas.width=cols*dotSize; this.canvas.height=rows*dotSize;
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    for(let ry=0; ry<rows; ry++){
      for(let cx=0; cx<cols; cx++){
        const radius=matrix[ry][cx];
        if(radius>0){
          const x=(cx+0.5)*dotSize;
          const y=(ry+0.5)*dotSize;
          this.ctx.beginPath();
          this.ctx.arc(x,y,radius,0,Math.PI*2);
          this.ctx.fillStyle='#000';
          this.ctx.fill();
        }
      }
    }
  }
}

// Renders halftone as ASCII
class ASCIIRenderer {
  constructor(canvas) { this.canvas=canvas; this.ctx=canvas.getContext('2d'); }
  /** @param {number[][]} matrix @param {number} dotSize @param {string} ramp */
  render(matrix, dotSize, ramp){
    const rows=matrix.length, cols=matrix[0]?.length||0;
    this.canvas.width=cols*dotSize; this.canvas.height=rows*dotSize;
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    this.ctx.font=`bold ${dotSize}px monospace`;
    this.ctx.fillStyle='#000'; this.ctx.textBaseline='top';
    for(let ry=0; ry<rows; ry++){
      for(let cx=0; cx<cols; cx++){
        const norm=matrix[ry][cx]/(dotSize/2);
        const idx=Math.min(ramp.length-1, Math.floor(norm*(ramp.length-1)));
        const ch=ramp[idx]||' ';
        this.ctx.fillText(ch, cx*dotSize, ry*dotSize);
      }
    }
  }
}

// Main UI controller
class UIController {
  constructor(){
    // DOM refs
    this.imageInput=document.getElementById('imageInput');
    this.originalCanvas=document.getElementById('originalCanvas');
    this.pixelCanvas=document.getElementById('pixelCanvas');
    this.halftoneCanvas=document.getElementById('halftoneCanvas');
    this.asciiCanvas=document.getElementById('asciiCanvas');
    this.downloadBtn=document.getElementById('downloadBtn');
    this.canvasButtons=document.querySelectorAll('#canvasButtons .canvasBtn');
    this.dotSizeInput=document.getElementById('dotSize');
    this.alphaSlider=document.getElementById('alphaThres');
    this.contrastInput=document.getElementById('contrast'); 
    this.ramp=" .･｡✧:☆;~^+*o#O@";
    this.selected='asciiCanvas';
    this.imgData=null;

    new ImageLoader(this.imageInput, this._onImageLoaded.bind(this));
    this._setupUI();

    // Load default image on first load
    const defaultSrc = 'Test.png'; // replace with your default image path
    const defaultImg = new Image();
    defaultImg.crossOrigin = 'anonymous';
    defaultImg.onload = () => {
      this._onImageLoaded(defaultImg);
    };
    defaultImg.src = defaultSrc;
  }

  /**
   * Applies contrast to an ImageData object and returns a new ImageData.
   * @param {ImageData} imgData
   * @param {number} contrast - contrast multiplier (1 = no change)
   */
  _applyContrast(imgData, contrast) {
    const { width, height, data } = imgData;
    const newPixels = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
      // adjust each channel
      newPixels[i]     = Math.min(255, Math.max(0, (data[i]     - 128) * contrast + 128));
      newPixels[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128));
      newPixels[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128));
      // preserve alpha
      newPixels[i + 3] = data[i + 3];
    }
    return new ImageData(newPixels, width, height);
  }

  _setupUI(){
    // canvas buttons
    this.canvasButtons.forEach(btn=>{
      btn.addEventListener('click',()=>{
        this._showCanvas(btn.dataset.canvas);
      });
    });
    this._showCanvas(this.selected);


    // download
    this.downloadBtn.addEventListener('click',()=>{
      const c=document.getElementById(this.selected);
      if(c){const link=document.createElement('a');link.href=c.toDataURL();link.download=`${this.selected}.png`;link.click();}
    });
    // slider events
    this.dotSizeInput.addEventListener('input',()=>this._redraw());
    this.alphaSlider.addEventListener('input',()=>this._redraw());
    if (this.contrastInput) {
      this.contrastInput.addEventListener('input', () => this._redraw());
    }

    //dropZone and file upload
    const dropZone = document.getElementById('dropZone');
    const importBttn =  document.getElementById('importBttn');

    // clicking the box opens file picker
    dropZone.addEventListener('click', () => this.imageInput.click());
    importBttn.addEventListener('click', () => this.imageInput.click());


    // highlight drop zone on dragover
    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.style.border = '2px dashed #606162'
      dropZone.style.backgroundColor =  'rgba(160, 160, 240, 0.15)';
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.style.border = '2px dashed #a0a0f0'
    });
    // when a file is dropped, assign it and trigger `change`
    dropZone.addEventListener('drop', e => {
      dropZone.style.border = '2px dashed #a0a0f0'
      e.preventDefault();
      e.stopPropagation();
      this.imageInput.files = e.dataTransfer.files;
      this.imageInput.dispatchEvent(new Event('change'));
    });
  }


  _showCanvas(id){
    ['originalCanvas','pixelCanvas','halftoneCanvas','asciiCanvas'].forEach(cid=>{
      const c=document.getElementById(cid);
      if(c)c.style.display=(cid===id?'block':'none');
    });
    this.selected=id;
  }

  _onImageLoaded(img){
    // upscale once
    const maxW = 2500;
    const w = img.width < maxW ? maxW : img.width;
    const h = img.height * (w / img.width);
    console.log(`Loaded image: ${img.width}px → ${w}px × ${h}px`);
    const ctx = this.originalCanvas.getContext('2d');
    this.originalCanvas.width = w; this.originalCanvas.height = h;
    ctx.clearRect(0,0,w,h);
    ctx.drawImage(img,0,0,w,h);
    this.imgData = ctx.getImageData(0,0,w,h);
    this._redraw();

    if (dropZone) {
      dropZone.style.backgroundImage = `url(${img.src})`;
      dropZone.style.backgroundSize = 'cover';
      dropZone.style.backgroundPosition = 'center';
    }
  }

  _redraw(){
    if(!this.imgData) return;
    const dot=+this.dotSizeInput.value;
    const alpha=+this.alphaSlider.value;
    const contrast = this.contrastInput ? +this.contrastInput.value : 1;

    // create a contrast-adjusted copy of the image data if needed
    let sourceData = this.imgData;
    if (contrast !== 1) {
      sourceData = this._applyContrast(this.imgData, contrast);
    }

    const mat=HalftoneGenerator.generate(sourceData,dot,alpha);
    new HalftoneRenderer(this.pixelCanvas).render(mat,dot);
    new MatrixRenderer(this.halftoneCanvas).render(mat,dot);
    new ASCIIRenderer(this.asciiCanvas).render(mat,dot,this.ramp);
  }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  new UIController();
});
