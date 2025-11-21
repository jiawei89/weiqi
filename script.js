// 全局游戏状态
class GoGame {
    constructor() {
        this.boardSize = 19;
        this.board = [];
        this.currentPlayer = 'black';
        this.gameMode = 'pvp'; // pvp 或 pve
        this.aiDifficulty = 'medium';
        this.targetScore = 20;
        this.players = {
            black: { name: '黑方', score: 0, captures: 0 },
            white: { name: '白方', score: 0, captures: 0 }
        };
        this.moveHistory = [];
        this.koPoint = null;
        this.lastMove = null;
        this.consecutivePasses = 0;
        this.gameOver = false;
        this.prisoners = { black: 0, white: 0 };
        this.territory = { black: 0, white: 0 };

        this.initializeBoard();
    }

    initializeBoard() {
        this.board = Array(this.boardSize).fill(null).map(() =>
            Array(this.boardSize).fill(null)
        );
        this.currentPlayer = 'black';
        this.moveHistory = [];
        this.koPoint = null;
        this.lastMove = null;
        this.consecutivePasses = 0;
        this.gameOver = false;
        this.prisoners = { black: 0, white: 0 };
        this.territory = { black: 0, white: 0 };
    }

    // 放置棋子（简化版，因为isValidMove已包含自杀检查）
    placeStone(row, col) {
        if (this.gameOver) return { success: false, captured: [] };
        if (!this.isValidMove(row, col)) return { success: false, captured: [] };

        // 放置棋子
        this.board[row][col] = this.currentPlayer;
        this.lastMove = { row, col, player: this.currentPlayer };

        // 提取对手的死子
        const opponent = this.currentPlayer === 'black' ? 'white' : 'black';
        const capturedStones = this.captureStones(opponent);

        // 检查劫争
        this.checkKo(row, col, capturedStones);

        // 更新历史记录
        this.moveHistory.push({
            row, col, player: this.currentPlayer,
            captures: capturedStones
        });

        // 更新提子数
        this.prisoners[opponent] += capturedStones.length;

        // 重置连续pass计数
        this.consecutivePasses = 0;

        // 切换玩家
        this.currentPlayer = opponent;

        return { success: true, captured: capturedStones };
    }

    // 检查移动是否有效（增强版，包含自杀检查）
    isValidMove(row, col) {
        // 检查边界
        if (row < 0 || row >= this.boardSize || col < 0 || col >= this.boardSize) {
            return false;
        }

        // 检查位置是否已被占用
        if (this.board[row][col] !== null) {
            return false;
        }

        // 检查劫争
        if (this.koPoint && this.koPoint.row === row && this.koPoint.col === col) {
            return false;
        }

        // 检查是否为自杀（模拟落子）
        return !this.wouldBeSuicide(row, col, this.currentPlayer);
    }

    // 检查落子是否为自杀
    wouldBeSuicide(row, col, player) {
        // 临时放置棋子
        this.board[row][col] = player;

        // 模拟提子
        const opponent = player === 'black' ? 'white' : 'black';
        const capturedStones = this.simulateCapturesForSuicideCheck(opponent);

        // 获取当前棋子所在的群组
        const group = this.getGroup(row, col);
        const hasLiberties = this.hasLiberties(group);

        // 恢复棋盘
        this.board[row][col] = null;

        // 如果没有气且没有提子，则是自杀
        return !hasLiberties && capturedStones.length === 0;
    }

    // 模拟提子（用于自杀检查）
    simulateCapturesForSuicideCheck(opponent) {
        const capturedStones = [];

        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                if (this.board[row][col] === opponent) {
                    const group = this.getGroup(row, col);
                    if (!this.hasLiberties(group)) {
                        for (const stone of group) {
                            // 模拟移除棋子
                            this.board[stone.row][stone.col] = null;
                            capturedStones.push(stone);
                        }
                    }
                }
            }
        }

        // 恢复被移除的棋子
        for (const stone of capturedStones) {
            this.board[stone.row][stone.col] = opponent;
        }

        return capturedStones;
    }

    // 获取棋子的邻接点
    getNeighbors(row, col) {
        const neighbors = [];
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (newRow >= 0 && newRow < this.boardSize &&
                newCol >= 0 && newCol < this.boardSize) {
                neighbors.push({ row: newRow, col: newCol });
            }
        }

        return neighbors;
    }

    // 获取同色棋子群组
    getGroup(row, col) {
        const color = this.board[row][col];
        if (!color) return [];

        const group = [];
        const visited = Array(this.boardSize).fill(null).map(() =>
            Array(this.boardSize).fill(false)
        );

        const dfs = (r, c) => {
            if (visited[r][c]) return;
            visited[r][c] = true;

            if (this.board[r][c] === color) {
                group.push({ row: r, col: c });
                const neighbors = this.getNeighbors(r, c);
                for (const neighbor of neighbors) {
                    dfs(neighbor.row, neighbor.col);
                }
            }
        };

        dfs(row, col);
        return group;
    }

    // 检查棋子群组是否有气
    hasLiberties(group) {
        for (const stone of group) {
            const neighbors = this.getNeighbors(stone.row, stone.col);
            for (const neighbor of neighbors) {
                if (this.board[neighbor.row][neighbor.col] === null) {
                    return true;
                }
            }
        }
        return false;
    }

    // 提取死子
    captureStones(color) {
        const capturedStones = [];

        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                if (this.board[row][col] === color) {
                    const group = this.getGroup(row, col);
                    if (!this.hasLiberties(group)) {
                        for (const stone of group) {
                            this.board[stone.row][stone.col] = null;
                            capturedStones.push(stone);
                        }
                    }
                }
            }
        }

        return capturedStones;
    }

    // 检查是否是自杀（保留用于其他地方）
    isSuicide(row, col) {
        const color = this.board[row][col];
        const group = this.getGroup(row, col);
        return !this.hasLiberties(group);
    }

    // 检查劫争
    checkKo(row, col, capturedStones) {
        if (capturedStones.length === 1 &&
            this.moveHistory.length > 0) {
            const lastMove = this.moveHistory[this.moveHistory.length - 1];
            if (lastMove.captures.length === 1) {
                const captured = capturedStones[0];
                const lastCaptured = lastMove.captures[0];

                // 如果是提回刚被提的子
                if (captured.row === lastMove.row &&
                    captured.col === lastMove.col &&
                    lastCaptured.row === row &&
                    lastCaptured.col === col) {
                    this.koPoint = { row: lastCaptured.row, col: lastCaptured.col };
                    return;
                }
            }
        }
        this.koPoint = null;
    }

    // Pass（弃子）
    pass() {
        if (this.gameOver) return;

        this.consecutivePasses++;
        this.moveHistory.push({
            player: this.currentPlayer,
            pass: true
        });

        // 如果双方连续pass，游戏结束
        if (this.consecutivePasses >= 2) {
            this.endGame();
        } else {
            this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black';
        }
    }

    // 悔棋
    undo() {
        if (this.moveHistory.length === 0 || this.gameOver) return false;

        const lastMove = this.moveHistory.pop();

        if (lastMove.pass) {
            this.consecutivePasses = Math.max(0, this.consecutivePasses - 1);
        } else {
            // 移除最后下的子
            this.board[lastMove.row][lastMove.col] = null;

            // 恢复被提的子
            if (lastMove.captures && lastMove.captures.length > 0) {
                const opponent = lastMove.player === 'black' ? 'white' : 'black';
                for (const stone of lastMove.captures) {
                    this.board[stone.row][stone.col] = opponent;
                    this.prisoners[opponent]--;
                }
            }

            // 恢复劫争点
            if (this.moveHistory.length > 0) {
                const prevMove = this.moveHistory[this.moveHistory.length - 1];
                if (prevMove.captures && prevMove.captures.length === 1) {
                    this.koPoint = prevMove.captures[0];
                }
            } else {
                this.koPoint = null;
            }
        }

        this.currentPlayer = lastMove.player;
        this.lastMove = this.moveHistory.length > 0 ?
            this.moveHistory[this.moveHistory.length - 1] : null;

        return true;
    }

    // 计算领地
    calculateTerritory() {
        const visited = Array(this.boardSize).fill(null).map(() =>
            Array(this.boardSize).fill(false)
        );

        this.territory = { black: 0, white: 0 };

        // 只有在游戏结束时才计算领地，或者在棋盘比较满的时候
        const boardFilled = this.calculateBoardFillPercentage();
        if (boardFilled < 0.3 && this.consecutivePasses < 2) {
            // 游戏早期，不计算领地，只计算提子
            return;
        }

        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                if (!visited[row][col] && this.board[row][col] === null) {
                    const territory = this.floodFillTerritory(row, col, visited);
                    if (territory.owner) {
                        this.territory[territory.owner] += territory.size;
                    }
                }
            }
        }
    }

    // 洪水填充算法计算领地
    floodFillTerritory(startRow, startCol, visited) {
        const stack = [{ row: startRow, col: startCol }];
        const territory = [];
        const borders = new Set();

        while (stack.length > 0) {
            const { row, col } = stack.pop();

            if (visited[row][col]) continue;
            visited[row][col] = true;

            if (this.board[row][col] === null) {
                territory.push({ row, col });

                const neighbors = this.getNeighbors(row, col);
                for (const neighbor of neighbors) {
                    if (!visited[neighbor.row][neighbor.col]) {
                        if (this.board[neighbor.row][neighbor.col] === null) {
                            stack.push(neighbor);
                        } else {
                            borders.add(this.board[neighbor.row][neighbor.col]);
                        }
                    }
                }
            }
        }

        // 确定领地归属
        if (borders.size === 1) {
            return { owner: [...borders][0], size: territory.length };
        }

        return { owner: null, size: 0 };
    }

    // 计算得分
    calculateScore(calculateTerritory = false, includeKomi = false) {
        // 只有在明确要求时才计算领地，或者在游戏结束时
        if (calculateTerritory || this.gameOver || this.consecutivePasses >= 2) {
            this.calculateTerritory();
        }

        const blackScore = this.territory.black + this.prisoners.white;
        let whiteScore = this.territory.white + this.prisoners.black;

        // 贴目只在游戏结束时或明确要求时加入
        if (includeKomi || this.gameOver || this.consecutivePasses >= 2) {
            whiteScore += 6.5; // 贴目6.5目
        }

        return { black: blackScore, white: whiteScore };
    }

    // 游戏结束（只用于pass或棋盘满的情况）
    endGame() {
        this.gameOver = true;
        const scores = this.calculateScore(true, true); // 计算领地，加贴目

        // 更新得分
        this.players.black.score = scores.black;
        this.players.white.score = scores.white;

        const winner = scores.black > scores.white ? 'black' : 'white';
        const winningScore = Math.max(scores.black, scores.white);
        const targetReached = winningScore >= this.targetScore;

        return {
            winner,
            scores,
            targetReached,
            finalWinner: winner
        };
    }

    // 计算棋盘填充率
    calculateBoardFillPercentage() {
        let filledCount = 0;
        const totalPoints = this.boardSize * this.boardSize;

        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                if (this.board[row][col] !== null) {
                    filledCount++;
                }
            }
        }

        return filledCount / totalPoints;
    }

    // 认输
    resign(player) {
        if (this.gameOver) return;

        this.gameOver = true;
        const winner = player === 'black' ? 'white' : 'black';
        const scores = {
            black: this.targetScore,
            white: 0
        };

        if (winner === 'white') {
            scores.white = this.targetScore;
            scores.black = 0;
        }

        this.players.black.score = scores.black;
        this.players.white.score = scores.white;

        return {
            winner,
            scores,
            resigned: true,
            finalWinner: winner
        };
    }
}

// AI类
class GoAI {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
        this.boardSize = 19;
        this.maxDepth = this.getMaxDepth();
        this.maxTime = this.getMaxThinkingTime();
        this.startTime = 0;
        this.nodeCount = 0;
    }

    getMaxDepth() {
        switch (this.difficulty) {
            case 'easy': return 2;
            case 'medium': return 4;
            case 'hard': return 6;
            default: return 4;
        }
    }

    getMaxThinkingTime() {
        // AI最大思考时间（毫秒）
        switch (this.difficulty) {
            case 'easy': return 500;
            case 'medium': return 1500;
            case 'hard': return 3000;
            default: return 1500;
        }
    }

    // 获取AI的下一步（性能优化版）
    getNextMove(game) {
        this.startTime = Date.now();
        this.nodeCount = 0;

        const validMoves = this.getValidMoves(game);
        if (validMoves.length === 0) return null;

        // 如果没有时间限制或难度较低，直接使用原有方法
        switch (this.difficulty) {
            case 'easy':
                return this.getRandomMove(validMoves);
            case 'medium':
                return this.getMediumMove(game, validMoves);
            case 'hard':
                return this.getHardMoveOptimized(game, validMoves);
            default:
                return this.getRandomMove(validMoves);
        }
    }

    // 获取所有有效移动（优化版，使用增强的isValidMove）
    getValidMoves(game) {
        const validMoves = [];
        const playedMoves = this.getPlayedMoves(game);

        // 优先考虑已下棋子周围的位置
        const candidatePositions = new Set();

        // 如果棋盘是空的，从中心附近开始
        if (playedMoves.length === 0) {
            const center = Math.floor(this.boardSize / 2);
            for (let i = -2; i <= 2; i++) {
                for (let j = -2; j <= 2; j++) {
                    const row = center + i;
                    const col = center + j;
                    if (row >= 0 && row < this.boardSize && col >= 0 && col < this.boardSize) {
                        candidatePositions.add(`${row},${col}`);
                    }
                }
            }
        } else {
            // 收集所有已下棋子周围的位置
            playedMoves.forEach(move => {
                const neighbors = game.getNeighbors(move.row, move.col);
                neighbors.forEach(neighbor => {
                    candidatePositions.add(`${neighbor.row},${neighbor.col}`);
                });
            });
        }

        // 检查候选位置的合法性（现在isValidMove已经包含自杀检查）
        candidatePositions.forEach(pos => {
            const [row, col] = pos.split(',').map(Number);
            if (game.isValidMove(row, col)) {
                validMoves.push({ row, col });
            }
        });

        // 如果没有找到有效的候选位置，检查整个棋盘
        if (validMoves.length === 0) {
            for (let row = 0; row < game.boardSize; row++) {
                for (let col = 0; col < game.boardSize; col++) {
                    if (game.isValidMove(row, col)) {
                        validMoves.push({ row, col });
                    }
                }
            }
        }

        return validMoves;
    }

    // 获取已下棋子列表
    getPlayedMoves(game) {
        const moves = [];
        for (let row = 0; row < game.boardSize; row++) {
            for (let col = 0; col < game.boardSize; col++) {
                if (game.board[row][col] !== null) {
                    moves.push({ row, col });
                }
            }
        }
        return moves;
    }

    // 随机移动（简单难度）
    getRandomMove(validMoves) {
        if (validMoves.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * validMoves.length);
        return validMoves[randomIndex];
    }

    // 中等难度AI
    getMediumMove(game, validMoves) {
        const scoredMoves = [];

        for (const move of validMoves) {
            const score = this.evaluateMove(game, move);
            scoredMoves.push({ ...move, score });
        }

        scoredMoves.sort((a, b) => b.score - a.score);

        // 从前几个最佳移动中随机选择一个
        const topMoves = scoredMoves.slice(0, Math.min(3, scoredMoves.length));
        const randomIndex = Math.floor(Math.random() * topMoves.length);
        return topMoves[randomIndex];
    }

    // 高级难度AI（性能优化版）
    getHardMove(game, validMoves) {
        let bestMove = null;
        let bestScore = -Infinity;

        for (const move of validMoves) {
            const score = this.minimax(game, move, this.maxDepth, false, -Infinity, Infinity);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove;
    }

    // 性能优化版Hard模式
    getHardMoveOptimized(game, validMoves) {
        // 第一轮快速评估筛选候选移动
        const scoredMoves = [];
        for (const move of validMoves) {
            const quickScore = this.quickEvaluateMove(game, move);
            scoredMoves.push({ ...move, score: quickScore });
        }

        // 只保留前N个候选移动
        scoredMoves.sort((a, b) => b.score - a.score);
        const candidateMoves = scoredMoves.slice(0, Math.min(10, validMoves.length));

        let bestMove = null;
        let bestScore = -Infinity;

        // 对候选移动进行深度搜索
        for (const move of candidateMoves) {
            // 检查是否超时
            if (Date.now() - this.startTime > this.maxTime) {
                break;
            }

            const score = this.minimax(game, move, this.maxDepth, false, -Infinity, Infinity);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        // 如果没有找到最佳移动，使用第一轮评估的最佳结果
        if (!bestMove && candidateMoves.length > 0) {
            bestMove = candidateMoves[0];
        }

        return bestMove;
    }

    // 快速评估移动（用于第一轮筛选）
    quickEvaluateMove(game, move) {
        let score = 0;

        // 基本位置评估
        score += this.evaluatePosition(move.row, move.col);

        // 快速模式识别
        const neighbors = game.getNeighbors(move.row, move.col);
        const player = game.currentPlayer;
        const opponent = player === 'black' ? 'white' : 'black';

        // 检查是否能立即吃子
        let canCapture = false;
        neighbors.forEach(n => {
            if (game.board[n.row][n.col] === opponent) {
                const group = game.getGroup(n.row, n.col);
                if (game.hasLiberties(group) && this.countGroupLiberties(game, group) === 1) {
                    canCapture = true;
                }
            }
        });

        if (canCapture) score += 50; // 高优先级

        // 检查是否需要救子
        let needSave = false;
        neighbors.forEach(n => {
            if (game.board[n.row][n.col] === player) {
                const group = game.getGroup(n.row, n.col);
                if (game.hasLiberties(group) && this.countGroupLiberties(game, group) === 1) {
                    needSave = true;
                }
            }
        });

        if (needSave) score += 30; // 高优先级

        return score;
    }

    // 评估移动（增强版）
    evaluateMove(game, move) {
        let score = 0;

        // 保存当前状态
        const tempBoard = game.board.map(row => [...row]);
        const tempPlayer = game.currentPlayer;
        const tempPrisoners = { ...game.prisoners };

        // 模拟移动
        game.board[move.row][move.col] = tempPlayer;

        // 评估提子
        const opponent = tempPlayer === 'black' ? 'white' : 'black';
        const capturedStones = this.simulateCaptures(game, opponent);
        score += capturedStones.length * 15; // 提子权重增加

        // 评估位置价值
        score += this.evaluatePosition(move.row, move.col);

        // 评估安全性
        score += this.evaluateSafety(game, move);

        // 评估围棋模式
        score += this.evaluateGoPatterns(game, move);

        // 评估领地潜力
        score += this.evaluateTerritoryPotential(game, move);

        // 评估连气情况
        score += this.evaluateLiberties(game, move);

        // 恢复棋盘
        game.board = tempBoard;
        game.prisoners = tempPrisoners;

        return score;
    }

    // 模拟提子（不修改原游戏状态）
    simulateCaptures(game, opponent) {
        const capturedStones = [];

        for (let row = 0; row < game.boardSize; row++) {
            for (let col = 0; col < game.boardSize; col++) {
                if (game.board[row][col] === opponent) {
                    const group = game.getGroup(row, col);
                    if (!game.hasLiberties(group)) {
                        for (const stone of group) {
                            capturedStones.push(stone);
                        }
                    }
                }
            }
        }

        return capturedStones;
    }

    // 评估围棋模式
    evaluateGoPatterns(game, move) {
        let score = 0;
        const patterns = this.identifyPatterns(game, move);

        // 奖励好的模式
        if (patterns.eye) score += 20; // 做眼
        if (patterns.connection) score += 10; // 连接
        if (patterns.cut) score += 15; // 切断
        if (patterns.atari) score += 25; // 打吃
        if (patterns.save) score += 20; // 救子
        if (patterns.extension) score += 8; // 展开
        if (patterns.invasion) score += 12; // 打入
        if (patterns.reduce) score += 10; // 消减

        // 惩罚坏的模式
        if (patterns.badShape) score -= 15; // 恶形
        if (patterns.overconcentrated) score -= 10; // 过度集中

        return score;
    }

    // 识别围棋模式
    identifyPatterns(game, move) {
        const patterns = {
            eye: false,
            connection: false,
            cut: false,
            atari: false,
            save: false,
            extension: false,
            invasion: false,
            reduce: false,
            badShape: false,
            overconcentrated: false
        };

        const player = game.currentPlayer;
        const opponent = player === 'black' ? 'white' : 'black';
        const neighbors = game.getNeighbors(move.row, move.col);

        // 检查做眼模式
        const friendlyNeighbors = neighbors.filter(n => game.board[n.row][n.col] === player).length;
        const emptyNeighbors = neighbors.filter(n => game.board[n.row][n.col] === null).length;
        if (friendlyNeighbors >= 3 && emptyNeighbors >= 1) {
            patterns.eye = true;
        }

        // 检查连接模式
        const potentialConnections = neighbors.filter(n => game.board[n.row][n.col] === player).length;
        if (potentialConnections >= 2) {
            patterns.connection = true;
        }

        // 检查切断模式
        const enemyNeighbors = neighbors.filter(n => game.board[n.row][n.col] === opponent).length;
        const enemyGroups = this.getEnemyGroupsAround(game, move);
        if (enemyGroups >= 2) {
            patterns.cut = true;
        }

        // 检查打吃模式
        const threatenedGroups = this.getThreatenedGroups(game, move);
        if (threatenedGroups.length > 0) {
            patterns.atari = true;
        }

        // 检查救子模式
        const friendlyGroupsInDanger = this.getFriendlyGroupsInDanger(game, move);
        if (friendlyGroupsInDanger.length > 0) {
            patterns.save = true;
        }

        // 检查展开模式
        const boardFillRate = game.calculateBoardFillPercentage();
        if (boardFillRate < 0.3 && emptyNeighbors >= 2) {
            patterns.extension = true;
        }

        // 检查恶形
        if (friendlyNeighbors === 1 && emptyNeighbors <= 2) {
            patterns.badShape = true;
        }

        // 检查过度集中
        const friendlyCount = this.countFriendlyStonesAround(game, move, 3);
        if (friendlyCount > 6) {
            patterns.overconcentrated = true;
        }

        return patterns;
    }

    // 获取周围的敌方棋子群数量
    getEnemyGroupsAround(game, move) {
        const opponent = game.currentPlayer === 'black' ? 'white' : 'black';
        const neighbors = game.getNeighbors(move.row, move.col);
        const groups = new Set();

        neighbors.forEach(n => {
            if (game.board[n.row][n.col] === opponent) {
                const group = game.getGroup(n.row, n.col);
                groups.add(group.map(s => `${s.row},${s.col}`).join(','));
            }
        });

        return groups.size;
    }

    // 获取受到威胁的敌方棋子群
    getThreatenedGroups(game, move) {
        const opponent = game.currentPlayer === 'black' ? 'white' : 'black';
        const neighbors = game.getNeighbors(move.row, move.col);
        const threatenedGroups = [];

        neighbors.forEach(n => {
            if (game.board[n.row][n.col] === opponent) {
                const group = game.getGroup(n.row, n.col);
                // 模拟下子后的情况
                const tempBoard = game.board[n.row][n.col];
                game.board[move.row][move.col] = game.currentPlayer;

                if (!game.hasLiberties(group)) {
                    threatenedGroups.push(group);
                }

                game.board[move.row][move.col] = null;
                game.board[n.row][n.col] = tempBoard;
            }
        });

        return threatenedGroups;
    }

    // 获取危险的友方棋子群
    getFriendlyGroupsInDanger(game, move) {
        const player = game.currentPlayer;
        const neighbors = game.getNeighbors(move.row, move.col);
        const endangeredGroups = [];

        neighbors.forEach(n => {
            if (game.board[n.row][n.col] === player) {
                const group = game.getGroup(n.row, n.col);
                if (game.hasLiberties(group) && this.countGroupLiberties(game, group) <= 2) {
                    endangeredGroups.push(group);
                }
            }
        });

        return endangeredGroups;
    }

    // 计算棋子群的气数
    countGroupLiberties(game, group) {
        const liberties = new Set();

        group.forEach(stone => {
            const neighbors = game.getNeighbors(stone.row, stone.col);
            neighbors.forEach(n => {
                if (game.board[n.row][n.col] === null) {
                    liberties.add(`${n.row},${n.col}`);
                }
            });
        });

        return liberties.size;
    }

    // 统计周围的友方棋子数
    countFriendlyStonesAround(game, move, distance) {
        let count = 0;
        const player = game.currentPlayer;

        for (let dr = -distance; dr <= distance; dr++) {
            for (let dc = -distance; dc <= distance; dc++) {
                if (dr === 0 && dc === 0) continue;
                const row = move.row + dr;
                const col = move.col + dc;
                if (row >= 0 && row < game.boardSize && col >= 0 && col < game.boardSize) {
                    if (game.board[row][col] === player) {
                        count++;
                    }
                }
            }
        }

        return count;
    }

    // 评估领地潜力
    evaluateTerritoryPotential(game, move) {
        let score = 0;
        const player = game.currentPlayer;
        const center = Math.floor(this.boardSize / 2);
        const distanceFromCenter = Math.abs(move.row - center) + Math.abs(move.col - center);

        // 早期偏好中心附近建立势力
        const boardFillRate = game.calculateBoardFillPercentage();
        if (boardFillRate < 0.2) {
            score += (10 - distanceFromCenter) * 2;
        }

        // 中期偏好扩张影响力
        if (boardFillRate >= 0.2 && boardFillRate < 0.5) {
            const influence = this.calculateInfluence(game, move);
            score += influence * 3;
        }

        return score;
    }

    // 计算影响力
    calculateInfluence(game, move) {
        let influence = 0;
        const player = game.currentPlayer;
        const checkDistance = 3;

        for (let dr = -checkDistance; dr <= checkDistance; dr++) {
            for (let dc = -checkDistance; dc <= checkDistance; dc++) {
                const row = move.row + dr;
                const col = move.col + dc;
                if (row >= 0 && row < game.boardSize && col >= 0 && col < game.boardSize) {
                    const distance = Math.abs(dr) + Math.abs(dc);
                    if (game.board[row][col] === player) {
                        influence += (checkDistance - distance + 1);
                    } else if (game.board[row][col] !== null) {
                        influence -= (checkDistance - distance + 1) * 0.5;
                    }
                }
            }
        }

        return influence;
    }

    // 评估连气情况
    evaluateLiberties(game, move) {
        let score = 0;
        const player = game.currentPlayer;

        // 创建临时棋盘来评估这步棋的效果
        const tempBoard = game.board.map(row => [...row]);
        game.board[move.row][move.col] = player;

        // 检查这步棋自身的气
        const group = game.getGroup(move.row, move.col);
        const liberties = this.countGroupLiberties(game, group);
        score += liberties * 5;

        // 检查这步棋是否能增加友邻棋子的气
        const neighbors = game.getNeighbors(move.row, move.col);
        neighbors.forEach(n => {
            if (game.board[n.row][n.col] === player) {
                const neighborGroup = game.getGroup(n.row, n.col);
                const neighborLiberties = this.countGroupLiberties(game, neighborGroup);
                score += neighborLiberties * 2;
            }
        });

        // 恢复棋盘
        game.board = tempBoard;

        return score;
    }

    // 评估位置价值
    evaluatePosition(row, col) {
        let score = 0;
        const center = Math.floor(this.boardSize / 2);
        const distanceFromCenter = Math.abs(row - center) + Math.abs(col - center);

        // 偏好中心位置
        score += (this.boardSize - distanceFromCenter) * 0.1;

        // 角和边奖励
        if ((row === 0 || row === this.boardSize - 1) &&
            (col === 0 || col === this.boardSize - 1)) {
            score += 2; // 角
        } else if (row === 0 || row === this.boardSize - 1 ||
                   col === 0 || col === this.boardSize - 1) {
            score += 1; // 边
        }

        return score;
    }

    // 评估安全性
    evaluateSafety(game, move) {
        let score = 0;
        const neighbors = game.getNeighbors(move.row, move.col);
        let friendlyNeighbors = 0;
        let enemyNeighbors = 0;

        for (const neighbor of neighbors) {
            if (game.board[neighbor.row][neighbor.col] === game.currentPlayer) {
                friendlyNeighbors++;
            } else if (game.board[neighbor.row][neighbor.col] !== null) {
                enemyNeighbors++;
            }
        }

        // 偏好有友邻的位置
        score += friendlyNeighbors * 2;

        // 避免被包围
        if (enemyNeighbors > friendlyNeighbors) {
            score -= enemyNeighbors;
        }

        return score;
    }

    // Minimax算法（优化版）
    minimax(game, move, depth, isMaximizing, alpha, beta) {
        // 检查超时
        if (Date.now() - this.startTime > this.maxTime) {
            return this.quickEvaluateMove(game, move);
        }

        this.nodeCount++;

        // 终止条件
        if (depth === 0) {
            return this.evaluateMove(game, move);
        }

        // 保存当前状态
        const tempBoard = game.board.map(row => [...row]);
        const tempPlayer = game.currentPlayer;

        // 模拟移动
        game.board[move.row][move.col] = tempPlayer;
        game.currentPlayer = tempPlayer === 'black' ? 'white' : 'black';

        // 处理提子
        const opponent = tempPlayer;
        const capturedStones = this.simulateCaptures(game, opponent);

        let validMoves;
        // 优化：在深度较大时限制搜索范围
        if (depth >= 4) {
            validMoves = this.getValidMoves(game).slice(0, 15); // 限制候选移动数量
        } else {
            validMoves = this.getValidMoves(game);
        }

        // 如果没有有效移动，返回当前评估
        if (validMoves.length === 0) {
            game.board = tempBoard;
            game.currentPlayer = tempPlayer;
            return this.evaluateMove(game, move);
        }

        if (isMaximizing) {
            let maxScore = -Infinity;
            for (const nextMove of validMoves) {
                // 检查超时
                if (Date.now() - this.startTime > this.maxTime) {
                    break;
                }

                const score = this.minimax(game, nextMove, depth - 1, false, alpha, beta);
                maxScore = Math.max(maxScore, score);
                alpha = Math.max(alpha, score);
                if (beta <= alpha) break; // Alpha-Beta剪枝
            }
            // 恢复状态
            game.board = tempBoard;
            game.currentPlayer = tempPlayer;
            return maxScore;
        } else {
            let minScore = Infinity;
            for (const nextMove of validMoves) {
                // 检查超时
                if (Date.now() - this.startTime > this.maxTime) {
                    break;
                }

                const score = this.minimax(game, nextMove, depth - 1, true, alpha, beta);
                minScore = Math.min(minScore, score);
                beta = Math.min(beta, score);
                if (beta <= alpha) break; // Alpha-Beta剪枝
            }
            // 恢复状态
            game.board = tempBoard;
            game.currentPlayer = tempPlayer;
            return minScore;
        }
    }
}

// 数据管理类
class DataManager {
    constructor() {
        this.storageKey = 'goGameData';
        this.initializeData();
    }

    initializeData() {
        if (!localStorage.getItem(this.storageKey)) {
            const initialData = {
                players: [],
                settings: {
                    sound: true,
                    vibration: true,
                    coordinates: true,
                    animation: true
                },
                stats: {
                    totalGames: 0,
                    blackWins: 0,
                    whiteWins: 0
                }
            };
            localStorage.setItem(this.storageKey, JSON.stringify(initialData));
        }
    }

    getData() {
        return JSON.parse(localStorage.getItem(this.storageKey));
    }

    saveData(data) {
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    }

    updatePlayerScore(playerName, scoreChange, isWin) {
        const data = this.getData();
        let player = data.players.find(p => p.name === playerName);

        if (!player) {
            player = {
                name: playerName,
                score: 0,
                wins: 0,
                losses: 0,
                lastPlayed: new Date().toISOString(),
                winStreak: 0
            };
            data.players.push(player);
        }

        player.score += scoreChange;
        player.lastPlayed = new Date().toISOString();

        if (isWin) {
            player.wins++;
            player.winStreak++;
        } else {
            player.losses++;
            player.winStreak = 0;
        }

        // 更新统计
        data.stats.totalGames++;
        if (isWin) {
            if (playerName.includes('黑')) {
                data.stats.blackWins++;
            } else {
                data.stats.whiteWins++;
            }
        }

        this.saveData(data);
        return player;
    }

    getLeaderboard(sortBy = 'score') {
        const data = this.getData();
        const players = data.players.filter(p => p.score > 0);

        switch (sortBy) {
            case 'score':
                return players.sort((a, b) => b.score - a.score);
            case 'winRate':
                return players.sort((a, b) => {
                    const aRate = a.wins / (a.wins + a.losses) || 0;
                    const bRate = b.wins / (b.wins + b.losses) || 0;
                    return bRate - aRate;
                });
            case 'winStreak':
                return players.sort((a, b) => b.winStreak - a.winStreak);
            default:
                return players.sort((a, b) => b.score - a.score);
        }
    }

    clearAllData() {
        this.initializeData();
    }

    getSettings() {
        const data = this.getData();
        return data.settings;
    }

    updateSettings(settings) {
        const data = this.getData();
        data.settings = { ...data.settings, ...settings };
        this.saveData(data);
    }
}

// UI管理类
class UIManager {
    constructor() {
        this.currentScreen = 'welcome';
        this.game = null;
        this.ai = null;
        this.dataManager = new DataManager();
        this.canvas = null;
        this.ctx = null;
        this.cellSize = 40;
        this.boardPadding = 20;

        this.initializeElements();
        this.bindEvents();
        this.initializeCanvas();
    }

    initializeElements() {
        // 屏幕元素
        this.screens = {
            welcome: document.getElementById('welcome-screen'),
            setup: document.getElementById('setup-screen'),
            game: document.getElementById('game-screen'),
            leaderboard: document.getElementById('leaderboard-screen')
        };

        // 按钮元素
        this.buttons = {
            startGame: document.getElementById('start-game-btn'),
            backToWelcome: document.getElementById('back-to-welcome'),
            startMatch: document.getElementById('start-match'),
            undo: document.getElementById('undo-btn'),
            pass: document.getElementById('pass-btn'),
            resign: document.getElementById('resign-btn'),
            pause: document.getElementById('pause-btn'),
            menu: document.getElementById('menu-btn'),
            viewLeaderboard: document.getElementById('view-leaderboard-btn'),
            clearData: document.getElementById('clear-data-btn'),
            backToMenu: document.getElementById('back-to-menu'),
            playAgain: document.getElementById('play-again-btn'),
            backToMain: document.getElementById('back-to-main-btn')
        };

        // 模式和设置元素
        this.modeButtons = {
            pvp: document.getElementById('pvp-mode'),
            pve: document.getElementById('pve-mode')
        };

        this.difficultyButtons = document.querySelectorAll('.difficulty-btn');
        this.scoreButtons = document.querySelectorAll('.score-btn');

        // 输入元素
        this.inputs = {
            blackPlayer: document.getElementById('black-player'),
            whitePlayer: document.getElementById('white-player'),
            customScore: document.getElementById('custom-score-input')
        };

        // 模态框元素
        this.modals = {
            menu: document.getElementById('menu-modal'),
            gameOver: document.getElementById('game-over-modal'),
            settings: document.getElementById('settings-modal'),
            about: document.getElementById('about-modal')
        };

        // 游戏信息元素
        this.gameInfo = {
            blackName: document.getElementById('black-name'),
            whiteName: document.getElementById('white-name'),
            blackScore: document.getElementById('black-score'),
            whiteScore: document.getElementById('white-score'),
            blackIndicator: document.getElementById('black-indicator'),
            whiteIndicator: document.getElementById('white-indicator'),
            targetScore: document.getElementById('target-score-display'),
            currentTurn: document.getElementById('current-turn-display')
        };
    }

    bindEvents() {
        // 欢迎页面按钮
        this.buttons.startGame.addEventListener('click', () => {
            this.showScreen('setup');
        });

        // 设置页面按钮
        this.buttons.backToWelcome.addEventListener('click', () => {
            this.showScreen('welcome');
        });

        this.buttons.startMatch.addEventListener('click', () => {
            this.startGame();
        });

        // 模式选择
        this.modeButtons.pvp.addEventListener('click', () => {
            this.selectMode('pvp');
        });

        this.modeButtons.pve.addEventListener('click', () => {
            this.selectMode('pve');
        });

        // 难度选择
        this.difficultyButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectDifficulty(e.target.dataset.level);
            });
        });

        // 分数选择
        this.scoreButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectScore(e.target.dataset.score);
            });
        });

        // 自定义分数
        this.inputs.customScore.addEventListener('input', (e) => {
            this.selectCustomScore(e.target.value);
        });

        // 游戏控制按钮
        this.buttons.undo.addEventListener('click', () => {
            this.undoMove();
        });

        this.buttons.pass.addEventListener('click', () => {
            this.passMove();
        });

        this.buttons.resign.addEventListener('click', () => {
            this.resignGame();
        });

        this.buttons.menu.addEventListener('click', () => {
            this.showModal('menu');
        });

        // 模态框按钮
        this.buttons.viewLeaderboard.addEventListener('click', () => {
            this.hideAllModals();
            this.showScreen('leaderboard');
            this.updateLeaderboard();
        });

        this.buttons.clearData.addEventListener('click', () => {
            this.clearAllData();
        });

        this.buttons.backToMenu.addEventListener('click', () => {
            this.showScreen('welcome');
        });

        this.buttons.playAgain.addEventListener('click', () => {
            this.hideModal('gameOver');
            this.showScreen('setup');
        });

        this.buttons.backToMain.addEventListener('click', () => {
            this.hideModal('gameOver');
            this.showScreen('welcome');
        });

        // 模态框关闭按钮
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.hideModal(modal.id.replace('-modal', ''));
            });
        });

        // 点击模态框外部关闭
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal.id.replace('-modal', ''));
                }
            });
        });

        // 设置按钮
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.hideModal('menu');
            this.showModal('settings');
        });

        document.getElementById('about-btn').addEventListener('click', () => {
            this.hideModal('menu');
            this.showModal('about');
        });

        document.getElementById('new-game-btn').addEventListener('click', () => {
            this.hideModal('menu');
            this.showScreen('setup');
        });

        // 排行榜标签页
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchLeaderboardTab(e.target.dataset.tab);
            });
        });

        // 设置开关
        document.querySelectorAll('.switch input').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                this.updateSetting(e.target.id.replace('-toggle', ''), e.target.checked);
            });
        });
    }

    initializeCanvas() {
        this.canvas = document.getElementById('go-board');
        this.ctx = this.canvas.getContext('2d');

        // 计算合适的格子大小
        this.updateCanvasSize();

        // 绑定画布事件
        this.canvas.addEventListener('click', (e) => {
            this.handleCanvasClick(e);
        });

        this.canvas.addEventListener('mousemove', (e) => {
            this.handleCanvasMouseMove(e);
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredPosition = null;
            this.drawBoard();
        });

        // 响应窗口大小变化
        window.addEventListener('resize', () => {
            this.updateCanvasSize();
            this.drawBoard();
        });
    }

    updateCanvasSize() {
        const container = this.canvas.parentElement;
        const maxSize = Math.min(container.clientWidth - 40, container.clientHeight - 40);

        this.canvas.width = maxSize;
        this.canvas.height = maxSize;

        const boardSize = this.canvas.width - 2 * this.boardPadding;
        this.cellSize = boardSize / (19 - 1);
    }

    // 屏幕切换
    showScreen(screenName) {
        // 隐藏所有屏幕
        Object.values(this.screens).forEach(screen => {
            screen.classList.remove('active');
        });

        // 显示目标屏幕
        this.screens[screenName].classList.add('active');
        this.currentScreen = screenName;

        // 如果切换到游戏页面，绘制棋盘
        if (screenName === 'game') {
            this.drawBoard();
        }
    }

    showModal(modalName) {
        this.modals[modalName].classList.add('active');
    }

    hideModal(modalName) {
        this.modals[modalName].classList.remove('active');
    }

    hideAllModals() {
        Object.values(this.modals).forEach(modal => {
            modal.classList.remove('active');
        });
    }

    // 模式选择
    selectMode(mode) {
        // 更新按钮状态
        Object.values(this.modeButtons).forEach(btn => {
            btn.classList.remove('active');
        });
        this.modeButtons[mode].classList.add('active');

        // 显示/隐藏难度选择
        const difficultySection = document.getElementById('difficulty-section');
        const whitePlayerSection = document.getElementById('white-player-section');

        if (mode === 'pve') {
            difficultySection.style.display = 'block';
            whitePlayerSection.style.display = 'none';
            this.inputs.whitePlayer.value = '电脑';
        } else {
            difficultySection.style.display = 'none';
            whitePlayerSection.style.display = 'block';
        }
    }

    // 难度选择
    selectDifficulty(level) {
        this.difficultyButtons.forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-level="${level}"]`).classList.add('active');
    }

    // 分数选择
    selectScore(score) {
        this.scoreButtons.forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-score="${score}"]`).classList.add('active');
        this.inputs.customScore.value = '';
    }

    selectCustomScore(score) {
        this.scoreButtons.forEach(btn => {
            btn.classList.remove('active');
        });
    }

    // 开始游戏
    startGame() {
        // 获取游戏设置
        const mode = document.querySelector('.mode-btn.active').dataset.mode;
        const difficulty = mode === 'pve' ?
            document.querySelector('.difficulty-btn.active').dataset.level : 'medium';

        let targetScore;
        const activeScoreBtn = document.querySelector('.score-btn.active');
        if (activeScoreBtn) {
            targetScore = parseInt(activeScoreBtn.dataset.score);
        } else {
            targetScore = parseInt(this.inputs.customScore.value) || 20;
        }

        const blackName = this.inputs.blackPlayer.value || '黑方';
        const whiteName = this.inputs.whitePlayer.value || '白方';

        // 初始化游戏
        this.game = new GoGame();
        this.game.gameMode = mode;
        this.game.aiDifficulty = difficulty;
        this.game.targetScore = targetScore;
        this.game.players.black.name = blackName;
        this.game.players.white.name = whiteName;

        // 初始化AI
        if (mode === 'pve') {
            this.ai = new GoAI(difficulty);
        }

        // 更新UI
        this.updateGameInfo();
        this.showScreen('game');
        this.drawBoard();
    }

    // 更新游戏信息
    updateGameInfo() {
        if (!this.game) return;

        this.gameInfo.blackName.textContent = this.game.players.black.name;
        this.gameInfo.whiteName.textContent = this.game.players.white.name;

        // 计算并显示实时得分（基于提子数，游戏中不显示贴目）
        const currentScores = this.game.calculateScore(false, false); // 不计算领地，不加贴目
        this.gameInfo.blackScore.textContent = currentScores.black.toFixed(1);
        this.gameInfo.whiteScore.textContent = currentScores.white.toFixed(1);

        // 如果是在游戏结束状态，显示包含贴目的得分
        if (this.game.gameOver || this.game.consecutivePasses >= 2) {
            const finalScores = this.game.calculateScore(true, true); // 计算领地，加贴目
            this.gameInfo.blackScore.textContent = finalScores.black.toFixed(1);
            this.gameInfo.whiteScore.textContent = finalScores.white.toFixed(1);
        }

        this.gameInfo.targetScore.textContent = this.game.targetScore;
        this.gameInfo.currentTurn.textContent =
            this.game.currentPlayer === 'black' ?
            this.game.players.black.name : this.game.players.white.name;

        // 控制贴目信息的显示
        const komiInfo = document.getElementById('komi-info');
        if (this.game.gameOver || this.game.consecutivePasses >= 2) {
            komiInfo.style.display = 'block';
        } else {
            komiInfo.style.display = 'none';
        }

        // 更新当前玩家指示器
        const blackCard = document.querySelector('.black-player');
        const whiteCard = document.querySelector('.white-player');

        if (this.game.currentPlayer === 'black') {
            blackCard.classList.add('active');
            whiteCard.classList.remove('active');
            this.gameInfo.blackIndicator.classList.add('active');
            this.gameInfo.whiteIndicator.classList.remove('active');
        } else {
            blackCard.classList.remove('active');
            whiteCard.classList.add('active');
            this.gameInfo.blackIndicator.classList.remove('active');
            this.gameInfo.whiteIndicator.classList.add('active');
        }
    }

    // 绘制棋盘
    drawBoard() {
        if (!this.canvas || !this.ctx) return;

        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // 清空画布
        ctx.clearRect(0, 0, width, height);

        // 绘制棋盘背景
        ctx.fillStyle = '#deb887';
        ctx.fillRect(0, 0, width, height);

        // 绘制网格线
        ctx.strokeStyle = '#8b7355';
        ctx.lineWidth = 1;

        for (let i = 0; i < 19; i++) {
            const pos = this.boardPadding + i * this.cellSize;

            // 横线
            ctx.beginPath();
            ctx.moveTo(this.boardPadding, pos);
            ctx.lineTo(width - this.boardPadding, pos);
            ctx.stroke();

            // 竖线
            ctx.beginPath();
            ctx.moveTo(pos, this.boardPadding);
            ctx.lineTo(pos, height - this.boardPadding);
            ctx.stroke();
        }

        // 绘制星位
        const starPoints = [
            [3, 3], [3, 9], [3, 15],
            [9, 3], [9, 9], [9, 15],
            [15, 3], [15, 9], [15, 15]
        ];

        ctx.fillStyle = '#8b7355';
        for (const [row, col] of starPoints) {
            const x = this.boardPadding + col * this.cellSize;
            const y = this.boardPadding + row * this.cellSize;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // 绘制坐标（如果启用）
        if (this.dataManager.getSettings().coordinates) {
            this.drawCoordinates();
        }

        // 绘制棋子
        if (this.game) {
            this.drawStones();
        }

        // 绘制悬停指示器
        if (this.hoveredPosition && this.game && !this.game.gameOver) {
            this.drawHoverIndicator();
        }
    }

    drawCoordinates() {
        const ctx = this.ctx;
        ctx.fillStyle = '#666';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const letters = 'ABCDEFGHJKLMNOPQRST';

        // 顶部字母
        for (let i = 0; i < 19; i++) {
            const x = this.boardPadding + i * this.cellSize;
            ctx.fillText(letters[i], x, this.boardPadding - 10);
        }

        // 左侧数字
        for (let i = 0; i < 19; i++) {
            const y = this.boardPadding + i * this.cellSize;
            ctx.fillText((19 - i).toString(), this.boardPadding - 10, y);
        }
    }

    drawStones() {
        const ctx = this.ctx;

        for (let row = 0; row < 19; row++) {
            for (let col = 0; col < 19; col++) {
                const stone = this.game.board[row][col];
                if (stone) {
                    const x = this.boardPadding + col * this.cellSize;
                    const y = this.boardPadding + row * this.cellSize;

                    // 绘制棋子阴影
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
                    ctx.shadowBlur = 4;
                    ctx.shadowOffsetX = 2;
                    ctx.shadowOffsetY = 2;

                    // 绘制棋子
                    ctx.beginPath();
                    ctx.arc(x, y, this.cellSize * 0.4, 0, Math.PI * 2);

                    if (stone === 'black') {
                        const gradient = ctx.createRadialGradient(x - 5, y - 5, 0, x, y, this.cellSize * 0.4);
                        gradient.addColorStop(0, '#444');
                        gradient.addColorStop(1, '#000');
                        ctx.fillStyle = gradient;
                    } else {
                        const gradient = ctx.createRadialGradient(x - 5, y - 5, 0, x, y, this.cellSize * 0.4);
                        gradient.addColorStop(0, '#fff');
                        gradient.addColorStop(1, '#ddd');
                        ctx.fillStyle = gradient;
                    }

                    ctx.fill();

                    // 重置阴影
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;

                    // 绘制棋子边框
                    ctx.strokeStyle = stone === 'black' ? '#000' : '#999';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }

        // 标记最后一手
        if (this.game.lastMove && !this.game.lastMove.pass) {
            const x = this.boardPadding + this.game.lastMove.col * this.cellSize;
            const y = this.boardPadding + this.game.lastMove.row * this.cellSize;

            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, this.cellSize * 0.2, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    drawHoverIndicator() {
        if (!this.hoveredPosition || !this.game) return;

        const { row, col } = this.hoveredPosition;
        if (!this.game.isValidMove(row, col)) return;

        const ctx = this.ctx;
        const x = this.boardPadding + col * this.cellSize;
        const y = this.boardPadding + row * this.cellSize;

        ctx.fillStyle = this.game.currentPlayer === 'black' ?
            'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(x, y, this.cellSize * 0.35, 0, Math.PI * 2);
        ctx.fill();
    }

    handleCanvasClick(event) {
        if (!this.game || this.game.gameOver) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // 转换为棋盘坐标
        const col = Math.round((x - this.boardPadding) / this.cellSize);
        const row = Math.round((y - this.boardPadding) / this.cellSize);

        if (row >= 0 && row < 19 && col >= 0 && col < 19) {
            const result = this.game.placeStone(row, col);
            if (result.success) {
                this.drawBoard();
                this.updateGameInfo();

                // 播放音效
                if (this.dataManager.getSettings().sound) {
                    if (result.captured.length > 0) {
                        this.playSound('capture'); // 吃子音效
                        console.log(`吃掉了 ${result.captured.length} 个棋子！`);
                    } else {
                        this.playSound('placeStone'); // 普通落子音效
                    }
                }

                // 如果有吃子，提供振动反馈
                if (result.captured.length > 0 && this.dataManager.getSettings().vibration) {
                    this.vibrate();
                }

                // 检查游戏结束
                this.checkGameEnd();

                // AI移动
                if (this.game.gameMode === 'pve' &&
                    this.game.currentPlayer === 'white' &&
                    !this.game.gameOver) {
                    setTimeout(() => {
                        this.makeAIMove();
                    }, 500);
                }
            }
        }
    }

    handleCanvasMouseMove(event) {
        if (!this.game || this.game.gameOver) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // 转换为棋盘坐标
        const col = Math.round((x - this.boardPadding) / this.cellSize);
        const row = Math.round((y - this.boardPadding) / this.cellSize);

        if (row >= 0 && row < 19 && col >= 0 && col < 19) {
            this.hoveredPosition = { row, col };
            this.drawBoard();
        }
    }

    makeAIMove() {
        if (!this.game || !this.ai || this.game.gameOver) return;

        // 显示AI思考提示
        this.showAIThinking();

        // 使用异步方式让UI有时间更新
        setTimeout(() => {
            const move = this.ai.getNextMove(this.game);

            // 隐藏AI思考提示
            this.hideAIThinking();

            if (move) {
                const result = this.game.placeStone(move.row, move.col);
                if (result.success) {
                    this.drawBoard();
                    this.updateGameInfo();

                    // 播放音效
                    if (this.dataManager.getSettings().sound) {
                        if (result.captured.length > 0) {
                            this.playSound('capture'); // 吃子音效
                            console.log(`AI吃掉了 ${result.captured.length} 个棋子！`);
                        } else {
                            this.playSound('placeStone'); // 普通落子音效
                        }
                    }

                    // 检查游戏结束
                    this.checkGameEnd();
                }
            } else {
                // AI没有有效移动，选择pass
                this.game.pass();
                this.updateGameInfo();
                this.checkGameEnd();
            }
        }, 100); // 短暂延迟让UI更新
    }

    // 显示AI思考提示
    showAIThinking() {
        const thinkingDiv = document.getElementById('ai-thinking');
        const timeSpan = document.getElementById('thinking-time');
        const progressFill = document.getElementById('progress-fill');

        thinkingDiv.style.display = 'block';

        // 重置计时器和进度
        let startTime = Date.now();
        let elapsedTime = 0;

        // 更新思考时间
        this.thinkingTimer = setInterval(() => {
            elapsedTime = Math.floor((Date.now() - startTime) / 1000);
            timeSpan.textContent = elapsedTime;

            // 更新进度条（基于最大思考时间）
            const maxTime = this.ai.maxTime / 1000; // 转换为秒
            const progress = Math.min((elapsedTime / maxTime) * 100, 100);
            progressFill.style.width = progress + '%';
        }, 100);
    }

    // 隐藏AI思考提示
    hideAIThinking() {
        const thinkingDiv = document.getElementById('ai-thinking');

        if (this.thinkingTimer) {
            clearInterval(this.thinkingTimer);
            this.thinkingTimer = null;
        }

        thinkingDiv.style.display = 'none';

        // 重置进度条
        const progressFill = document.getElementById('progress-fill');
        const timeSpan = document.getElementById('thinking-time');
        progressFill.style.width = '0%';
        timeSpan.textContent = '0';
    }

    undoMove() {
        if (!this.game || this.game.gameOver) return;

        if (this.game.undo()) {
            this.drawBoard();
            this.updateGameInfo();

            // 如果是人机模式，需要撤销两步
            if (this.game.gameMode === 'pve' &&
                this.game.currentPlayer === 'black') {
                this.game.undo();
                this.drawBoard();
                this.updateGameInfo();
            }
        }
    }

    passMove() {
        if (!this.game || this.game.gameOver) return;

        this.game.pass();
        this.updateGameInfo();
        this.drawBoard();
        this.checkGameEnd();
    }

    resignGame() {
        if (!this.game || this.game.gameOver) return;

        const resigningPlayer = this.game.currentPlayer;
        const result = this.game.resign(resigningPlayer);

        this.endGame(result, `${this.game.players[resigningPlayer].name} 认输`);
    }

    checkGameEnd() {
        if (!this.game || this.game.gameOver) return;

        // 检查游戏结束的条件：
        // 1. 达到目标分数
        // 2. 双方连续pass
        // 3. 棋盘填充率超过80%
        const boardFilled = this.game.calculateBoardFillPercentage();

        // 首先检查是否达到目标分数（基于当前提子得分，不计算领地）
        const currentScores = this.game.calculateScore(false, false);
        const blackReachedTarget = currentScores.black >= this.game.targetScore;
        const whiteReachedTarget = currentScores.white >= this.game.targetScore;

        if (blackReachedTarget || whiteReachedTarget) {
            // 达到目标分数，游戏结束
            const winner = blackReachedTarget ? 'black' : 'white';
            const winnerName = this.game.players[winner].name;
            const finalScores = this.game.calculateScore(true, true); // 计算最终得分

            // 标记游戏结束
            this.game.gameOver = true;
            this.game.players.black.score = finalScores.black;
            this.game.players.white.score = finalScores.white;

            const result = {
                winner,
                scores: finalScores,
                targetReached: true,
                finalWinner: winner
            };

            const message = `${winnerName} 达到目标分数 ${this.game.targetScore} 分，游戏结束！`;
            this.endGame(result, message);
            return;
        }

        // 检查其他结束条件
        const shouldCheckEnd = this.game.consecutivePasses >= 2 || boardFilled > 0.8;
        if (!shouldCheckEnd) return;

        // 计算得分，在游戏结束时计算领地和贴目
        const scores = this.game.calculateScore(true, true);
        let message = '';
        let winner = null;

        if (this.game.consecutivePasses >= 2) {
            // 双方连续pass，正常游戏结束
            winner = scores.black > scores.white ? 'black' : 'white';
            const winnerName = this.game.players[winner].name;
            message = `游戏结束，${winnerName} 获胜`;
        } else {
            // 棋盘满了，游戏结束
            winner = scores.black > scores.white ? 'black' : 'white';
            const winnerName = this.game.players[winner].name;
            message = `棋盘已满，${winnerName} 获胜`;
        }

        // 检查是否达到目标分数
        const winningScore = Math.max(scores.black, scores.white);
        const targetReached = winningScore >= this.game.targetScore;

        // 手动标记游戏结束并更新分数
        this.game.gameOver = true;
        this.game.players.black.score = scores.black;
        this.game.players.white.score = scores.white;

        const result = {
            winner,
            scores,
            targetReached,
            finalWinner: winner
        };

        this.endGame(result, message);
    }

    endGame(result, message) {
        if (!result || !this.game) return;

        // 更新玩家分数
        const winnerName = this.game.players[result.finalWinner || result.winner].name;
        const loserName = this.game.players[result.finalWinner === 'black' ? 'white' : 'black'].name;

        const winnerScoreChange = this.calculateScoreChange(true, result);
        const loserScoreChange = this.calculateScoreChange(false, result);

        this.dataManager.updatePlayerScore(winnerName, winnerScoreChange, true);
        this.dataManager.updatePlayerScore(loserName, loserScoreChange, false);

        // 显示游戏结束弹窗
        this.showGameOverModal(result, message, winnerScoreChange, loserScoreChange);
    }

    calculateScoreChange(isWin, result) {
        let baseScore = 10;

        if (isWin) {
            // 根据对手难度调整
            if (this.game && this.game.gameMode === 'pve') {
                switch (this.game.aiDifficulty) {
                    case 'easy': baseScore = 5; break;
                    case 'medium': baseScore = 10; break;
                    case 'hard': baseScore = 20; break;
                }
            }

            // 根据胜利条件调整
            if (this.game && this.game.targetScore > 20) {
                baseScore = Math.floor(baseScore * (this.game.targetScore / 20));
            }
        } else {
            baseScore = -2; // 失败扣除少量分数
        }

        return baseScore;
    }

    showGameOverModal(result, message, winnerScoreChange, loserScoreChange) {
        const modal = this.modals.gameOver;
        const title = document.getElementById('game-over-title');
        const resultDiv = document.getElementById('game-over-result');
        const finalScoresDiv = document.getElementById('final-scores');
        const scoreChangeDiv = document.getElementById('score-change');

        title.textContent = '游戏结束';

        // 显示结果
        resultDiv.innerHTML = `
            <div class="result-title">${message}</div>
            <div class="result-message">最终比分</div>
        `;

        // 显示最终得分
        const blackFinal = this.game.players.black.score;
        const whiteFinal = this.game.players.white.score;
        finalScoresDiv.innerHTML = `
            <div class="score-row">
                <span>${this.game.players.black.name}（黑）</span>
                <span>${blackFinal.toFixed(1)} 目</span>
            </div>
            <div class="score-row">
                <span>${this.game.players.white.name}（白）</span>
                <span>${whiteFinal.toFixed(1)} 目</span>
            </div>
        `;

        // 显示分数变化
        scoreChangeDiv.innerHTML = `
            <div class="score-change positive">
                ${this.game.players.black.name} ${winnerScoreChange > 0 ? '+' : ''}${winnerScoreChange} 分
            </div>
            <div class="score-change ${loserScoreChange > 0 ? 'positive' : 'negative'}">
                ${this.game.players.white.name} ${loserScoreChange > 0 ? '+' : ''}${loserScoreChange} 分
            </div>
        `;

        this.showModal('gameOver');
    }

    updateLeaderboard() {
        const leaderboard = this.dataManager.getLeaderboard('score');
        const listContainer = document.getElementById('leaderboard-list');
        const emptyState = document.getElementById('empty-leaderboard');

        if (leaderboard.length === 0) {
            listContainer.style.display = 'none';
            emptyState.style.display = 'block';
        } else {
            listContainer.style.display = 'block';
            emptyState.style.display = 'none';

            let html = '';
            leaderboard.slice(0, 20).forEach((player, index) => {
                const rank = index + 1;
                const rankClass = rank <= 3 ? `rank-${rank}` : '';
                const winRate = player.wins + player.losses > 0 ?
                    ((player.wins / (player.wins + player.losses)) * 100).toFixed(1) : 0;

                html += `
                    <div class="leaderboard-item">
                        <div class="leaderboard-rank ${rankClass}">${rank}</div>
                        <div class="leaderboard-player">
                            <div class="leaderboard-name">${player.name}</div>
                            <div class="leaderboard-stats">
                                胜率: ${winRate}% | 胜场: ${player.wins} | 连胜: ${player.winStreak}
                            </div>
                        </div>
                        <div class="leaderboard-score">${player.score}</div>
                    </div>
                `;
            });

            listContainer.innerHTML = html;
        }
    }

    switchLeaderboardTab(tab) {
        // 更新标签页状态
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

        // 更新排行榜内容
        this.updateLeaderboard();
    }

    clearAllData() {
        if (confirm('确定要清空所有游戏数据吗？此操作不可恢复。')) {
            this.dataManager.clearAllData();
            this.updateLeaderboard();
            alert('数据已清空');
        }
    }

    updateSetting(setting, value) {
        this.dataManager.updateSettings({ [setting]: value });
    }

    playSound(soundType) {
        // 这里可以添加音效播放逻辑
        // 由于是纯前端实现，暂时使用 Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // 根据音效类型设置不同参数
            switch (soundType) {
                case 'placeStone':
                    oscillator.frequency.value = 800;
                    gainNode.gain.value = 0.1;
                    oscillator.type = 'sine';
                    break;
                case 'capture':
                    oscillator.frequency.value = 1200;
                    gainNode.gain.value = 0.15;
                    oscillator.type = 'square';
                    break;
                case 'gameEnd':
                    oscillator.frequency.value = 600;
                    gainNode.gain.value = 0.2;
                    oscillator.type = 'triangle';
                    break;
            }

            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (error) {
            // 忽略音频错误
        }
    }

    vibrate() {
        if (this.dataManager.getSettings().vibration &&
            'vibrate' in navigator) {
            navigator.vibrate(50);
        }
    }
}

// 应用初始化
document.addEventListener('DOMContentLoaded', () => {
    const app = new UIManager();

    // 显示加载动画
    const loadingOverlay = document.getElementById('loading-overlay');
    setTimeout(() => {
        loadingOverlay.classList.remove('active');
    }, 1000);

    // 防止页面缩放
    document.addEventListener('gesturestart', (e) => {
        e.preventDefault();
    });

    // 防止双击缩放
    document.addEventListener('dblclick', (e) => {
        e.preventDefault();
    });

    console.log('网页版围棋已启动');

// 添加调试功能
window.debugGame = function() {
    if (!app.game) {
        console.log('游戏尚未开始');
        return;
    }

    const boardFilled = app.game.calculateBoardFillPercentage();
    const consecutivePasses = app.game.consecutivePasses;
    const gameOver = app.game.gameOver;
    const scores = app.game.calculateScore(); // 计算当前得分

    console.log('=== 游戏状态调试 ===');
    console.log('棋盘填充率:', (boardFilled * 100).toFixed(1) + '%');
    console.log('连续pass次数:', consecutivePasses);
    console.log('游戏是否结束:', gameOver);
    console.log('当前玩家:', app.game.currentPlayer);
    console.log('黑方提子:', app.game.prisoners.white);
    console.log('白方提子:', app.game.prisoners.black);
    const gameScore = app.game.calculateScore(false, false); // 游戏中得分（无贴目）
const finalScore = app.game.calculateScore(true, true); // 最终得分（有贴目）
console.log('当前得分（无贴目） - 黑方:', gameScore.black.toFixed(1), '白方:', gameScore.white.toFixed(1));
if (app.game.gameOver || app.game.consecutivePasses >= 2) {
    console.log('最终得分（含贴目） - 黑方:', finalScore.black.toFixed(1), '白方:', finalScore.white.toFixed(1));
}

console.log('目标分数:', app.game.targetScore);
console.log('黑方是否达到目标:', gameScore.black >= app.game.targetScore ? '✅' : '❌');
console.log('白方是否达到目标:', gameScore.white >= app.game.targetScore ? '✅' : '❌');

    // 检查游戏结束条件
    if (gameScore.black >= app.game.targetScore || gameScore.white >= app.game.targetScore) {
        console.log('🎯 达到目标分数，游戏应该结束！');
    } else if (consecutivePasses >= 2) {
        console.log('⚠️ 双方连续pass，应该检查游戏结束');
    } else if (boardFilled > 0.8) {
        console.log('⚠️ 棋盘接近满了，应该检查游戏结束');
    } else {
        console.log('✅ 游戏进行中，继续下棋');
    }
};

// 添加强制结束游戏的功能（用于测试）
window.forceEndGame = function() {
    if (!app.game) {
        console.log('游戏尚未开始');
        return;
    }

    app.game.consecutivePasses = 2;
    app.checkGameEnd();
    console.log('已强制设置连续pass，触发游戏结束检查');
};

// 添加快速达到目标分数的功能（用于测试）
window.setTargetScore = function(score) {
    if (!app.game) {
        console.log('游戏尚未开始');
        return;
    }

    // 设置足够的提子数来达到目标分数
    app.game.prisoners.white = score;
    app.checkGameEnd();
    console.log(`已设置黑方提子数为 ${score}，检查是否达到目标分数 ${app.game.targetScore}`);
};

console.log('调试功能已添加：');
console.log('- debugGame() - 查看游戏状态');
console.log('- forceEndGame() - 强制结束游戏');
console.log('- setTargetScore(score) - 设置提子数测试目标分数');
});