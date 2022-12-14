const DEFAULT_RES = 32;
const BG_COLOR = `rgb(206, 206, 206)`;
const DRAW_COLOR = `rgb(90, 90, 90)`;
let menuBar = document.querySelector(".menu-bar");
let gridField = document.querySelector(".grid-field");
let resInput = document.getElementById("resolution");
let resButton = document.querySelector(".res-button");
let animButton = document.querySelector(".anim-button");
let grid;
let resolution;
let clickHeld = false;
let fillCalls;
let lastMousePos = {};
let animFrames = [];
let isAnimating = false;
let animTimer;

function init(_fieldSize, _resolution) {
    function draw(_squarePos, _e) {
        grid[_squarePos.x][_squarePos.y].style.backgroundColor = DRAW_COLOR;
        lastMousePos.x = _e.x;
        lastMousePos.y = _e.y;
        animFrames.push({ square: grid[_squarePos.x][_squarePos.y], type: "draw" });
    }
    function drawLine(_oldPos, _e) {
        let xDist = Math.abs(_e.x - _oldPos.x);
        let yDist = Math.abs(_e.y - _oldPos.y);
        let hypot = Math.sqrt(xDist ** 2 + yDist ** 2);
        for (let i = 0; i < hypot; i += (_fieldSize / _resolution) / 2) {
            let linePos = {};
            let move = {
                right: _oldPos.x + xDist * (i / hypot),
                left: _oldPos.x - xDist * (i / hypot),
                down: linePos.y = _oldPos.y + yDist * (i / hypot),
                up: _oldPos.y - yDist * (i / hypot)
            };
            if (_oldPos.x < _e.x) linePos.x = move.right;
            else linePos.x = move.left;
            if (_oldPos.y < _e.y) move.down;
            else linePos.y = move.up;
            let lineElement = document.elementFromPoint(linePos.x, linePos.y);
            lineElement.style.backgroundColor = DRAW_COLOR;
            animFrames.push({ square: lineElement, type: "draw" });
        }
        lastMousePos.x = _e.x;
        lastMousePos.y = _e.y;
    }
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
            grid[i][j].setAttribute("class", "grid-square");
            grid[i][j].style.backgroundColor = BG_COLOR;
            grid[i][j].style.gridColumnStart = j + 1;
            grid[i][j].style.gridColumnEnd = j + 2;
            gridField.appendChild(grid[i][j]);
            grid[i][j].addEventListener("mousedown", (_e) => {
                _e.preventDefault();
                if (!isAnimating) {
                    if (_e.button === 0) {
                        clickHeld = true;
                        draw({ x: i, y: j }, _e);
                    } else if (_e.button === 2) {
                        fillCalls = 0;
                        fill(i, j, BG_COLOR, DRAW_COLOR);
                    }
                }
            });
            grid[i][j].addEventListener("mouseover", (_e) => {
                if (clickHeld && !isAnimating) {
                    drawLine(lastMousePos, _e);
                    draw({ x: i, y: j }, _e);
                }
            });
        }
    }
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
    if (_e.key === "Enter") setRes();
}

function setRes() {
    if (resInput.value === "") {
        init(640, resInput.getAttribute("placeholder"));
        resInput.setAttribute("placeholder", `${DEFAULT_RES}`);
    }
    else if (!parseInt(resInput.value) || parseInt(resInput.value) > 128 || parseInt(resInput.value) < 1) {
        resInput.value = "";
        resInput.setAttribute("placeholder", "Enter a number between 1 and 128");
    }
    else {
        init(640, parseInt(resInput.value));
        resInput.setAttribute("placeholder", `${DEFAULT_RES}`);
    }
}

function animate() {
    if (!isAnimating && animFrames.length > 0) {
        animButton.textContent = "Stop";
        isAnimating = true;
        drawFrame(0);
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
    animTimer = window.setTimeout(() => {
        drawFrame(nextFrame);
    }, 15);
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

init(window.innerHeight - menuBar.clientHeight, resInput.getAttribute("placeholder"));
resButton.addEventListener("click", setRes);
resInput.addEventListener("keydown", readKey);
document.addEventListener("mouseup", (_e) => {
    if (_e.button === 0) clickHeld = false;
});
document.addEventListener("contextmenu", (_e) => {
    _e.preventDefault();
});
animButton.addEventListener("click", animate);
window.addEventListener("resize", (_e) => {
    setGridFieldSize(_e.currentTarget.innerHeight - menuBar.clientHeight, resolution);
});