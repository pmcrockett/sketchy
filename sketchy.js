/* TODO:
Add multi-color support
More flexible resolutions
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
let drawField = document.querySelector(".draw-field");
let overlayCanvas = document.querySelector(".overlay");
let resInput = document.getElementById("resolution");
let resButton = document.querySelector(".res-button");
let animButton = document.querySelector(".anim-button");
let pngButton = document.querySelector(".png-button");
let gifButton = document.querySelector(".gif-button");
let gridButton = document.querySelector(".grid-button");
let undoButton = document.querySelector(".undo-button");
let redoButton = document.querySelector(".redo-button");
let buttons = [resButton, animButton, pngButton, gifButton, gridButton, 
        undoButton, redoButton];
let drawCtx;
let basisCtx;
let overlayCtx;
let grid;
let animBasis;
let bufferCanvas;
let resolution;
let fillCalls;
let lastPixelPos = {};
let animFrames = [];
let isAnimating = false;
let animTimer;
let isExporting = false;
let exportingSquare;
let lineCooldown = false;
let pixelBuffer = [];
let redoStack = [];
let isMobile = false;

class StateManager {
    constructor() {
        this.isAnimating = false;
        this._isExporting = false;
        this._isFilling = false;
        this.clickHeld = false;
        this.isDrawingLine = false;
        this.isDrawingPoint = false;
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
        button.classList.remove("enabled");
        button.disabled = true;
    }
}

function enablebuttons() {
    for (let button of buttons) {
        button.classList.add("enabled");
        button.removeAttribute("disabled");
    }
}

function initCanvas(_fieldSize, _resolution, _color) {
    resolution = _resolution;
    if (stateManager.isAnimating) toggleAnimating();
    drawField.width = resolution;
    drawField.height = resolution;
    drawCtx = drawField.getContext("2d", { willReadFrequently: true });
    drawCtx.mozImageSmoothingEnabled = false;
    drawCtx.webkitImageSmoothingEnabled = false;
    drawCtx.msImageSmoothingEnabled = false;
    drawCtx.imageSmoothingEnabled = false;
    drawCtx.fillStyle = _color;
    drawCtx.fillRect(0, 0, resolution, resolution);
    overlayCtx = overlayCanvas.getContext("2d");
    overlayCtx.clearRect(0, 0, _fieldSize, _fieldSize);
    setDrawFieldSize(_fieldSize);
    animBasis = new OffscreenCanvas(resolution, resolution);
    basisCtx = animBasis.getContext("2d");
    basisCtx.drawImage(drawField, 0, 0);
    animFrames = [{ pixel: [], type: "init" }];
}

function getPageX(_e) {
    return _e.pageX || _e.changedTouches[0].pageX;
}

function getPageY(_e) {
    return _e.pageY || _e.changedTouches[0].pageY;
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
    _e.preventDefault();
    //console.log(_e);
    if (stateManager.isBlockingInput()) return;
    _e.preventDefault();
    if (!stateManager.isAnimating) {
        if (_e.type === "dblclick" && _e.button === 0) {
            undo();
            // fillCalls = 1;
            // fillPixels = [];
            // let pixelPos = getPixelPosition(_e.pageX, _e.pageY);
            // let oldColorArr = drawCtx.getImageData(pixelPos.x, pixelPos.y, 
            //         1, 1).data;
            // let oldColor = getRGBAFromArray(oldColorArr, true);
            // fill(pixelPos, oldColor, "rgba(0, 0, 0, 1)");
            // redoStack = [];
        } else if (_e.button === 0 || _e.changedTouches) {
            stateManager.clickHeld = true;
            stateManager.isDrawingPoint = true;
            drawPoint(_e, "rgba(0, 0, 0, 1)");
            redoStack = [];
        } else if (_e.button === 2) {

        }
    }
}

function dragDraw(_e) {
    //console.log(`drag draw enter`);
    if (stateManager.isBlockingInput()) return;
    if (stateManager.clickHeld && !stateManager.isAnimating && 
        (animFrames[animFrames.length - 1].type === "drawLine" || 
            getPixelPosition() != lastPixelPos)) {
        //console.log(animFrames[animFrames.length - 1].type);
        stateManager.isDrawingPoint = false;
        stateManager.isDrawingLine = true;
        drawLine(lastPixelPos, _e, "rgba(0, 0, 0, 1)");
        redoStack = [];
        //console.log(`drag draw`);
        //drawPoint(_e);
    }
}

function drawPoint(_e, _color) {
    let pixelPos = getPixelPosition(getPageX(_e), getPageY(_e));
    let oldColor = getRGBAFromPoint(pixelPos, drawCtx);
    drawCtx.fillStyle = _color;
    drawCtx.fillRect(pixelPos.x, pixelPos.y, 1, 1);
    if (gridButton.classList.contains("depressed")) updateGridPoint(pixelPos);
    lastPixelPos = pixelPos;
    pixelBuffer.push({ position: pixelPos, color: _color, oldColor: oldColor });
}

function drawAnimPoint(_pixel, _context, _updateGrid = true) {
    _context.fillStyle = _pixel.color;
    _context.fillRect(_pixel.position.x, _pixel.position.y, 1, 1);
    if (_updateGrid && gridButton.classList.contains("depressed")) {
        updateGridPoint(_pixel.position);
    }
}

/* This function is necessary to fix a problem where lag causes skips in what
should be a continuously drawn line. We're playing connect-the-dots between 
known cursor positions, basically. */
function drawLine(_oldPixelPos, _e, _color) {
    /* drawLine may be preceded by drawPoint because we can't know the 
    user's intent initially. If they go on to draw a line, we move the animFrame 
    that we drew for the initial point into the line's animFrame. */
    /*
    if (animFrames[animFrames.length - 1].type === "drawPoint") {
        pixelBuffer.push(animFrames.pop().pixel);
    }
    */
    let pixelPos = getPixelPosition(getPageX(_e), getPageY(_e));
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
        let oldColor = getRGBAFromPoint(linePos, drawCtx);
        drawCtx.fillRect(linePos.x, linePos.y, 1, 1);
        if (gridButton.classList.contains("depressed")) updateGridPoint(linePos);
        pixelBuffer.push({ position: linePos, color: _color, oldColor: oldColor });
    }
    lastPixelPos = pixelPos;
    //animFrames.push({ pixel: pixels, type: "drawLine" });
}

function fill(_pixelPos, _oldColor, _newColor) {
    //console.log(`entering fill (calls: ${fillCalls})`);
    if (_oldColor === _newColor) {
        pixelBuffer = [{ position: _pixelPos, color: _newColor, oldColor: _oldColor }];
        closeFillCall();
        return;
    }
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
            animFrames.push({ pixel: pixelBuffer, type: "fill" });
            pixelBuffer = [];
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
        if (gridButton.classList.contains("depressed")) updateGridPoint(_pixelPos);
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
    pixelBuffer.push({ position: _pixelPos, color: _newColor, oldColor: _oldColor });
}

function readKey(_e) {
    if (stateManager.isBlockingInput()) return;
    if (_e.key === "Enter") setRes();
}

function setRes() {
    if (resInput.value === "") {
        initCanvas(getViewableSize(), parseInt(resInput.getAttribute("placeholder")), 
                "rgba(255, 255, 255, 1)");
        resInput.setAttribute("placeholder", `${DEFAULT_RES}`);
    }
    else if (!parseInt(resInput.value) || parseInt(resInput.value) > 128 || 
        parseInt(resInput.value) < 1) {
        resInput.value = "";
        resInput.setAttribute("placeholder", "Enter a number between 1 and 128");
    }
    else {
        initCanvas(getViewableSize(), parseInt(resInput.value), "rgba(255, 255, 255, 1)");
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
        if (gridButton.classList.contains("depressed")) showGrid();
    }
}

function drawFrame(_frameNum, _context, _drawAllSubframes = false, _updateGrid = true) {
    function drawSubframes(_subframeCount) {
        let loopLimit = Math.min(animFrames[nextFrame].pixel.length - 1, 
                nextSubframe + _subframeCount);
        for (let i = nextSubframe; i <= loopLimit; i++) {
            drawAnimPoint(animFrames[nextFrame].pixel[i], _context, _updateGrid);
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
        if (_updateGrid && gridButton.classList.contains("depressed")) showGrid();
        //console.log(`reset canvas to animBasis`);
    }
    console.log(animFrames[nextFrame].type);
    if (animFrames[nextFrame].type === "init") {
        console.log(`incrementing nextFrame`);
        nextFrame++;
    } else if (animFrames[nextFrame].type === "fill") {
        if (_drawAllSubframes) drawSubframes(animFrames[nextFrame].pixel.length - 1);
        else drawSubframes(Math.ceil(resolution * 1.5));
    } else if (animFrames[nextFrame].type === "drawPoint") {
        drawAnimPoint(animFrames[nextFrame].pixel[0], _context, _updateGrid);
        nextFrame++;
    } else if (animFrames[nextFrame].type === "drawLine") {
        if (_drawAllSubframes) drawSubframes(animFrames[nextFrame].pixel.length - 1);
        else drawSubframes(Math.ceil(resolution * 0.1));
    }
    if (nextFrame >= animFrames.length) {
        console.log(`nextFrame is 0`);
        nextFrame = 0;
    }
    console.log(`returning nextFrame as ${nextFrame}; animFrames.length is ${animFrames.length}`);
    return [nextFrame, nextSubframe];
}

function animate(_frame) {
    animTimer = window.setTimeout(() => {
        animate(drawFrame(_frame, drawCtx));
    }, 94);
}

function setDrawFieldSize(_fieldSize) {
    drawField.style.width = `${_fieldSize}px`;
    drawField.style.height = `${_fieldSize}px`;
    overlayCanvas.width = _fieldSize;
    overlayCanvas.height = _fieldSize;
    overlayCanvas.style.width = `${_fieldSize}px`;
    overlayCanvas.style.height = `${_fieldSize}px`;
    setOverlayPosition();
    if (gridButton.classList.contains("depressed")) {
        hideGrid();
        showGrid();
    }
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

function getRGBAFromArray(_arr, _alphaIs255 = false) {
    if (_alphaIs255) {
        return `rgba(${_arr[0]}, ${_arr[1]}, ${_arr[2]}, ${Math.round(_arr[3] / 255)})`;
    } else return `rgba(${_arr[0]}, ${_arr[1]}, ${_arr[2]}, ${_arr[3]})`;
}

function getRGBAFromPoint(_pixelPos, _context) {
    return getRGBAFromArray(_context.getImageData(_pixelPos.x, _pixelPos.y, 1, 1).data, true);
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
    overlayCanvas.style.transform = `translate(0, 
            ${menuBar.clientHeight - window.scrollY}px)`;
}

function toggleGrid() {
    if (stateManager.isBlockingInput()) return;
    if (gridButton.classList.contains("depressed")) {
        gridButton.classList.remove("depressed");
        hideGrid();
    } else {
        gridButton.classList.add("depressed");
        overlayCtx.fillStyle = ("rgba(0, 0, 0, 0.7)")
        showGrid();
    }
}

function showGrid() {
    for (let x = 0; x <= resolution; x++) {
        for (let y = 0; y <= resolution; y++) {
            updateGridPoint({ x: x, y: y });
        }
    }
}

function hideGrid() {
    let viewable = getViewableSize();
    overlayCtx.clearRect(0, 0, viewable, viewable);
}

function updateGridPoint(_pixelPos) {
    let viewable = getViewableSize();
    let increment = (viewable) * (1.02 / resolution);
    let drawPosX = Math.round((viewable - 1) * (_pixelPos.x / resolution));
    let drawPosY = Math.round((viewable - 1) * (_pixelPos.y / resolution));
    let pixDat = drawCtx.getImageData(_pixelPos.x, _pixelPos.y, 1, 1).data;
    for (let i = 0; i < 3; i++) {
        if (_pixelPos.x === resolution || _pixelPos.y === resolution) {
            pixDat[i] = 0;
        } else pixDat[i] = 255 - pixDat[i];
    }
    pixDat[3] = 1;
    overlayCtx.fillStyle = getRGBAFromArray(pixDat);
    let lineWidth = isMobile ? 2 : 1;
    overlayCtx.fillRect(drawPosX, drawPosY, lineWidth, increment);
    overlayCtx.fillRect(drawPosX, drawPosY, increment, lineWidth);
}

function undo() {
    /*
    if (animFrames.length > 1) {
        redoStack.push(animFrames.pop());
        console.log(animFrames.length);
        let nextFrame = [0, 0];
        do {
            nextFrame = drawFrame(nextFrame, drawCtx, true, false);
        } while (nextFrame[0] > 0 && animFrames.length > 1);
        if (gridButton.classList.contains("depressed")) showGrid();
    }
    */
    if (animFrames.length > 1) {
        //for (let pixel of animFrames[animFrames.length - 1].pixel) {
        for (i = animFrames[animFrames.length - 1].pixel.length - 1; i >= 0; i--) {
            let pixel = animFrames[animFrames.length - 1].pixel[i];
            console.log(`undoing`);
            drawCtx.fillStyle = pixel.oldColor;
            console.log(`oldColor: ${pixel.oldColor}`);
            drawCtx.fillRect(pixel.position.x, pixel.position.y, 1, 1);
            if (gridButton.classList.contains("depressed")) {
                updateGridPoint(pixel.position);
            }
        }
        redoStack.push(animFrames.pop());
    }
}

function redo() {
    if (redoStack.length > 0) {
        animFrames.push(redoStack.pop());
        drawFrame([animFrames.length - 1, 0], drawCtx, true);
    }
}

function endDraw(_e) {
    if (_e.button === 0) {
        stateManager.clickHeld = false;
        if (stateManager.isDrawingPoint) {
            stateManager.isDrawingPoint = false;
            animFrames.push({ pixel: pixelBuffer, type: "drawPoint" });
            pixelBuffer = [];
        } else if (stateManager.isDrawingLine) {
            stateManager.isDrawingLine = false;
            animFrames.push({ pixel: pixelBuffer, type: "drawLine" });
            pixelBuffer = [];
        }
    }
    console.log(animFrames);
}

function checkIfMobile() {
    /* Mobile detection RegEx strings from 
    https://phppot.com/javascript/detect-mobile-device-javascript/ */
    return /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i
    .test(navigator.userAgent)
    || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i
            .test(navigator.userAgent.substring(0, 4));
}

function initMobile() {
    for (let elem of document.getElementsByTagName("*")) {
        elem.classList.add("mobile");
    }
    isMobile = true;
}

function initListeners() {
    // Input devices
    resInput.addEventListener("keydown", readKey);
    document.addEventListener("mouseup", endDraw);
    document.addEventListener("touchend", endDraw);
    overlayCanvas.addEventListener("mousedown", clickDraw);
    overlayCanvas.addEventListener("dblclick", clickDraw);
    overlayCanvas.addEventListener("touchstart", clickDraw);
    overlayCanvas.addEventListener("mousemove", dragDraw);
    overlayCanvas.addEventListener("touchmove", dragDraw);
    // Buttons
    animButton.addEventListener("click", toggleAnimating);
    gridButton.addEventListener("click", toggleGrid);
    resButton.addEventListener("click", setRes);
    pngButton.addEventListener("click", exportPng);
    gifButton.addEventListener("click", exportGif);
    undoButton.addEventListener("click", undo);
    redoButton.addEventListener("click", redo);
    // Window actions
    document.addEventListener("contextmenu", (_e) => {
        _e.preventDefault();
    });
    window.addEventListener("resize", (_e) => {
        setDrawFieldSize(getViewableSize());
    });
    window.addEventListener("scroll", setOverlayPosition);
}

// Program execution
const stateManager = new StateManager();
if (checkIfMobile()) initMobile();
initCanvas(getViewableSize(), parseInt(resInput.getAttribute("placeholder")), 
    "rgba(255, 255, 255, 1)");
initListeners();

// Debug
console.log(`r: ${getRfromRGBA("rgba(0, 1,2,0.5)")}`);
console.log(`g: ${getGfromRGBA("rgb(0,1,2,0.5)")}`);
console.log(`b: ${getBfromRGBA("rgba(0,1,2,0.5)")}`);
console.log(`a: ${getAfromRGBA("rgb( 0, 5,2)")}`);
console.log(stateManager.isBlockingInput());