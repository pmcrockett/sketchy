const DEFAULT_RES = 32;
const BG_COLOR = `rgb(206, 206, 206)`;
const DRAW_COLOR = `rgb(90, 90, 90)`;
let menuBar = document.querySelector(".menu-bar");
let footer = document.querySelector(".footer");
let gridField = document.querySelector(".grid-field");
let drawField = document.querySelector(".draw-field");
let resInput = document.getElementById("resolution");
let resButton = document.querySelector(".res-button");
let animButton = document.querySelector(".anim-button");
let pngButton = document.querySelector(".png-button");
let gifButton = document.querySelector(".gif-button");
let buttons = [resButton, animButton, pngButton, gifButton];
let drawCtx;
let grid;
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

function init(_fieldSize, _resolution) {
    resolution = _resolution;
    if (isAnimating) toggleAnimating();
    drawField.width = resolution;
    drawField.height = resolution;
    drawField.style.width = `${_fieldSize}px`;
    drawField.style.height = `${_fieldSize}px`;
    drawCtx = drawField.getContext("2d", { willReadFrequently: true });
    drawCtx.mozImageSmoothingEnabled = false;
    drawCtx.webkitImageSmoothingEnabled = false;
    drawCtx.msImageSmoothingEnabled = false;
    drawCtx.imageSmoothingEnabled = false;
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
    if (isExporting) return;
    _e.preventDefault();
    if (!isAnimating) {
        if (_e.button === 0) {
            clickHeld = true;
            drawPoint(_e);
        } else if (_e.button === 2) {
            fillCalls = 0;
            fill(getPixelPosition(_e.pageX, _e.pageY), "rgba(0, 0, 0, 0)", DRAW_COLOR);
        }
    }
}

function dragDraw(_e) {
    console.log(`drag draw enter`);
    if (isExporting) return;
    if (clickHeld && !isAnimating) {
        drawLine(lastPixelPos, _e);
        console.log(`drag draw`);
        //drawPoint(_e);
    }
}

function drawPoint(_e) {
    let pixelPos = getPixelPosition(_e.pageX, _e.pageY);
    drawCtx.fillRect(pixelPos.x, pixelPos.y, 1, 1);
    lastPixelPos = pixelPos;
    //animFrames.push({ square: drawElement, type: "draw" });
}

/* This function is necessary to fix a problem where lag causes skips in what
should be a continuously drawn line. We're playing connect-the-dots between 
known cursor positions, basically. */
function drawLine(_oldPixelPos, _e) {
    let pixelPos = getPixelPosition(_e.pageX, _e.pageY);
    let xDist = Math.abs(pixelPos.x - _oldPixelPos.x);
    let yDist = Math.abs(pixelPos.y - _oldPixelPos.y);
    let hypot = Math.sqrt(xDist ** 2 + yDist ** 2);
    for (let i = 0; i < hypot; i++) {
        let linePos = {};
        let move = {
            right: Math.floor(_oldPixelPos.x + xDist * (i / hypot)),
            left: Math.floor(_oldPixelPos.x - xDist * (i / hypot)),
            down: Math.floor(_oldPixelPos.y + yDist * (i / hypot)),
            up: Math.floor(_oldPixelPos.y - yDist * (i / hypot))
        };
        if (_oldPixelPos.x < pixelPos.x) linePos.x = move.right;
        else linePos.x = move.left;
        if (_oldPixelPos.y < pixelPos.y) linePos.y = move.down;
        else linePos.y = move.up;
        drawCtx.fillRect(linePos.x, linePos.y, 1, 1);
        //animFrames.push({ square: lineElement, type: "draw" });
    }
    lastPixelPos = pixelPos;
}

function fill(_pixelPos, _oldColor, _newColor) {
    //console.log(`entering fill (calls: ${fillCalls})`);
    function callSelf() {
        fill({ x: _pixelPos.x, y: _pixelPos.y - 1 }, _oldColor, _newColor);
        fill({ x: _pixelPos.x + 1, y: _pixelPos.y }, _oldColor, _newColor);
        fill({ x: _pixelPos.x, y: _pixelPos.y + 1 }, _oldColor, _newColor);
        fill({ x: _pixelPos.x - 1, y: _pixelPos.y }, _oldColor, _newColor);
    }
    fillCalls++;
    if (_pixelPos.x < 0 || _pixelPos.x >= resolution || 
        _pixelPos.y < 0 || _pixelPos.y >= resolution) {
            //console.log(`ending fill because pixel is out of range`);
            return;
        }
    let pixel = drawCtx.getImageData(_pixelPos.x, _pixelPos.y, 1, 1);
    oldColorArray = getArrayFromRGBA(_oldColor);
    if (pixel.data[0] != oldColorArray[0] ||
        pixel.data[1] != oldColorArray[1] ||
        pixel.data[2] != oldColorArray[2] ||
        pixel.data[3] != oldColorArray[3]) {
        fillCalls--
        //console.log(`ending fill because pixel is wrong color`);
        //console.log(pixel.data);
        //console.log(getArrayFromRGBA(_oldColor));
        return;
    }
    else {
        //console.log(`drawing fill pixel`);
        drawCtx.fillRect(_pixelPos.x, _pixelPos.y, 1, 1);
        //animFrames.push({ square: grid[_x][_y], type: "fill" });
        // Avoid stack overflow and graphic lag
        if (fillCalls < 50) callSelf();
        else {
            setTimeout(() => {
                callSelf();
            }, 1);
        }
    }
    fillCalls--;
}

function readKey(_e) {
    if (isExporting) return;
    if (_e.key === "Enter") setRes();
}

function setRes() {
    if (resInput.value === "") {
        init(getViewableSize(), resInput.getAttribute("placeholder"));
        resInput.setAttribute("placeholder", `${DEFAULT_RES}`);
    }
    else if (!parseInt(resInput.value) || parseInt(resInput.value) > 128 || parseInt(resInput.value) < 1) {
        resInput.value = "";
        resInput.setAttribute("placeholder", "Enter a number between 1 and 128");
    }
    else {
        init(getViewableSize(), parseInt(resInput.value));
        resInput.setAttribute("placeholder", `${DEFAULT_RES}`);
    }
}

function toggleAnimating() {
    if (isExporting) return;
    if (!isAnimating && animFrames.length > 0) {
        animButton.textContent = "Stop";
        isAnimating = true;
        animate(0);
    } else {
        animButton.textContent = "Animate!";
        isAnimating = false;
        window.clearTimeout(animTimer);
        restoreGridState();
    }
}

function drawFrame(_frameNum) {
    if (_frameNum === 0) resetGridColor();
    let nextFrame = _frameNum;
    let drawnFrames = 0;
    let filledFrames = 0;
    for (let i = 0; i < 25; i++) {
        animFrames[nextFrame].square.style.backgroundColor = DRAW_COLOR;
        nextFrame++;
        if (nextFrame >= animFrames.length) {
            nextFrame = 0;
            break
        }
        if (animFrames[nextFrame].type === "fill") {
            filledFrames++;
        }
        if (animFrames[nextFrame].type === "draw") {
            drawnFrames++;
        }
        if (drawnFrames > 3 || (filledFrames > 0 && drawnFrames > 0)) {
            break;
        }
    }
    return nextFrame;
}

function animate(_frame) {
    animTimer = window.setTimeout(() => {
        animate(drawFrame(_frame));
    }, 18);
}

function resetGridColor() {
    for (let column of grid) {
        for (let square of column) {
            square.style.backgroundColor = BG_COLOR;
        }
    }
}

function restoreGridState() {
    for (let frame of animFrames) {
        frame.square.style.backgroundColor = DRAW_COLOR;
    }
}

function setGridFieldSize(_fieldSize, _resolution) {
    gridField.style.gridAutoColumns = `${_fieldSize / _resolution}px`;
    gridField.style.gridAutoRows = `${_fieldSize / _resolution}px`;
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
    isExporting = true;
    for (let button of buttons) {
        button.classList.replace("active", "inactive");
        button.disabled = true;
    }
    let rRegex = /(?<=^rgb\()[0-9]*(?=,)/i;
    let gRegex = /(?<=, )[0-9]*(?=,)/i;
    let bRegex = /(?<=, )[0-9]*(?=\)$)/i;
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
}

function endExport() {
    grid[0][0].classList.remove("exporting");
    grid[0][0].textContent = "";
    for (let button of buttons) {
        button.classList.replace("inactive", "active");
        button.removeAttribute("disabled");
    }
    setTimeout(() => {
        isExporting = false;
    }, 500);
}

function exportPng() {
    if (isExporting) return;
    startExport("Exporting ...");
    /* Timeout gives the visual changes from startExport() time to become visible
    before the export process hangs the graphics updating */
    setTimeout(() => {
        let pngCanvas = createCanvas(resolution, resolution, "png-canvas");
        let context = pngCanvas.getContext("2d");
        nextFrame = 0;
        do {
            nextFrame = drawFrame(nextFrame);
        } while (nextFrame > 0);
        context = drawCanvasImage(context);
        let dl = document.createElement("a");
        dl.download = "sketchy_image.png";
        dl.href = pngCanvas.toDataURL();
        dl.click();
        dl.remove();
        pngCanvas.remove();
        endExport();
    }, 50);
}

function exportGif() {
    if (isExporting) return;
    startExport("Exporting ... (this may take a long time!)");
    /* Timeout gives the visual changes from startExport() time to become visible
    before the export process hangs the graphics updating */
    setTimeout(() => {
        let gifCanvas = createCanvas(resolution, resolution, "gif-canvas");
        let context = gifCanvas.getContext("2d", { willReadFrequently: true });
        let encoder = new GIFEncoder();
        encoder.setRepeat(0);
        encoder.setDelay(10);
        encoder.start();
        let nextFrame = 0
        do {
            nextFrame = drawFrame(nextFrame);
            encoder.addFrame(drawCanvasImage(context));
        } while (nextFrame > 0);
        encoder.finish();
        encoder.download("sketchy_image.gif");
        gifCanvas.remove();
        endExport();
}   , 50);
}

console.log(`r: ${getRfromRGBA("rgba(0, 1,2,0.5)")}`);
console.log(`g: ${getGfromRGBA("rgb(0,1,2,0.5)")}`);
console.log(`b: ${getBfromRGBA("rgba(0,1,2,0.5)")}`);
console.log(`a: ${getAfromRGBA("rgb( 0, 5,2)")}`);
init(getViewableSize(), resInput.getAttribute("placeholder"));
resButton.addEventListener("click", setRes);
resInput.addEventListener("keydown", readKey);
document.addEventListener("mouseup", (_e) => {
    if (_e.button === 0) clickHeld = false;
});
drawField.addEventListener("mousedown", clickDraw);
drawField.addEventListener("mousemove", dragDraw);
document.addEventListener("contextmenu", (_e) => {
    _e.preventDefault();
});
animButton.addEventListener("click", toggleAnimating);
window.addEventListener("resize", (_e) => {
    setGridFieldSize(getViewableSize(), resolution);
});
pngButton.addEventListener("click", exportPng);
gifButton.addEventListener("click", exportGif);