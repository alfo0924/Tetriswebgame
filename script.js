const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const startButton = document.getElementById('start-button');

const COLS = 10; // 遊戲板寬度 (單位: 格)
const ROWS = 20; // 遊戲板高度 (單位: 格)
const BLOCK_SIZE = 24; // 每格的大小 (像素)

// 設定畫布實際像素尺寸
canvas.width = COLS * BLOCK_SIZE;
canvas.height = ROWS * BLOCK_SIZE;

// 方塊顏色
const COLORS = [
    null,       // 0: 空白格
    '#FF0D72',  // 1: I 型 (青色)
    '#0DC2FF',  // 2: L 型 (藍色)
    '#0DFF72',  // 3: J 型 (橘色)
    '#F538FF',  // 4: O 型 (黃色)
    '#FF8E0D',  // 5: S 型 (綠色)
    '#FFE138',  // 6: T 型 (紫色)
    '#3877FF',  // 7: Z 型 (紅色)
];

// 方塊形狀 (用二維陣列表示)
const SHAPES = [
    [], // 空白
    [[1, 1, 1, 1]], // I
    [[2, 0, 0], [2, 2, 2]], // L
    [[0, 0, 3], [3, 3, 3]], // J
    [[4, 4], [4, 4]], // O
    [[0, 5, 5], [5, 5, 0]], // S
    [[0, 6, 0], [6, 6, 6]], // T
    [[7, 7, 0], [0, 7, 7]]  // Z
];

let board = createBoard(); // 遊戲主板
let player; // 當前玩家方塊
let score = 0;
let highScore = localStorage.getItem('tetrisHighScore') || 0; // 從 localStorage 讀取最高分[1]
highScoreElement.innerText = highScore;
let dropCounter = 0;
let dropInterval = 1000; // 初始掉落速度 (毫秒)
let lastTime = 0;
let gamePaused = true; // 初始為暫停狀態
let animationFrameId = null; // 用於儲存 requestAnimationFrame 的 ID

// ----- 遊戲核心功能 -----

// 建立空的遊戲板
function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

// 繪製單個方塊
function drawBlock(x, y, color) {
    context.fillStyle = color;
    context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    context.strokeStyle = '#555'; // 方塊邊框顏色
    context.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
}

// 繪製整個遊戲畫面 (包含盤面和當前方塊)
function draw() {
    // 清除畫布
    context.fillStyle = '#e0e0e0'; // 畫布背景色
    context.fillRect(0, 0, canvas.width, canvas.height);

    // 繪製已固定的方塊
    board.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                drawBlock(x, y, COLORS[value]);
            }
        });
    });

    // 繪製當前移動的方塊
    drawMatrix(player.matrix, player.pos);
}

// 繪製指定形狀矩陣
function drawMatrix(matrix, offset) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                drawBlock(x + offset.x, y + offset.y, COLORS[value]);
            }
        });
    });
}

// 碰撞檢測
function collide(board, player) {
    const matrix = player.matrix;
    const pos = player.pos;
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < matrix[y].length; ++x) {
            if (matrix[y][x] !== 0 && // 如果是方塊的一部分
                (board[y + pos.y] && board[y + pos.y][x + pos.x]) !== 0) { // 且盤面上對應位置非空
                return true; // 發生碰撞
            }
        }
    }
    return false; // 無碰撞
}

// 將落地的方塊合併到遊戲板上
function merge(board, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                board[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

// 方塊自動下落
function playerDrop() {
    if (gamePaused) return;
    player.pos.y++;
    if (checkCollision()) {
        player.pos.y--; // 回退一步
        merge(board, player); // 合併方塊
        playerReset(); // 產生新方塊
        arenaSweep(); // 檢查並消除行
        updateScoreDisplay(); // 更新分數顯示
    }
    dropCounter = 0; // 重設下落計時器
}

// 檢查是否碰撞 (邊界或已固定方塊)
function checkCollision() {
    const matrix = player.matrix;
    const pos = player.pos;
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < matrix[y].length; ++x) {
            if (matrix[y][x] !== 0) {
                let newY = y + pos.y;
                let newX = x + pos.x;
                if (newX < 0 || newX >= COLS || newY >= ROWS || (board[newY] && board[newY][newX] !== 0)) {
                    return true; // 碰撞
                }
            }
        }
    }
    return false; // 未碰撞
}


// 方塊左右移動
function playerMove(direction) {
    if (gamePaused) return;
    player.pos.x += direction;
    if (checkCollision()) {
        player.pos.x -= direction; // 碰撞則取消移動
    }
}

// 產生新的隨機方塊
function playerReset() {
    const shapes = 'ILJOTSZ'; // 可用方塊類型字串
    const randType = shapes[Math.floor(Math.random() * shapes.length)]; // 隨機選一個
    const matrix = createPiece(randType); // 建立對應形狀
    player = {
        pos: { x: Math.floor(COLS / 2) - Math.floor(matrix[0].length / 2), y: 0 }, // 初始位置置中靠上
        matrix: matrix,
    };

    // 檢查新方塊產生時是否立即碰撞 (遊戲結束條件)
    if (checkCollision()) {
        gameOver();
    }
}

// 建立指定類型的方塊形狀矩陣
function createPiece(type) {
    switch (type) {
        case 'I': return [[1, 1, 1, 1]];
        case 'L': return [[2, 0, 0], [2, 2, 2]];
        case 'J': return [[0, 0, 3], [3, 3, 3]];
        case 'O': return [[4, 4], [4, 4]];
        case 'S': return [[0, 5, 5], [5, 5, 0]];
        case 'T': return [[0, 6, 0], [6, 6, 6]];
        case 'Z': return [[7, 7, 0], [0, 7, 7]];
    }
}


// 旋轉方塊
function rotate(matrix, direction) {
    // 矩陣轉置
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    // 行反轉 (根據方向)
    if (direction > 0) { // 順時針
        matrix.forEach(row => row.reverse());
    } else { // 逆時針 (這裡我們只做順時針)
        matrix.reverse();
    }
}


// 玩家旋轉操作
function playerRotate() {
    if (gamePaused) return;
    const originalPos = { ...player.pos }; // 保存原始位置
    const matrix = player.matrix;
    rotate(matrix, 1); // 順時針旋轉

    // 處理旋轉後的碰撞 (牆壁碰撞調整)
    let offset = 1;
    while (checkCollision()) {
        player.pos.x += offset; // 嘗試左右移動
        offset = -(offset + (offset > 0 ? 1 : -1)); // 交替方向 +/-1, +/-2, ...
        if (offset > matrix[0].length + 1) { // 如果調整範圍過大，說明無法旋轉
            rotate(matrix, -1); // 旋轉回去
            player.pos.x = originalPos.x; // 恢復原始 X 位置
            return; // 取消旋轉
        }
    }
}

// 檢查並消除滿行
function arenaSweep() {
    let rowCount = 0;
    outer: for (let y = ROWS - 1; y > 0; --y) {
        for (let x = 0; x < COLS; ++x) {
            if (board[y][x] === 0) { // 如果該行有空格，跳過檢查下一行
                continue outer;
            }
        }
        // 如果執行到這裡，表示第 y 行是滿的
        const row = board.splice(y, 1)[0].fill(0); // 移除第 y 行，並用空行填充
        board.unshift(row); // 在頂部加入新的空行
        ++y; // 因為移除了行，需要重新檢查當前索引位置 (現在是上一行掉下來的)
        rowCount++;
    }

    // 計算分數 (消除越多行，分數加成越高)
    if (rowCount > 0) {
        score += rowCount * 10 * rowCount; // 簡單計分: 1行10分, 2行40分, 3行90分...
        // 可以根據需要調整計分規則，參考標準 Tetris 計分
        // 例如: [1] 中提到的計分方式
    }
}


// 更新分數顯示
function updateScoreDisplay() {
    scoreElement.innerText = score;
    if (score > highScore) {
        highScore = score;
        highScoreElement.innerText = highScore;
        localStorage.setItem('tetrisHighScore', highScore); // 保存新的最高分到 localStorage[1]
    }
}

// 遊戲主循環
function update(time = 0) {
    if (gamePaused) {
        animationFrameId = requestAnimationFrame(update); // 即使暫停也要繼續請求下一幀，以便能恢復
        return;
    }

    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }

    draw(); // 繪製遊戲畫面
    animationFrameId = requestAnimationFrame(update); // 請求下一幀動畫
}

// 遊戲結束處理
function gameOver() {
    console.log("遊戲結束！");
    gamePaused = true;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId); // 停止遊戲循環
        animationFrameId = null;
    }
    alert(`遊戲結束！\n你的分數: ${score}\n最高分數: ${highScore}`);
    startButton.disabled = false; // 允許重新開始
    startButton.innerText = "重新開始";
}

// 開始遊戲
function startGame() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId); // 確保舊的循環停止
    }
    board = createBoard(); // 清空遊戲板
    score = 0; // 分數歸零
    updateScoreDisplay(); // 更新顯示
    dropInterval = 1000; // 重設速度
    playerReset(); // 產生第一個方塊
    gamePaused = false; // 取消暫停
    lastTime = performance.now(); // 重設時間戳
    dropCounter = 0;
    startButton.disabled = true; // 禁用開始按鈕
    startButton.innerText = "遊戲中...";
    update(); // 啟動遊戲循環
}


// ----- 事件監聽 -----
document.addEventListener('keydown', event => {
    if (gamePaused) return; // 遊戲暫停時不處理按鍵

    switch (event.keyCode) {
        case 37: // 左箭頭
            playerMove(-1);
            break;
        case 39: // 右箭頭
            playerMove(1);
            break;
        case 40: // 下箭頭 (加速下落)
            playerDrop();
            break;
        case 38: // 上箭頭 (旋轉)
            playerRotate();
            break;
        // 可以添加其他按鍵，例如 P 鍵暫停
        // case 80: // 'P' 鍵
        //    gamePaused = !gamePaused;
        //    if (!gamePaused) {
        //       lastTime = performance.now(); // 恢復時重置時間戳
        //       update(); // 如果是從 requestAnimationFrame 暫停，需要重新啟動
        //    }
        //    break;
    }
});

startButton.addEventListener('click', startGame);

// 初始繪製 (顯示空盤面和分數)
updateScoreDisplay();
draw(); // 初始繪製空盤面
