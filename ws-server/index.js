const WebSocket = require('ws');
const data = require('./data');

const server = () => {
    const wss = new WebSocket.Server({ port: 8080 });
    const cardData = { ...data };

    const addGameCards = () => {
        gameCards.whiteCards = cardData.whiteCards;
        gameCards.blackCards = cardData.blackCards;
    };

    // Generates unique ID for every new connection
    const getUniqueID = () => {
        const s4 = () =>
            Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        return s4() + s4() + '-' + s4();
    };

    const getCard = () => {
        return cardData.whiteCards.splice(0, 1)[0];
    };

    let users = {};

    const gameCards = {
        blackCards: [],
        whiteCards: [],
    };

    let game = {
        playerTurn: '',
        inPlayCards: {
            blackCard: '',
            whiteCards: [],
        },
    };

    const buildUserObject = (userID) => {
        return {
            playerID: userID,
            host: !Object.keys(users).length ? true : false,
            isConnected: true,
            blackCards: [],
            whiteCards: [],
        };
    };

    wss.on('connection', function connection(ws, request, client) {
        const userID = getUniqueID();
        ws.id = userID;
        ws.isAlive = true;
        users[userID] = buildUserObject(userID);

        ws.send(
            JSON.stringify({
                type: 'userInit',
                payload: users[userID],
            })
        );

        ws.on('message', function incoming(data) {
            const { type, payload } = JSON.parse(data);
            switch (type) {
                case 'startGame':
                    addGameCards();

                    Object.keys(users).map((user) => {
                        users[user].whiteCards = gameCards.whiteCards.splice(0, 7);
                    });

                    const startingBlackCard = gameCards.blackCards.splice(0, 1)[0];

                    game = {
                        playerTurn: Object.keys(users).reduce((acc, user) => {
                            if (users[user].host === true) acc = users[user].playerID;
                            return acc;
                        }, ''),
                        inPlayCards: {
                            blackCard: startingBlackCard,
                            whiteCards: [],
                        },
                    };

                    wss.clients.forEach(function each(client) {
                        if (client.readyState === WebSocket.OPEN) {
                            const data = {
                                type: 'startGame',
                                payload: {
                                    playerTurn: Object.keys(users).reduce((acc, user) => {
                                        if (users[user].host === true) acc = users[user].playerID;
                                        return acc;
                                    }, ''),
                                    blackCard: startingBlackCard,
                                    whiteCards: users[client.id].whiteCards,
                                },
                            };
                            client.send(JSON.stringify(data));
                        }
                    });

                    break;
                case 'playCard':
                    // Keep our game date updated so if someone disconnects we can use it again
                    game = {
                        playerTurn: game.playerTurn,
                        inPlayCards: {
                            blackCard: game.inPlayCards.blackCard,
                            whiteCards: [...game.inPlayCards.whiteCards, ...payload.cards.map((idx) => users[payload.playerID].whiteCards[idx])],
                        },
                    };

                    wss.clients.forEach(function each(client) {
                        if (client.readyState === WebSocket.OPEN) {
                            const data = {
                                type: 'whitePlayed',
                                payload: {
                                    whiteCards: [
                                        {
                                            playerID: payload.playerID,
                                            cards: payload.cards.map((idx) => users[payload.playerID].whiteCards[idx]),
                                        },
                                    ],
                                },
                            };
                            client.send(JSON.stringify(data));
                        }
                    });

                    payload.cards.forEach((card) => {
                        delete users[payload.playerID].whiteCards[card];
                        const newCard = getCard();
                        users[payload.playerID].whiteCards[card] = newCard;
                    });

                    ws.send(
                        JSON.stringify({
                            type: 'whiteCardUpdate',
                            payload: users[payload.playerID].whiteCards,
                        })
                    );

                    break;
                case 'selectWinner':
                    const currentUser = Object.keys(users).indexOf(payload.playerTurn);
                    console.log('currentUser ', currentUser);
                    const nextUser = Object.keys(users)[currentUser + 1] || Object.keys(users)[0];
                    console.log('nextUser ', nextUser);

                    game = {
                        playerTurn: nextUser,
                        inPlayCards: {
                            blackCard: gameCards.blackCards.splice(0, 1)[0],
                            whiteCards: [],
                        },
                    };

                    users[payload.playerID].blackCards = [...users[payload.playerID].blackCards, payload.blackCard.text];

                    wss.clients.forEach(function each(client) {
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
            console.log('usersLeft ', usersLeft);

            if (!usersLeft.length) {
                users = {};
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
