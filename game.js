// Connect to the backend server
const socket = io("https://seekingsystems-backend.onrender.com"); // Ensure this matches your backend setup

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
let resilienceTimer = 0; // Timer to track resilience time
let isGameActive = false; // Change this to ensure the timer doesn't start until the game starts
let winConditionTime = 300; // 300 seconds (5 minutes)
let minNodeThreshold = 5; // Minimum number of nodes required to avoid losing
let gameStarted = false; // New flag to track if the game has started
let lastInteractionTime = 0; // Track the last interaction for score decay
let comboCounter = 0; // Track consecutive successful actions
let comboMultiplier = 1; // Default score multiplier
let players = []; // Global array to track connected players
let isDragging = false; // Track whether a node is being dragged


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
    this.connections = {}; // Initialize adjacency list for connections
    this.nodes = [];
    let selectedNode = null; // Track the selected node for connections

    showTutorial.call(this); // Show the tutorial at the start of the game

    // Add UI elements
    this.scoreText = this.add.text(10, 10, 'Score: 0', { fontSize: '16px', fill: '#fff' });
    let timerText = this.add.text(10, 30, 'Time: 0s', { fontSize: '16px', fill: '#fff' });
    let resilienceProgress = this.add.text(10, 50, 'Resilience: 0s', { fontSize: '16px', fill: '#fff' });

    // Create a text element for displaying player names below the resilience text
    let playerListText = this.add.text(10, 70, 'Players:', { fontSize: '16px', fill: '#fff' });

    // Function to update the player list UI
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

    // Handle node interaction logic
    this.input.on('pointerdown', (pointer, gameObjects) => {
        if (!gameStarted) return; // Prevent interactions before the game starts

        if (pointer.rightButtonDown()) {
            // Right-click to remove nodes
            if (gameObjects.length > 0) {
                const nodeToRemove = gameObjects[0];
                removeNode.call(this, nodeToRemove);
                score -= 20;
                this.scoreText.setText('Score: ' + score);
            }
        } else {
            // Handle node connection or creation
            if (gameObjects.length > 0) {
                const clickedNode = gameObjects[0];

                if (selectedNode && selectedNode !== clickedNode) {
                    // Connect the two nodes if they're not already connected
                    if (!isAlreadyConnected.call(this, selectedNode, clickedNode)) {
                        this.add.line(0, 0, selectedNode.x, selectedNode.y, clickedNode.x, clickedNode.y, 0xffffff).setOrigin(0, 0);
                        addConnection.call(this, selectedNode, clickedNode);
                        handleColorInteraction.call(this, selectedNode, clickedNode);
                        score += 10;
                        this.scoreText.setText('Score: ' + score);
                    }
                    selectedNode = null; // Reset the selected node
                } else {
                    selectedNode = clickedNode; // Select the clicked node
                }
            } else {
                // Create a new node if no existing node is clicked
                const color = getRandomColor();
                const node = this.add.circle(pointer.x, pointer.y, 20, color).setInteractive();
                node.id = this.nodes.length;
                node.type = color;

                // Add hover effects
                node.on('pointerover', () => node.setStrokeStyle(2, 0xffffff));
                node.on('pointerout', () => node.setStrokeStyle(0));

                this.nodes.push(node);
            }
        }
    });

    // Main game camera setup for zooming and panning
    this.cameras.main.setZoom(1);

    const legend = this.add.container(this.scale.width - 220, 20); // Adjust position to top-right corner

    // Define color associations for legend
    const colorAssociations = [
        { color: 0x0000ff, name: 'Blue (Cooperation)', description: 'Strengthens the network' },
        { color: 0x006400, name: 'Green (Growth)', description: 'Supports network resilience' },
        { color: 0xffff00, name: 'Yellow (Innovation)', description: 'Adds creativity but might risk stability' },
        { color: 0xff0000, name: 'Red (Conflict)', description: 'Potentially risky' }
    ];

    // Create legend
    colorAssociations.forEach((assoc, index) => {
        let colorCircle = this.add.circle(0, index * 30, 5, assoc.color).setOrigin(0.5, 0.5);
        let colorText = this.add.text(15, index * 30 - 5, assoc.name, { fontSize: '12px', fill: '#fff' }).setOrigin(0, 0.5);
        let descriptionText = this.add.text(15, index * 30 + 10, assoc.description, { fontSize: '10px', fill: '#aaa' }).setOrigin(0, 0.5);
        legend.add(colorCircle);
        legend.add(colorText);
        legend.add(descriptionText);
    });

    // Reposition legend on screen resize
    this.scale.on('resize', (gameSize) => {
        const { width } = gameSize;
        legend.x = width - 220; // Keep aligned with the right edge
    });

    // Helper functions
    function isAlreadyConnected(node1, node2) {
        return this.connections[node1.id] && this.connections[node1.id].includes(node2.id);
    }

    function addConnection(node1, node2) {
        if (!this.connections[node1.id]) this.connections[node1.id] = [];
        if (!this.connections[node2.id]) this.connections[node2.id] = [];
        this.connections[node1.id].push(node2.id);
        this.connections[node2.id].push(node1.id);
    }

    function getRandomColor() {
        const colors = [0x006400, 0xff0000, 0x0000ff, 0xffff00];
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
