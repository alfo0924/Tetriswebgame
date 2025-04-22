document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('tetris-canvas');
    const context = canvas.getContext('2d');
    const scoreElement = document.getElementById('score');
    const highScoreElement = document.getElementById('high-score');
    const startButton = document.getElementById('start-button');
    const pauseButton = document.getElementById('pause-button');

    // 從 localStorage 加載最高分，若無則為 0
    let highScore = localStorage.getItem('tetrisHighScore') || 0;
    highScoreElement.textContent = highScore;

    let score = 0;
    let isPaused = false;
    let gameInterval = null;
    let gameSpeed = 1000; // 方塊下降速度 (毫秒)
    let isGameOver = false;

    // --- 遊戲核心邏輯變數 ---
    const COLS = 10; // 遊戲區域寬度（格子數）
    const ROWS = 20; // 遊戲區域高度（格子數）
    const BLOCK_SIZE = canvas.width / COLS; // 計算每個格子的大小

    let board = []; // 代表遊戲區域的二維陣列
    let currentPiece; // 當前正在掉落的方塊
    let currentX, currentY; // 當前方塊的位置

    // 方塊形狀 (Tetrominoes) 定義 (範例)
    const SHAPES = [
        [[1, 1, 1, 1]], // I
        [[1, 1], [1, 1]], // O
        [[0, 1, 0], [1, 1, 1]], // T
        [[1, 1, 0], [0, 1, 1]], // S
        [[0, 1, 1], [1, 1, 0]], // Z
        [[0, 0, 1], [1, 1, 1]], // L
        [[1, 0, 0], [1, 1, 1]]  // J
    ];
    const COLORS = ['cyan', 'yellow', 'purple', 'green', 'red', 'orange', 'blue'];

    // --- 函數定義 ---

    // 初始化或重置遊戲板
    function initBoard() {
        board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    }

    // 繪製遊戲板和方塊
    function draw() {
        // 清除畫布
        context.fillStyle = '#000'; // 黑色背景
        context.fillRect(0, 0, canvas.width, canvas.height);

        // 繪製已固定的方塊
        board.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value > 0) { // value 代表顏色索引+1
                    context.fillStyle = COLORS[value - 1];
                    context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                    context.strokeStyle = '#222'; // 方塊邊框
                    context.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                }
            });
        });

        // 繪製當前移動的方塊
        if (currentPiece) {
            context.fillStyle = COLORS[currentPiece.colorIndex];
            currentPiece.shape.forEach((row, dy) => {
                row.forEach((value, dx) => {
                    if (value) {
                        context.fillRect((currentX + dx) * BLOCK_SIZE, (currentY + dy) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                        context.strokeStyle = '#222';
                        context.strokeRect((currentX + dx) * BLOCK_SIZE, (currentY + dy) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                    }
                });
            });
        }
    }

    // 隨機生成新方塊
    function spawnPiece() {
        const index = Math.floor(Math.random() * SHAPES.length);
        currentPiece = {
            shape: SHAPES[index],
            colorIndex: index
        };
        // 計算起始位置 (置中)
        currentX = Math.floor(COLS / 2) - Math.floor(currentPiece.shape[0].length / 2);
        currentY = 0;

        // 檢查是否一生成就碰撞 (Game Over)
        if (!isValidMove(currentX, currentY, currentPiece.shape)) {
            gameOver();
        }
    }

    // 檢查移動是否有效 (邊界、碰撞)
    function isValidMove(newX, newY, pieceShape) {
        for (let y = 0; y < pieceShape.length; y++) {
            for (let x = 0; x < pieceShape[y].length; x++) {
                if (pieceShape[y][x]) {
                    let boardX = newX + x;
                    let boardY = newY + y;

                    // 檢查邊界
                    if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
                        return false;
                    }
                    // 檢查下方碰撞 (只檢查 boardY >= 0 的部分)
                    if (boardY >= 0 && board[boardY][boardX] > 0) {
                        return false;
                    }
                }
            }
        }
        return true;
    }


    // 方塊固定到遊戲板上
    function freezePiece() {
        currentPiece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    // 確保不寫入超出頂部的區域
                    if (currentY + y >= 0) {
                        board[currentY + y][currentX + x] = currentPiece.colorIndex + 1; // 用顏色索引+1標記
                    }
                }
            });
        });
    }

    // 檢查並清除滿行
    function clearLines() {
        let linesCleared = 0;
        for (let y = ROWS - 1; y >= 0; y--) {
            if (board[y].every(cell => cell > 0)) {
                // 清除該行，並將上方所有行往下移
                board.splice(y, 1); // 移除滿行
                board.unshift(Array(COLS).fill(0)); // 在頂部加入新空行
                linesCleared++;
                y++; // 因為移除了行，需要重新檢查當前索引的行
            }
        }
        // 更新分數
        if (linesCleared > 0) {
            updateScore(linesCleared);
        }
    }

    // 更新分數和最高分
    function updateScore(linesCleared) {
        // 根據消除行數給予不同分數 (範例)
        let points = 0;
        if (linesCleared === 1) points = 100;
        else if (linesCleared === 2) points = 300;
        else if (linesCleared === 3) points = 500;
        else if (linesCleared >= 4) points = 800; // Tetris!

        score += points;
        scoreElement.textContent = score;

        // 檢查並更新最高分
        if (score > highScore) {
            highScore = score;
            highScoreElement.textContent = highScore;
            localStorage.setItem('tetrisHighScore', highScore); // 儲存最高分到 localStorage [1]
        }
    }

    // 方塊向下移動
    function moveDown() {
        if (isPaused || isGameOver) return;

        if (isValidMove(currentX, currentY + 1, currentPiece.shape)) {
            currentY++;
        } else {
            // 無法再向下移動，固定方塊
            freezePiece();
            // 檢查並清除行
            clearLines();
            // 生成新方塊
            spawnPiece();
        }
        draw(); // 每次移動後重繪
    }

    // 方塊旋轉 (簡易版，未處理踢牆 T-Spin)
    function rotatePiece() {
        if (!currentPiece) return;
        const originalShape = currentPiece.shape;
        const numRows = originalShape.length;
        const numCols = originalShape[0].length;
        let newShape = Array.from({ length: numCols }, () => Array(numRows).fill(0));

        for (let y = 0; y < numRows; y++) {
            for (let x = 0; x < numCols; x++) {
                newShape[x][numRows - 1 - y] = originalShape[y][x];
            }
        }

        // 檢查旋轉後是否有效，如果無效則不旋轉
        if (isValidMove(currentX, currentY, newShape)) {
            currentPiece.shape = newShape;
        } else {
            // 可選：嘗試左右 "踢牆" (Wall Kick) 來使旋轉有效
            // 簡單處理：若緊靠左邊界，嘗試右移一格
            if (isValidMove(currentX + 1, currentY, newShape)) {
                currentX++;
                currentPiece.shape = newShape;
            }
            // 簡單處理：若緊靠右邊界，嘗試左移一格
            else if (isValidMove(currentX - 1, currentY, newShape)) {
                currentX--;
                currentPiece.shape = newShape;
            }
            // 更複雜的踢牆邏輯 (SRS) 在此省略
        }
    }

    // 處理鍵盤輸入
    function handleKeyPress(event) {
        if (isPaused || isGameOver || !currentPiece) return;

        switch (event.keyCode) {
            case 37: // 左箭頭
                if (isValidMove(currentX - 1, currentY, currentPiece.shape)) {
                    currentX--;
                }
                break;
            case 39: // 右箭頭
                if (isValidMove(currentX + 1, currentY, currentPiece.shape)) {
                    currentX++;
                }
                break;
            case 40: // 下箭頭 (加速下降)
                moveDown();
                // 可選：加速下降時重置計時器，使其立即再次下降
                // clearInterval(gameInterval);
                // gameInterval = setInterval(moveDown, gameSpeed);
                break;
            case 38: // 上箭頭 (旋轉)
            case 88: // X 鍵 (旋轉)
                rotatePiece();
                break;
            case 32: // 空格鍵 (硬著陸)
                while (isValidMove(currentX, currentY + 1, currentPiece.shape)) {
                    currentY++;
                }
                freezePiece(); // 立刻固定
                clearLines();
                spawnPiece();
                break;
        }
        draw(); // 按鍵操作後立即重繪
    }

    // 遊戲結束處理
    function gameOver() {
        isGameOver = true;
        clearInterval(gameInterval);
        gameInterval = null;
        context.fillStyle = 'rgba(0, 0, 0, 0.75)';
        context.fillRect(0, canvas.height / 3, canvas.width, canvas.height / 3);
        context.font = '24px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.fillText('遊戲結束!', canvas.width / 2, canvas.height / 2);
        startButton.textContent = '重新開始';
        startButton.style.display = 'inline-block';
        pauseButton.style.display = 'none';
    }

    // 開始遊戲
    function startGame() {
        if (gameInterval) { // 防止重複啟動
            clearInterval(gameInterval);
        }
        isGameOver = false;
        isPaused = false;
        score = 0;
        scoreElement.textContent = score;
        initBoard();
        spawnPiece();
        draw();
        gameInterval = setInterval(moveDown, gameSpeed); // 開始自動下降
        startButton.style.display = 'none'; // 隱藏開始按鈕
        pauseButton.textContent = '暫停';
        pauseButton.style.display = 'inline-block'; // 顯示暫停按鈕
    }

    // 暫停/繼續遊戲
    function togglePause() {
        if (isGameOver) return;

        isPaused = !isPaused;
        if (isPaused) {
            clearInterval(gameInterval);
            gameInterval = null; // 清除計時器
            pauseButton.textContent = '繼續';
            // 可選：顯示暫停提示
            context.font = '24px Arial';
            context.fillStyle = 'rgba(255, 255, 255, 0.7)';
            context.textAlign = 'center';
            context.fillText('已暫停', canvas.width / 2, canvas.height / 2);
        } else {
            pauseButton.textContent = '暫停';
            draw(); // 清除暫停提示
            gameInterval = setInterval(moveDown, gameSpeed); // 恢復計時器
        }
    }


    // --- 事件監聽 ---
    startButton.addEventListener('click', startGame);
    pauseButton.addEventListener('click', togglePause);
    document.addEventListener('keydown', handleKeyPress);

    // 初始繪製 (例如繪製空畫布或 Logo)
    draw(); // 可以先畫一個空的遊戲板
});
