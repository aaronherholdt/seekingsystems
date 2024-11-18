// Connect to the backend server
const socket = io("https://seekingsystems-backend.onrender.com"); // Replace with your backend URL

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

// Update game size on window resize to maintain responsiveness
window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});

let score = 0;
let gameTime = 0;
let resilienceTimer = 0;
let isGameActive = false;
let gameStarted = false;
let players = [];
let nodes = [];
let connections = [];
let selectedNode = null;
let lastInteractionTime = 0;
let minNodeThreshold = 5;
let winConditionTime = 300;
let comboCounter = 0;
let comboMultiplier = 1;

function preload() {
    // Optional: Load any assets here
}

function showTutorial() {
    let tutorialText = this.add.text(100, 200, 'Welcome! Connect the nodes to build a strong network. Keep it resilient for 5 minutes to win!', {
        fontSize: '18px',
        fill: '#fff',
        backgroundColor: '#000',
        padding: { x: 10, y: 10 }
    });
    
    let startButton = this.add.text(100, 300, 'Start', {
        fontSize: '24px',
        fill: '#0f0'
    }).setInteractive();
    
    startButton.on('pointerdown', () => {
        tutorialText.destroy();
        startButton.destroy();
        gameStarted = true; // Set the flag to true when the button is clicked
        isGameActive = true; // Start the game logic
        startTimers.call(this); // Call the function to start the timers
    });
}

// Function to start the score decay
function startScoreDecay() {
    this.time.addEvent({
        delay: 5000,
        callback: () => {
            if (isGameActive && score > 0) {
                score -= 1;
                this.scoreText.setText('Score: ' + score);
            }
        },
        callbackScope: this,
        loop: true
    });
}

function startTimers() {
    // Set up a timer that updates the game time every second
    this.time.addEvent({
        delay: 1000, // 1 second in milliseconds
        callback: () => {
            if (isGameActive) {
                gameTime++;
                this.children.list.forEach(child => {
                    if (child.text && child.text.startsWith('Time:')) {
                        child.setText('Time: ' + gameTime + 's');
                    }
                });

                // Track resilience time if the node count is above the threshold
                if (this.nodes.length >= minNodeThreshold) {
                    resilienceTimer++;
                    this.children.list.forEach(child => {
                        if (child.text && child.text.startsWith('Resilience:')) {
                            child.setText('Resilience: ' + resilienceTimer + 's');
                        }
                    });
                } else {
                    resilienceTimer = 0; // Reset if the node count falls below the threshold
                }

                // Check if the player wins
                if (resilienceTimer >= winConditionTime) {
                    isGameActive = false;
                    this.add.text(400, 400, 'Congratulations! You maintained a resilient network!', { fontSize: '24px', fill: '#0f0' });
                }

                // Deduct points for inactivity if no interaction for 10 seconds
                if (gameTime - lastInteractionTime >= 10 && score > 0) {
                    score -= 5; // Penalty for inactivity
                    this.scoreText.setText('Score: ' + score);
                }
            }
        },
        callbackScope: this,
        loop: true
    });

    // Set up a timer that dissolves a random node every 15 seconds after 1 minute
    this.time.addEvent({
        delay: 60000, // Delay of 1 minute (60000 ms)
        callback: () => {
            this.time.addEvent({
                delay: 15000, // 15 seconds in milliseconds
                callback: () => {
                    dissolveRandomNode.call(this);
                },
                callbackScope: this,
                loop: true
            });
        },
        callbackScope: this
    });

    startScoreDecay.call(this);
}


function dissolveRandomNode() {
    if (this.nodes.length > 0) {
        const randomNode = this.nodes[Math.floor(Math.random() * this.nodes.length)];
        removeNode.call(this, randomNode);
    }
}

// Function to remove a node and its connections
function removeNode(node) {
    if (this.nodes.includes(node)) {
        score -= 20; // Deduct points for removing a node
        this.scoreText.setText('Score: ' + score);

        // Collect all lines connected to the node
        let linesToRemove = this.children.list.filter(child => 
            child.type === 'Line' && 
            (child.geom.x1 === node.x && child.geom.y1 === node.y || 
             child.geom.x2 === node.x && child.geom.y2 === node.y)
        );

        // Remove all found lines and deduct score for each
        linesToRemove.forEach(line => {
            line.destroy(); // Remove the line
            score -= 10; // Deduct points for each line removed (adjust as needed)
        });
        this.scoreText.setText('Score: ' + score);

        // Remove connections from the adjacency list
        let nodeId = node.id;
        if (this.connections[nodeId]) {
            this.connections[nodeId].forEach(connectedId => {
                if (this.connections[connectedId]) {
                    this.connections[connectedId] = this.connections[connectedId].filter(id => id !== nodeId);
                }
            });
            delete this.connections[nodeId];
        }

        // Remove the node visually
        node.destroy();

        // Remove the node from the nodes array
        this.nodes = this.nodes.filter(n => n.id !== nodeId);
    }
}

function create() {
    // Initialize the adjacency list for connections
    this.connections = {}; 

    showTutorial.call(this); // Call the tutorial when the game starts

    this.nodes = [];
    this.scoreText = this.add.text(10, 10, 'Score: 0', { fontSize: '16px', fill: '#fff' }); // Make scoreText a property of `this`
    let timerText = this.add.text(10, 30, 'Time: 0s', { fontSize: '16px', fill: '#fff' }); // Timer display
    let resilienceProgress = this.add.text(10, 50, 'Resilience: 0s', { fontSize: '16px', fill: '#fff' });
    let selectedNode = null;

    // Create a text element for displaying player names
    let playerListText = this.add.text(10, 70, 'Players:', { fontSize: '16px', fill: '#fff' });

    /// Function to update the player list UI
    function updatePlayersUI() {
        const playerListContent = players
            .map((player, index) => `Player ${index + 1}: ${player.name}`)
            .join('\n'); // Format player names
        playerListText.setText(`Players:\n${playerListContent}`); // Update the text element
    }

    // Listen for player list updates from the server
    socket.on("playerList", (updatedPlayers) => {
        players = updatedPlayers; // Update the players array from the server
        updatePlayersUI(); // Refresh the displayed player list
    });

    // Prompt the user to enter their name upon connecting
    socket.on("connect", () => {
        console.log(`Connected to the server with ID: ${socket.id}`);

        const playerName = prompt("Enter your name:") || "Anonymous"; // Prompt player for their name
        socket.emit("newPlayer", { id: socket.id, name: playerName }); // Send the player's name to the server
    });

    // Handle player disconnection
    socket.on("playerDisconnected", (playerId) => {
        players = players.filter(player => player.id !== playerId); // Remove the disconnected player
        updatePlayersUI(); // Refresh the displayed player list
    });

    // Initial player list update
    updatePlayersUI();

    const legend = this.add.container(1000, 20); // Adjust position to top right
    // Set base font sizes depending on screen width
    const baseFontSize = this.scale.width > 1024 ? '16px' : this.scale.width > 768 ? '14px' : '12px';
    const legendFontSize = this.scale.width > 1024 ? '12px' : this.scale.width > 768 ? '10px' : '8px';
    const legendDescriptionFontSize = this.scale.width > 1024 ? '10px' : this.scale.width > 768 ? '8px' : '6px';

    // Reposition legend on screen resize to keep it in the top-right corner
    this.scale.on('resize', (gameSize) => {
        const { width } = gameSize;
        legend.x = width - 220;
    });

    // Node creation and selection logic
    this.input.on("pointerdown", (pointer, gameObjects) => {
        if (!gameStarted) return; // Prevent interactions before the game starts
    
        if (pointer.rightButtonDown()) {
            if (gameObjects.length > 0) {
                const nodeToRemove = gameObjects[0];
                removeNode.call(this, nodeToRemove);
                score -= 20; // Deduct points for removing a node
                this.scoreText.setText("Score: " + score);
                lastInteractionTime = gameTime; // Update last interaction time
            }
        } else {
            if (gameObjects.length > 0) {
                const clickedNode = gameObjects[0];
                if (selectedNode && selectedNode !== clickedNode) {
                    if (!isAlreadyConnected.call(this, selectedNode, clickedNode)) {
                        // Emit the connection creation event to the server
                        socket.emit("createConnection", {
                            node1: selectedNode.id,
                            node2: clickedNode.id,
                        });
    
                        selectedNode = null;
                    }
                } else {
                    selectedNode = clickedNode;
                }
            } else {
                // Create a new node
                let color = getRandomColor();
                let nodeData = {
                    id: this.nodes.length,
                    x: pointer.x,
                    y: pointer.y,
                    color,
                };
    
                // Emit the node creation event to the server
                socket.emit("createNode", nodeData);
            }
        }
    });

    // Main game camera setup for zooming and panning
    this.cameras.main.setZoom(1);

    // Define color associations with smaller font sizes
    const colorAssociations = [
        { color: 0x0000ff, name: 'Blue (Cooperation)', description: 'Strengthens the network' },
        { color: 0x006400, name: 'Green (Growth)', description: 'Supports network resilience' },
        { color: 0xffff00, name: 'Yellow (Innovation)', description: 'Adds creativity but might risk stability' },
        { color: 0xff0000, name: 'Red (Conflict)', description: 'Potentially risky' }
    ];

    // Create visual elements for each color association with smaller sizes
    colorAssociations.forEach((assoc, index) => {
        let colorCircle = scene.add.circle(0, index * 30, 5, assoc.color).setOrigin(0.5, 0.5);
        let colorText = scene.add.text(15, index * 30 - 5, assoc.name, { fontSize: '12px', fill: '#fff' }).setOrigin(0, 0.5);
        let descriptionText = scene.add.text(15, index * 30 + 10, assoc.description, { fontSize: '10px', fill: '#aaa' }).setOrigin(0, 0.5);
        legend.add(colorCircle);
        legend.add(colorText);
        legend.add(descriptionText);
    });

    // Synchronize with server
    socket.on("initializeGame", gameState => {
        gameState.nodes.forEach(nodeData => createNode(scene, nodeData, false));
        gameState.connections.forEach(conn => createConnection(scene, conn, false));
        updatePlayerList(scene, gameState.players);
        score = gameState.scores[socket.id] || 0;
        resilienceTimer = gameState.resilience;
        scene.scoreText.setText(`Score: ${score}`);
    });

    socket.on("nodeCreated", nodeData => createNode(scene, nodeData, false));
    socket.on("connectionCreated", connectionData => createConnection(scene, connectionData, false));
    socket.on("playerList", updatedPlayers => updatePlayerList(scene, updatedPlayers));
    socket.on("updateScores", updatedScores => {
        score = updatedScores[socket.id] || 0;
        scene.scoreText.setText(`Score: ${score}`);
    });

    // Player management
    socket.on("connect", () => {
        const playerName = prompt("Enter your name:") || "Anonymous";
        socket.emit("newPlayer", { id: socket.id, name: playerName });
    });
    socket.on("playerDisconnected", playerId => {
        players = players.filter(player => player.id !== playerId);
        updatePlayerList(scene, players);
    });

    // Handle input
    this.input.on('pointerdown', pointer => {
        if (!gameStarted) return;
        const clickedNode = nodes.find(node => Phaser.Geom.Circle.Contains(node.geom, pointer.x, pointer.y));

        if (clickedNode) {
            if (selectedNode && selectedNode !== clickedNode) {
                const connectionData = { node1: selectedNode.id, node2: clickedNode.id };
                socket.emit("createConnection", connectionData);
                selectedNode = null;
            } else {
                selectedNode = clickedNode;
            }
        } else {
            const newNode = {
                id: nodes.length,
                x: pointer.x,
                y: pointer.y,
                color: getRandomColor()
            };
            socket.emit("createNode", newNode);
        }
    });

    function createNode(scene, nodeData, emit = true) {
        const newNode = scene.add.circle(nodeData.x, nodeData.y, 20, nodeData.color).setInteractive();
        newNode.id = nodeData.id;
        nodes.push(newNode);

        if (emit) socket.emit("createNode", nodeData);
    }

    function isAlreadyConnected(node1, node2) {
        return this.connections[node1.id] && this.connections[node1.id].includes(node2.id);
    }

    function removeNode(scene, node) {
        const nodeIndex = nodes.indexOf(node);
        if (nodeIndex !== -1) {
            nodes.splice(nodeIndex, 1);
            node.destroy();
            score -= 20;
            scene.scoreText.setText(`Score: ${score}`);
        }
    }
    
    // Update the `addConnection` function to use `this.connections`
    function addConnection(node1, node2) {
        if (!this.connections[node1.id]) this.connections[node1.id] = [];
        if (!this.connections[node2.id]) this.connections[node2.id] = [];
        this.connections[node1.id].push(node2.id);
        this.connections[node2.id].push(node1.id);
    }

    function getRandomColor() {
        // Add a special color (e.g., yellow for power-up nodes)
        const colors = [0x006400, 0xff0000, 0x0000ff, 0xffff00]; // Green, Red, Blue, Yellow (Special)
        return colors[Math.floor(Math.random() * colors.length)];
    }

    function checkForLoop(startNode) {
        let visited = new Set();
        let loopNodes = [];
    
        if (dfs(startNode.id, null, visited, loopNodes) && loopNodes.length >= 5) {
            if (areNodesSameColor.call(this, loopNodes)) {
                createBigNode.call(this, loopNodes);
                score += 200; // Bonus score for creating the big node
                this.scoreText.setText('Score: ' + score);
                showAchievementBadge('Big Node Created!');
            }
            return true;
        }
        return false;
    }
    
    function dfs(nodeId, parent, visited, loopNodes) {
        if (visited.has(nodeId)) {
            return true; // Loop detected
        }
        visited.add(nodeId);
        loopNodes.push(nodeId);
        
        for (let neighborId of (this.connections[nodeId] || [])) {
            if (neighborId !== parent && dfs.call(this, neighborId, nodeId, visited, loopNodes)) {
                return true;
            }
        }
        loopNodes.pop();
        return false;
    }
    
    function areNodesSameColor(loopNodes) {
        if (!this.nodes || this.nodes.length === 0) {
            console.error('this.nodes is undefined or empty');
            return false;
        }
    
        const firstNode = this.nodes.find(n => n.id === loopNodes[0]);
        if (!firstNode) return false;
    
        return loopNodes.every(nodeId => {
            let node = this.nodes.find(n => n.id === nodeId);
            return node && node.type === firstNode.type;
        });
    }
    
    
    function handleColorInteraction(node1, node2) {
        if (node1.type === 0xff0000 || node2.type === 0xff0000) {
            // Any connection involving a red node decreases the score
            score -= 10;
    
            // If both nodes are red, trigger the special effect to remove connected nodes and lines
            if (node1.type === 0xff0000 && node2.type === 0xff0000) {
                removeConnectedNodesAndLines.call(this, node1);
                removeConnectedNodesAndLines.call(this, node2);
            }
        } else if ((node1.type === 0x006400 && node2.type === 0x0000ff) || (node1.type === 0x0000ff && node2.type === 0x00ff00)) {
            // Green to Blue or Blue to Green (positive connection)
            score += 15;
        } else if ((node1.type === 0xffff00 && node2.type === 0xff0000) || (node1.type === 0xff0000 && node2.type === 0xffff00)) {
            // Yellow to Red (penalized)
            score -= 10;
        } else if (node1.type === node2.type) {
            // Same color connection
            score += 5;
        } else {
            // Default connection for other cases
            score += 2;
        }
    
        // Update score display
        this.scoreText.setText('Score: ' + score);
    
        // Reset combo counter on penalties
        if (score < 0) {
            comboCounter = 0;
        }
    }

    function removeConnectedNodesAndLines(node) {
        // Collect all lines connected to the node
        let linesToRemove = this.children.list.filter(child =>
            child.type === 'Line' &&
            (child.geom.x1 === node.x && child.geom.y1 === node.y ||
             child.geom.x2 === node.x && child.geom.y2 === node.y)
        );
    
        // Remove all found lines and deduct score for each line removed
        linesToRemove.forEach(line => {
            line.destroy(); // Remove the line
            score -= 10; // Deduct points for each line removed (adjust if necessary)
        });
        this.scoreText.setText('Score: ' + score);
    
        // Remove the node itself and update the node list
        let nodeId = node.id;
        if (this.nodes.includes(node)) {
            this.nodes = this.nodes.filter(n => n.id !== nodeId);
            node.destroy();
        }
    
        // Remove connections from the adjacency list
        if (this.connections[nodeId]) {
            this.connections[nodeId].forEach(connectedId => {
                if (this.connections[connectedId]) {
                    this.connections[connectedId] = this.connections[connectedId].filter(id => id !== nodeId);
                }
            });
            delete this.connections[nodeId];
        }
    }
}

function update() {
    // Any real-time updates can go here
}
