const WebSocket = require('ws');
const data = require('./data');

// TODO:
// - Write out a cookie that saves the user id so if a user disconnects they can come back in with the cards the had before hand
// - Make sure game data display's when a user comes back from a dc or refresh
// - Figure out how to hand 2 white cards for the double black cards
// - Write function that randomly picks cards instead of pulling the first 7 - DONE : Decks shuffle at the start of the game
// - Make it so host can choose decks to play with
// - Make a ready check feature with the start game button
// - Make users add a username

const server = () => {
    const wss = new WebSocket.Server({ port: 8080 });
    const cardData = { ...data };

    // Generates unique ID for every new connection
    const getUniqueID = () => {
        const s4 = () =>
            Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        return s4() + s4() + '-' + s4();
    };

    let users = {};

    const gameCards = {
        blackCards: [],
        whiteCards: [],
    };

    let game = {
        isActive: false,
        playerTurn: '',
        inPlayCards: {
            blackCard: '',
            whiteCards: [],
        },
    };

    /**
     * Updates our game data so we can keep track of the cards currently in play
     * @param {String} playerTurn - Person who is choosing the best white card
     * @param {String} blackCard - Black card that is currently in play
     * @param {Array} whiteCards - White cards that are currently in play
     */
    const updateGame = (playerTurn, blackCard, whiteCards) => {
        game = {
            isActive: true, // Updating the game should always make the game active?
            playerTurn: playerTurn,
            inPlayCards: {
                blackCard: blackCard,
                whiteCards: whiteCards,
            },
        };
    };

    /**
     *  Randomly picks cards from the correct deck, depending on the action passed
     *  - 'getBlackCard' : Single Black Card
     *  - 'startGameWhiteCards' : 7* White Cards to start the game
     *  - 'getWhiteCard' : Single White Card
     * @param {String} action - Action that decides what cards to return
     */
    const getCards = (action) => {
        switch (action) {
            case 'startGameWhiteCards':
                return gameCards.whiteCards.splice(0, 7);
            case 'getBlackCard':
                return gameCards.blackCards.splice(0, 1)[0];
            case 'getWhiteCard':
                return gameCards.whiteCards.splice(0, 1)[0];
            default:
                throw new Error();
        }
    };
    /**
     * Fisher-Yates Shuffle - Randomly shuffles the white and black cards when the game starts
     * @param {*} array
     */
    const shuffleDeck = (array) => {
        let m = array.length,
            t,
            i;

        // While there remain elements to shuffle…
        while (m) {
            // Pick a remaining element…
            i = Math.floor(Math.random() * m--);

            // And swap it with the current element.
            t = array[m];
            array[m] = array[i];
            array[i] = t;
        }

        return array;
    };

    const addGameCards = () => {
        gameCards.whiteCards = shuffleDeck(cardData.whiteCards);
        gameCards.blackCards = shuffleDeck(cardData.blackCards);
    };

    /**
     * Builds the user object
     * @param {String} userID
     */
    const buildUserObject = (userID) => {
        return {
            playerID: userID,
            host: !Object.keys(users).length ? true : false,
            isConnected: true,
            blackCards: [],
            whiteCards: [],
        };
    };

    wss.on('connection', function connection(ws) {
        const OLD_USER_ID = ws.protocol;
        const userID = users[OLD_USER_ID] ? OLD_USER_ID : getUniqueID();
        console.log('userID ', userID);

        ws.id = userID;
        ws.isAlive = true;

        if (users[OLD_USER_ID] === undefined) {
            console.log("User didn't exist, build user.");
            users[userID] = buildUserObject(userID);
            ws.send(
                JSON.stringify({
                    type: 'userInit',
                    payload: users[userID],
                })
            );
        } else {
            const data = {
                game,
                player: users[userID],
            };
            console.log('game ', game.inPlayCards.whiteCards);
            console.log('data ', data);
            ws.send(
                JSON.stringify({
                    type: 'returnUser',
                    payload: data,
                })
            );
        }

        ws.on('message', function incoming(data) {
            const USER_IDS = Object.keys(users);
            const { type, payload } = JSON.parse(data);

            switch (type) {
                case 'startGame':
                    addGameCards();

                    USER_IDS.map((user) => {
                        users[user].whiteCards = getCards('startGameWhiteCards');
                    });

                    const startingBlackCard = getCards('getBlackCard');
                    const startingPlayerTurn = USER_IDS.reduce((acc, user) => {
                        if (users[user].host === true) acc = users[user].playerID;
                        return acc;
                    }, '');

                    updateGame(startingPlayerTurn, startingBlackCard, []);

                    wss.clients.forEach(function each(client) {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(
                                JSON.stringify({
                                    type: 'startGame',
                                    payload: {
                                        playerTurn: startingPlayerTurn,
                                        blackCard: startingBlackCard,
                                        whiteCards: users[client.id].whiteCards,
                                    },
                                })
                            );
                        }
                    });

                    break;
                case 'playCard':
                    // Keep our game date updated so if someone disconnects we can use it again

                    const whiteCardsPlayed = payload.cards.map((idx) => users[payload.playerID].whiteCards[idx]);

                    updateGame(game.playerTurn, game.inPlayCards.blackCard, [...game.inPlayCards.whiteCards, { playerID: payload.playerID, cards: whiteCardsPlayed }]);

                    wss.clients.forEach(function each(client) {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(
                                JSON.stringify({
                                    type: 'whitePlayed',
                                    payload: {
                                        whiteCards: [
                                            {
                                                playerID: payload.playerID,
                                                cards: whiteCardsPlayed,
                                            },
                                        ],
                                    },
                                })
                            );
                        }
                    });

                    payload.cards.forEach((card) => {
                        delete users[payload.playerID].whiteCards[card];
                        users[payload.playerID].whiteCards[card] = getCards('getWhiteCard');
                    });

                    // Send new white cards to the client that played the white cards
                    ws.send(
                        JSON.stringify({
                            type: 'whiteCardUpdate',
                            payload: users[payload.playerID].whiteCards,
                        })
                    );

                    break;
                case 'selectWinner':
                    const currentUser = USER_IDS.indexOf(payload.playerTurn);
                    const nextUser = USER_IDS[currentUser + 1] || USER_IDS[0];

                    updateGame(nextUser, getCards('getBlackCard'), []);

                    // Update the winner player object with the black card that they won
                    users[payload.playerID].blackCards = [...users[payload.playerID].blackCards, payload.blackCard.text];

                    wss.clients.forEach(function each(client) {
                        // Send new game data and previous round winning cards
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(
                                JSON.stringify({
                                    type: 'nextPlayer',
                                    payload: {
                                        game,
                                        winner: {
                                            blackCard: payload.blackCard.text,
                                            whiteCards: payload.cards,
                                        },
                                    },
                                })
                            );
                        }

                        // Send winner their black card
                        if (client.id === payload.playerID && client.readyState === WebSocket.OPEN) {
                            client.send(
                                JSON.stringify({
                                    type: 'wonBlack',
                                    payload: {
                                        blackCards: users[payload.playerID].blackCards,
                                    },
                                })
                            );
                        }
                    });
                default:
                    break;
            }
        });

        ws.on('close', function close() {
            ws.isAlive = false;
            users[ws.id].isConnected = ws.isAlive;

            const usersLeft = Object.keys(users).filter((user) => {
                if (users[user].isConnected) {
                    return user;
                }
            });

            if (!usersLeft.length) {
                wss.close();
            }
        });
    });
    wss.on('close', function () {
        console.log('connection closed');
        server();
        console.log('connection reconnected');
    });
};

server();
