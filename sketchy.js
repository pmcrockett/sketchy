const DEFAULT_RES = 32;
const BG_COLOR = `rgb(206, 206, 206)`;
const DRAW_COLOR = `rgb(90, 90, 90)`;
let menuBar = document.querySelector(".menu-bar");
let footer = document.querySelector(".footer");
let gridField = document.querySelector(".grid-field");
let resInput = document.getElementById("resolution");
let resButton = document.querySelector(".res-button");
let animButton = document.querySelector(".anim-button");
let pngButton = document.querySelector(".png-button");
let gifButton = document.querySelector(".gif-button");
let buttons = [resButton, animButton, pngButton, gifButton];
let grid;
let resolution;
let clickHeld = false;
let fillCalls;
let lastMousePos = {};
let animFrames = [];
let isAnimating = false;
let animTimer;
let isExporting = false;
let exportingSquare;
let lineCooldown = false;

function init(_fieldSize, _resolution) {
    resolution = _resolution;
    if (isAnimating) animate();
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
}

function clickDraw(_e) {
    if (isExporting) return;
    _e.preventDefault();
    if (!isAnimating) {
        if (_e.button === 0) {
            clickHeld = true;
            drawPoint(_e);
        }
    }
}

function dragDraw(_e) {
    if (isExporting) return;
    if (clickHeld && !isAnimating) {
        drawLine(lastMousePos, _e);
        drawPoint(_e);
    }
}

function drawPoint(_e) {
    let drawElement = document.elementFromPoint(_e.x, _e.y);
    if (!drawElement.classList.contains("grid-square")) return;
    drawElement.style.backgroundColor = DRAW_COLOR;
    lastMousePos.x = _e.x;
    lastMousePos.y = _e.y;
    animFrames.push({ square: drawElement, type: "draw" });
}

/* This function is necessary to fix a problem where lag causes skips in what
should be a continuously drawn line. We're playing connect-the-dots between 
known cursor positions, basically. */
function drawLine(_oldPos, _e) {
    let xDist = Math.abs(_e.x - _oldPos.x);
    let yDist = Math.abs(_e.y - _oldPos.y);
    let hypot = Math.sqrt(xDist ** 2 + yDist ** 2);
    for (let i = 0; i < hypot; i += (getViewableSize() / resolution)) {
        let linePos = {};
        let move = {
            right: _oldPos.x + xDist * (i / hypot),
            left: _oldPos.x - xDist * (i / hypot),
            down: _oldPos.y + yDist * (i / hypot),
            up: _oldPos.y - yDist * (i / hypot)
        };
        if (_oldPos.x < _e.x) linePos.x = move.right;
        else linePos.x = move.left;
        if (_oldPos.y < _e.y) linePos.y = move.down;
        else linePos.y = move.up;
        let lineElement = document.elementFromPoint(linePos.x, linePos.y);
        if (!lineElement.classList.contains("grid-square")) continue;
        lineElement.style.backgroundColor = DRAW_COLOR;
        animFrames.push({ square: lineElement, type: "draw" });
    }
    lastMousePos.x = _e.x;
    lastMousePos.y = _e.y;
}

function fill(_x, _y, _oldColor, _newColor) {
    function callSelf() {
        fill(_x, _y - 1, _oldColor, _newColor);
        fill(_x + 1, _y, _oldColor, _newColor);
        fill(_x, _y + 1, _oldColor, _newColor);
        fill(_x - 1, _y, _oldColor, _newColor);
    }
    fillCalls++;
    if (!grid[_x] || !grid[_y] || grid[_x][_y].style.backgroundColor != _oldColor) {
        fillCalls--
        return;
    }
    else {
        grid[_x][_y].style.backgroundColor = _newColor;
        animFrames.push({ square: grid[_x][_y], type: "fill" });
        // Avoid stack overflow 
        if (fillCalls < 1000) callSelf();
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

function startAnimating() {
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

init(getViewableSize(), resInput.getAttribute("placeholder"));
resButton.addEventListener("click", setRes);
resInput.addEventListener("keydown", readKey);
document.addEventListener("mouseup", (_e) => {
    if (_e.button === 0) clickHeld = false;
});
gridField.addEventListener("mousedown", clickDraw);
gridField.addEventListener("mouseover", dragDraw);
document.addEventListener("contextmenu", (_e) => {
    _e.preventDefault();
});
animButton.addEventListener("click", startAnimating);
window.addEventListener("resize", (_e) => {
    setGridFieldSize(getViewableSize(), resolution);
});
pngButton.addEventListener("click", exportPng);
gifButton.addEventListener("click", exportGif);