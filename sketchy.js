/* TODO:
Add multi-color support
More flexible resolutions
Refactor export for canvas
Grid lines
Undo/redo
Zoom
Layers?
Custom cursor
*/

const DEFAULT_RES = 32;
const BG_COLOR = `rgb(206, 206, 206)`;
const DRAW_COLOR = `rgb(90, 90, 90)`;
let menuBar = document.querySelector(".menu-bar");
let footer = document.querySelector(".footer");
let gridField = document.querySelector(".grid-field");
let drawField = document.querySelector(".draw-field");
let overlayCanvas = document.querySelector(".overlay");
let resInput = document.getElementById("resolution");
let resButton = document.querySelector(".res-button");
let animButton = document.querySelector(".anim-button");
let pngButton = document.querySelector(".png-button");
let gifButton = document.querySelector(".gif-button");
let buttons = [resButton, animButton, pngButton, gifButton];
let drawCtx;
let basisCtx;
let overlayCtx;
let grid;
let animBasis;
let bufferCanvas;
let resolution;
let clickHeld = false;
let fillCalls;
let lastPixelPos = {};
let animFrames = [];
let isAnimating = false;
let animTimer;
let isExporting = false;
let exportingSquare;
let lineCooldown = false;
let fillPixels = [];

class StateManager {
    constructor() {
        this.isAnimating = false;
        this._isExporting = false;
        this._isFilling = false;
    }

    isBlockingInput() {
        return this._isExporting || this._isFilling;
    }

    get isExporting() {
        return this._isExporting;
    }

    set isExporting(_bool) {
        if (_bool) {
            disableButtons();
        } else {
            enablebuttons();
        }
        this._isExporting = _bool;
    }

    get isFilling() {
        return this._isFilling;
    }

    set isFilling(_bool) {
        if (_bool) {
            disableButtons();
        } else {
            enablebuttons();
        }
        this._isFilling = _bool;
    }
}

function disableButtons() {
    for (let button of buttons) {
        button.classList.replace("active", "inactive");
        button.disabled = true;
    }
}

function enablebuttons() {
    for (let button of buttons) {
        button.classList.replace("inactive", "active");
        button.removeAttribute("disabled");
    }
}

function init(_fieldSize, _resolution, _color) {
    resolution = _resolution;
    if (stateManager.isAnimating) toggleAnimating();
    drawField.width = resolution;
    drawField.height = resolution;
    setGridFieldSize(_fieldSize);
    drawCtx = drawField.getContext("2d", { willReadFrequently: true });
    drawCtx.mozImageSmoothingEnabled = false;
    drawCtx.webkitImageSmoothingEnabled = false;
    drawCtx.msImageSmoothingEnabled = false;
    drawCtx.imageSmoothingEnabled = false;
    drawCtx.fillStyle = _color;
    drawCtx.fillRect(0, 0, resolution, resolution);
    //animBasis = createCanvas(resolution, resolution, "anim-basis");
    overlayCanvas.width = _fieldSize;
    overlayCanvas.height = _fieldSize;
    overlayCtx = overlayCanvas.getContext("2d");
    overlayCtx.clearRect(0, 0, _fieldSize, _fieldSize);
    animBasis = new OffscreenCanvas(resolution, resolution);
    basisCtx = animBasis.getContext("2d");
    basisCtx.drawImage(drawField, 0, 0);
    animFrames = [{ pixel: [], type: "init" }];

    /*
    if (gridField.querySelector(".grid-square")) {
        for (let column of grid) {
            for (let square of column) {
                gridField.removeChild(square);
            }
        }
    }
    grid = [];
    setGridFieldSize(_fieldSize, resolution);
    animFrames = [];
    for (let i = 0; i < _resolution; i++) {
        grid[i] = [];
        for (let j = 0; j < _resolution; j++) {
            grid[i][j] = document.createElement("div");
            grid[i][j].classList.add("grid-square");
            grid[i][j].style.backgroundColor = BG_COLOR;
            grid[i][j].style.gridRowStart = j + 1;
            grid[i][j].style.gridRowEnd = j + 2;
            gridField.appendChild(grid[i][j]);
            grid[i][j].addEventListener("mousedown", (_e) => {
                if (isExporting) return;
                _e.preventDefault();
                if (!isAnimating) {
                    if (_e.button === 2) {
                        fillCalls = 0;
                        fill(i, j, BG_COLOR, DRAW_COLOR);
                    }
                }
            });
        }
    }
    */
}

function getPixelPosition(_pageX, _pageY) {
    //console.log(`x: ${_e.pageX}, y: ${_e.pageY}`);
    let xPosInCanvas = _pageX - drawField.offsetLeft;
    let yPosInCanvas = _pageY - drawField.offsetTop;
    //console.log(`xPosInCanvas: ${xPosInCanvas}, yPosInCanvas: ${yPosInCanvas}`);
    //console.log(`xDrawPos: ${xPosInCanvas * (resolution / getViewableSize())}, yDrawPos: ${yPosInCanvas * (resolution / getViewableSize())}`);
    let xPixelPos = Math.floor(xPosInCanvas * (resolution / getViewableSize()));
    let yPixelPos = Math.floor(yPosInCanvas * (resolution / getViewableSize()));
    return { x: xPixelPos, y: yPixelPos };
}

function clickDraw(_e) {
    if (stateManager.isBlockingInput()) return;
    _e.preventDefault();
    if (!stateManager.isAnimating) {
        if (_e.button === 0) {
            clickHeld = true;
            drawPoint(_e, "rgba(0, 0, 0, 1)");
        } else if (_e.button === 2) {
            fillCalls = 1;
            fillPixels = [];
            fill(getPixelPosition(_e.pageX, _e.pageY), "rgba(255, 255, 255, 1)", "rgba(0, 0, 0, 1)");
            //animFrames.push({ pixel: pixels, type: "fill" });
        }
    }
}

function dragDraw(_e) {
    //console.log(`drag draw enter`);
    if (stateManager.isBlockingInput()) return;
    if (clickHeld && !stateManager.isAnimating && 
        (animFrames[animFrames.length - 1].type === "drawLine" || getPixelPosition() != lastPixelPos)) {
        console.log(animFrames[animFrames.length - 1].type);
        drawLine(lastPixelPos, _e, "rgba(0, 0, 0, 1)");
        //console.log(`drag draw`);
        //drawPoint(_e);
    }
}

function drawPoint(_e, _color) {
    let pixelPos = getPixelPosition(_e.pageX, _e.pageY);
    drawCtx.fillStyle = _color;
    drawCtx.fillRect(pixelPos.x, pixelPos.y, 1, 1);
    lastPixelPos = pixelPos;
    animFrames.push({ pixel: [{ position: pixelPos, color: _color }], type: "drawPoint" });
}

function drawAnimPoint(_pixel, _context) {
    _context.fillStyle = _pixel.color;
    _context.fillRect(_pixel.position.x, _pixel.position.y, 1, 1);
}

/* This function is necessary to fix a problem where lag causes skips in what
should be a continuously drawn line. We're playing connect-the-dots between 
known cursor positions, basically. */
function drawLine(_oldPixelPos, _e, _color) {
    /* drawLine will always be preceded by drawPoint because we can't know the 
    user's intent initially. If they go on to draw a line, we move the animFrame 
    that we drew for the initial point into the line's animFrame. */
    let pixels = animFrames.pop().pixel;
    let pixelPos = getPixelPosition(_e.pageX, _e.pageY);
    drawCtx.fillStyle = _color;
    let xDist = Math.abs(pixelPos.x - _oldPixelPos.x);
    let yDist = Math.abs(pixelPos.y - _oldPixelPos.y);
    let hypot = Math.sqrt(xDist ** 2 + yDist ** 2);
    for (let i = 1; i < hypot + 1; i++) {
        let linePos = {};
        let move = {
            right: Math.round(_oldPixelPos.x + xDist * (i / hypot)),
            left: Math.round(_oldPixelPos.x - xDist * (i / hypot)),
            down: Math.round(_oldPixelPos.y + yDist * (i / hypot)),
            up: Math.round(_oldPixelPos.y - yDist * (i / hypot))
        };
        if (_oldPixelPos.x < pixelPos.x) linePos.x = move.right;
        else linePos.x = move.left;
        if (_oldPixelPos.y < pixelPos.y) linePos.y = move.down;
        else linePos.y = move.up;
        drawCtx.fillRect(linePos.x, linePos.y, 1, 1);
        pixels.push({ position: linePos, color: _color });
    }
    lastPixelPos = pixelPos;
    animFrames.push({ pixel: pixels, type: "drawLine" });
}

function fill(_pixelPos, _oldColor, _newColor) {
    //console.log(`entering fill (calls: ${fillCalls})`);
    function callSelf() {
        //let returnArr = [];
        let dirArr = [{ x: _pixelPos.x, y: _pixelPos.y - 1 }, 
            { x: _pixelPos.x + 1, y: _pixelPos.y }, 
            { x: _pixelPos.x, y: _pixelPos.y + 1 }, 
            { x: _pixelPos.x - 1, y: _pixelPos.y }];
        // Randomize direction order because it looks cool
        while (dirArr.length) {
            let rnd = Math.floor(Math.random() * dirArr.length);
            fill(dirArr[rnd], _oldColor, _newColor);
            dirArr.splice(rnd, 1);
        }
        /*
        for (let pixel of returnArr) {
            if (pixel) returnPixel.push(...pixel);
        }
        */
    }
    function closeFillCall() {
        fillCalls--;
        if (fillCalls <= 0) {
            animFrames.push({ pixel: fillPixels, type: "fill" });
            stateManager.isFilling = false;
        }
        //console.log(`${stateManager.isBlockingInput()}, ${fillCalls} calls`);
    }
    //let returnPixel = [];
    if (_pixelPos.x < 0 || _pixelPos.x >= resolution || 
        _pixelPos.y < 0 || _pixelPos.y >= resolution) {
            //console.log(`ending fill because pixel is out of range`);
            closeFillCall();
            return;
        }
    let pixel = drawCtx.getImageData(_pixelPos.x, _pixelPos.y, 1, 1);
    oldColorArray = getArrayFromRGBA(_oldColor);
    if (pixel.data[0] != oldColorArray[0] ||
        pixel.data[1] != oldColorArray[1] ||
        pixel.data[2] != oldColorArray[2] ||
        pixel.data[3] != Math.round(oldColorArray[3] * 255)) {
        /*
        console.log(`ending fill because pixel is wrong color`);
        console.log(`pixel.data[0]: ${pixel.data[0]}`);
        console.log(`oldColorArray[0]: ${oldColorArray[0]}`);
        console.log(`pixel.data[1]: ${pixel.data[1]}`);
        console.log(`oldColorArray[1]: ${oldColorArray[1]}`);
        console.log(`pixel.data[2]: ${pixel.data[2]}`);
        console.log(`oldColorArray[2]: ${oldColorArray[2]}`);
        console.log(`pixel.data[3]: ${pixel.data[3]}`);
        console.log(`oldColorArray[3]: ${Math.round(oldColorArray[3] * 255)}`);
        console.log(`pixelPosX: ${_pixelPos.x}, pixelPosY: ${_pixelPos.y}`);
        */
        //console.log(pixel.data);
        //console.log(getArrayFromRGBA(_oldColor));

        closeFillCall();
        return;
    }
    else {
        //console.log(`drawing fill pixel`);
        stateManager.isFilling = true;
        drawCtx.fillStyle = _newColor;
        drawCtx.fillRect(_pixelPos.x, _pixelPos.y, 1, 1);
        //returnPixel.push({ position: _pixelPos, color: _newColor });
        fillCalls += 4;
        // Avoid stack overflow and graphic lag
        if (fillCalls < 1000) {
            callSelf();
        } else {
            setTimeout(() => {
                callSelf();
            }, 0);
        }
    }
    closeFillCall();
    fillPixels.push({ position: _pixelPos, color: _newColor });
}

function readKey(_e) {
    if (stateManager.isBlockingInput()) return;
    if (_e.key === "Enter") setRes();
}

function setRes() {
    if (resInput.value === "") {
        init(getViewableSize(), resInput.getAttribute("placeholder"), "rgba(255, 255, 255, 1)");
        resInput.setAttribute("placeholder", `${DEFAULT_RES}`);
    }
    else if (!parseInt(resInput.value) || parseInt(resInput.value) > 128 || parseInt(resInput.value) < 1) {
        resInput.value = "";
        resInput.setAttribute("placeholder", "Enter a number between 1 and 128");
    }
    else {
        init(getViewableSize(), parseInt(resInput.value), "rgba(255, 255, 255, 1)");
        resInput.setAttribute("placeholder", `${DEFAULT_RES}`);
    }
}

function toggleAnimating() {
    if (stateManager.isBlockingInput()) return;
    if (!stateManager.isAnimating && animFrames.length > 0) {
        animButton.textContent = "Stop";
        stateManager.isAnimating = true;
        bufferCanvas = new OffscreenCanvas(resolution, resolution);
        bufferCanvas.getContext("2d").drawImage(drawField, 0, 0);
        animate([0, 0]);
    } else {
        animButton.textContent = "Animate!";
        stateManager.isAnimating = false;
        window.clearTimeout(animTimer);
        drawCtx.drawImage(bufferCanvas, 0, 0);
    }
}

function drawFrame(_frameNum, _context) {
    function drawSubframes(_subframeCount) {
        let loopLimit = Math.min(animFrames[nextFrame].pixel.length - 1, nextSubframe + _subframeCount);
        for (let i = nextSubframe; i <= loopLimit; i++) {
            drawAnimPoint(animFrames[nextFrame].pixel[i], _context);
            if (i + 1 < animFrames[nextFrame].pixel.length) {
                nextSubframe = i + 1;
            } else {
                nextSubframe = 0;
                nextFrame++;
            }
        }
    }
    let nextFrame = _frameNum[0];
    let nextSubframe = _frameNum[1];
    if (nextFrame === 0) {
        _context.drawImage(animBasis, 0, 0);
        //console.log(`reset canvas to animBasis`);
    }
    console.log(animFrames[nextFrame].type);
    if (animFrames[nextFrame].type === "init") {
        return [++nextFrame, 0];
    } else if (animFrames[nextFrame].type === "fill") {
        drawSubframes(Math.ceil(resolution * 1.5));
    } else if (animFrames[nextFrame].type === "drawPoint") {
        drawAnimPoint(animFrames[nextFrame].pixel[0], _context);
        nextFrame++;
    } else if (animFrames[nextFrame].type === "drawLine") {
        drawSubframes(Math.ceil(resolution * 0.1));
    }
    if (nextFrame >= animFrames.length) {
        nextFrame = 0;
    }
    return [nextFrame, nextSubframe];
}

function animate(_frame) {
    animTimer = window.setTimeout(() => {
        animate(drawFrame(_frame, drawCtx));
    }, 94);
}

function setGridFieldSize(_fieldSize) {
    drawField.style.width = `${_fieldSize}px`;
    drawField.style.height = `${_fieldSize}px`;
    overlayCanvas.style.width = `${_fieldSize}px`;
    overlayCanvas.style.height = `${_fieldSize}px`;
    setOverlayPosition();
}

function getViewableSize() {
    let height = window.innerHeight - menuBar.clientHeight - footer.clientHeight;
    let width = window.innerWidth;
    return height < width ? height : width;
}

function createCanvas(_width, _height, _class) {
    let canvas = document.createElement("canvas");
    canvas.width = _width;
    canvas.height = _height;
    if (_class) canvas.class = _class;
    return canvas;
}

function drawCanvasImage(_context) {
    for (let x = 0; x < grid.length; x++) {
        for (let y = 0; y < grid[x].length; y++) {
            _context.fillStyle = grid[x][y].style.backgroundColor;
            _context.fillRect(x, y, 1, 1);
        }
    }
    return _context;
}

function getRfromRGBA(_rgbaStr) {
    return parseFloat(_rgbaStr.match(/(?<=^rgba?\( *)[0-9]*.?[0-9]*(?=,)/i));
}

function getGfromRGBA(_rgbaStr) {
    return parseFloat(_rgbaStr.match(/(?<=, *)[0-9]*.?[0-9]*(?=,)/i));
}

function getBfromRGBA(_rgbaStr) {
    return parseFloat(_rgbaStr.match(/(?<=^rgba?\( *[0-9.]*, *[0-9.]*, *)[0-9]*.?[0-9]*/i));
}

// Returns 1 if reading RGB without an alpha channel
function getAfromRGBA(_rgbaStr) {
    return parseFloat(_rgbaStr.match(/(?<=^rgba\([a-z,0-9 ]*)[0-9]*.?[0-9]*(?= *\)$)/i) ?? 1);
}

function getArrayFromRGBA(_rgbaStr) {
    return [getRfromRGBA(_rgbaStr), getGfromRGBA(_rgbaStr), getBfromRGBA(_rgbaStr), 
        getAfromRGBA(_rgbaStr)];
}

function startExport(_msg) {
    stateManager.isExporting = true;
    //bufferCanvas = new OffscreenCanvas(resolution, resolution);
    //bufferCanvas.getContext("2d").drawImage(drawField, 0, 0);
    //drawCtx.fillStyle = "rgba(0, 0, 0, 0.75)";
    //drawCtx.fillRect(0, 0, resolution, resolution);
    //drawCtx.fillStyle = "rgba(255, 255, 255, 0.75)";
    //drawCtx.fillText(_msg, 0, 15);
    overlayCtx.fillStyle = "rgba(0, 0, 0, 0.75)";
    overlayCtx.fillRect(0, 0, getViewableSize(), getViewableSize());
    overlayCtx.fillStyle = "rgba(255, 255, 255, 0.75)";
    overlayCtx.font = `${getViewableSize() / 26}px monospace`
    overlayCtx.fillText(_msg, 0, getViewableSize() / 26);
    /*
    let darken = 10;
    for (let x = 0; x < grid.length; x++) {
        for (let y = 0; y < grid[x].length; y++) {
            let oldColor = grid[x][y].style.backgroundColor;
            grid[x][y].style.backgroundColor = `rgb(${oldColor.match(rRegex) / darken}, 
                ${oldColor.match(gRegex) / darken}, ${oldColor.match(bRegex) / darken})`;
        }
    }
    grid[0][0].classList.add("exporting");
    grid[0][0].style.fontSize = `${getViewableSize() / 26}px`;
    grid[0][0].textContent = _msg;
    */
}

function endExport() {
    //grid[0][0].classList.remove("exporting");
    //grid[0][0].textContent = "";
    overlayCtx.clearRect(0, 0, getViewableSize(), getViewableSize());
    setTimeout(() => {
        stateManager.isExporting = false;
    }, 500);
}

function exportPng() {
    if (stateManager.isBlockingInput()) return;
    startExport("Exporting ...");
    /* Timeout gives the visual changes from startExport() time to become visible
    before the export process hangs the graphics updating */
    setTimeout(() => {
        /*
        let pngCanvas = createCanvas(resolution, resolution, "png-canvas");
        let context = pngCanvas.getContext("2d");
        nextFrame = 0;
        do {
            nextFrame = drawFrame(nextFrame);
        } while (nextFrame > 0);
        context = drawCanvasImage(context);
        */
        let dl = document.createElement("a");
        dl.download = "sketchy_image.png";
        dl.href = drawField.toDataURL();
        dl.click();
        dl.remove();
        //pngCanvas.remove();
        endExport();
    }, 50);
}

function exportGif() {
    if (stateManager.isBlockingInput()) return;
    startExport("Exporting ... (this may take a long time!)");
    /* Timeout gives the visual changes from startExport() time to become visible
    before the export process hangs the graphics updating */
    setTimeout(() => {
        //let gifCanvas = createCanvas(resolution, resolution, "gif-canvas");
        //let context = gifCanvas.getContext("2d", { willReadFrequently: true });
        let encoder = new GIFEncoder();
        encoder.setRepeat(0);
        encoder.setDelay(100);
        encoder.start();
        let nextFrame = [0, 0];
        bufferCanvas = new OffscreenCanvas(resolution, resolution);
        let gifCtx = bufferCanvas.getContext("2d", { willReadFrequently: true });
        do {
            nextFrame = drawFrame(nextFrame, gifCtx); 
            encoder.addFrame(gifCtx);
        } while (nextFrame[0] > 0);
        encoder.finish();
        encoder.download("sketchy_image.gif");
        //gifCanvas.remove();
        endExport();
}   , 50);
}

function setOverlayPosition() {
    overlayCanvas.style.transform = `translate(0, ${menuBar.clientHeight - window.scrollY}px)`;
}

console.log(`r: ${getRfromRGBA("rgba(0, 1,2,0.5)")}`);
console.log(`g: ${getGfromRGBA("rgb(0,1,2,0.5)")}`);
console.log(`b: ${getBfromRGBA("rgba(0,1,2,0.5)")}`);
console.log(`a: ${getAfromRGBA("rgb( 0, 5,2)")}`);
const stateManager = new StateManager();
console.log(stateManager.isBlockingInput());
init(getViewableSize(), resInput.getAttribute("placeholder"), "rgba(255, 255, 255, 1)");
resButton.addEventListener("click", setRes);
resInput.addEventListener("keydown", readKey);
document.addEventListener("mouseup", (_e) => {
    if (_e.button === 0) clickHeld = false;
    console.log(animFrames);
});
overlayCanvas.addEventListener("mousedown", clickDraw);
overlayCanvas.addEventListener("mousemove", dragDraw);
document.addEventListener("contextmenu", (_e) => {
    _e.preventDefault();
});
animButton.addEventListener("click", toggleAnimating);
window.addEventListener("resize", (_e) => {
    setGridFieldSize(getViewableSize());
});
window.addEventListener("scroll", setOverlayPosition);
pngButton.addEventListener("click", exportPng);
gifButton.addEventListener("click", exportGif);