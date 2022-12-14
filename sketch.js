const NAMESPACE = "http://www.w3.org/2000/svg";
const DEFAULT_RES = 32;
const BG_COLOR = `rgb(206, 206, 206)`;
const DRAW_COLOR = `rgb(90, 90, 90)`;
let gridField = document.querySelector(".grid-field");
let resInput = document.getElementById("resolution");
let resButton = document.querySelector(".res-button");
let grid;
let clickHeld = false;
let fillCalls;

function init(_fieldSize, _resolution) {
    if (gridField.querySelector(".grid-square")) {
        for (let column of grid) {
            for (let square of column) {
                gridField.removeChild(square);
            }
        }
    }
    grid = [];
    gridField.style.gridAutoColumns = `${_fieldSize / _resolution}px`;
    gridField.style.gridAutoRows = `${_fieldSize / _resolution}px`;
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
                if (_e.button === 0) {
                    clickHeld = true;
                    grid[i][j].style.backgroundColor = DRAW_COLOR;
                } else if (_e.button === 2) {
                    fillCalls = 0;
                    fill(i, j, BG_COLOR, DRAW_COLOR);
                }
            });
            grid[i][j].addEventListener("mouseover", () => {
                if (clickHeld) grid[i][j].style.backgroundColor = DRAW_COLOR;
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
        if (fillCalls < 1000) callSelf();
        // Avoid stack overflow 
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
    else if (!parseInt(resInput.value) || parseInt(resInput.value) > 100 || parseInt(resInput.value) < 1) {
        resInput.value = "";
        resInput.setAttribute("placeholder", "Enter a number between 1 and 100");
    }
    else {
        init(640, parseInt(resInput.value));
        resInput.setAttribute("placeholder", `${DEFAULT_RES}`);
    }
}

init(640, resInput.getAttribute("placeholder"));
resButton.addEventListener("click", setRes);
resInput.addEventListener("keydown", readKey);
document.addEventListener("mouseup", (_e) => {
    if (_e.button === 0) clickHeld = false;
});
document.addEventListener("contextmenu", (_e) => {
    _e.preventDefault();
});