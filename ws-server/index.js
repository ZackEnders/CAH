const WebSocket = require('ws');
const data = require('./data');

const server = () => {
    const wss = new WebSocket.Server({ port: 8080 });

    const addGameCards = () => {
        gameCards.whiteCards = data.whiteCards;
        gameCards.blackCards = data.blackCards;
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
        return data.whiteCards.splice(0, 1)[0];
    };

    let users = {};

    const gameCards = {
        blackCards: [],
        whiteCards: [],
    };

    const game = {
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
            console.log('payload ', payload);
            switch (type) {
                case 'startGame':
                    addGameCards();

                    Object.keys(users).map((user) => {
                        users[user].whiteCards = gameCards.whiteCards.splice(0, 7);
                    });

                    const startingBlackCard = gameCards.blackCards.splice(0, 1)[0];

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
                    const { playerID, cards } = payload;

                    wss.clients.forEach(function each(client) {
                        if (client.readyState === WebSocket.OPEN) {
                            const data = {
                                type: 'whitePlayed',
                                payload: {
                                    whiteCards: [
                                        {
                                            playerID,
                                            cards: cards.map((idx) => users[playerID].whiteCards[idx]),
                                        },
                                    ],
                                },
                            };
                            client.send(JSON.stringify(data));
                        }
                    });

                    cards.forEach((card) => {
                        delete users[playerID].whiteCards[card];
                        const newCard = getCard();
                        users[playerID].whiteCards[card] = newCard;
                    });

                    ws.send(
                        JSON.stringify({
                            type: 'whiteCardUpdate',
                            payload: users[playerID].whiteCards,
                        })
                    );

                    break;

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
