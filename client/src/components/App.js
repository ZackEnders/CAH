import React, { useEffect, useState, useReducer } from 'react';
import './App.css';

const URL = 'ws://192.168.1.221:8080';
const ws = new WebSocket(URL, sessionStorage.getItem('CAH_USER_ID')); // Update to cookie later, ss is good for testing

const App = () => {
    const [cardsPlayed, setCardsPlayed] = useState([]);
    const reducer = (state, action) => {
        console.log('action ', action);
        switch (action.type) {
            case 'returnUser':
                return { game: action.payload.game, player: action.payload.player };
            case 'userInit':
                sessionStorage.setItem('CAH_USER_ID', action.payload.playerID);
                return { ...state, player: action.payload };
            case 'startGame':
                return {
                    ...state,
                    player: { ...state.player, whiteCards: action.payload.whiteCards },
                    game: {
                        ...state.game,
                        isActive: true,
                        playerTurn: action.payload.playerTurn,
                        inPlayCards: {
                            blackCard: action.payload.blackCard,
                            whiteCards: [],
                        },
                    },
                };
            case 'whitePlayed':
                return {
                    ...state,
                    game: {
                        ...state.game,
                        inPlayCards: {
                            ...state.game.inPlayCards,
                            whiteCards: [...state.game.inPlayCards.whiteCards, ...action.payload.whiteCards],
                        },
                    },
                };
            case 'whiteCardUpdate':
                return { ...state, player: { ...state.player, whiteCards: action.payload } };
            case 'nextPlayer':
                console.log(`Black Card: ${action.payload.winner.blackCard}, \n White Card: ${action.payload.winner.whiteCards.map((card) => card)}`);
                setCardsPlayed([]);
                return {
                    ...state,
                    game: {
                        ...state.game,
                        playerTurn: action.payload.game.playerTurn,
                        inPlayCards: {
                            ...action.payload.game.inPlayCards,
                        },
                    },
                };
            case 'wonBlack':
                console.log(action.payload);
                return {
                    ...state,
                    player: { ...state.player, blackCards: action.payload.blackCards },
                };
            default:
                throw new Error();
        }
    };
    const [state, dispatch] = useReducer(reducer, { game: { isActive: false }, player: null });

    console.log('state ', state);

    useEffect(() => {
        ws.onopen = () => {
            // on connecting, do nothing but log it to the console
            console.log('connected');
        };

        ws.onmessage = (evt) => {
            // on receiving a message, add it to the list of messages
            const message = JSON.parse(evt.data);
            const { type, payload } = message;

            if (type === 'checkUser') {
                return ws.send(
                    JSON.stringify({
                        type: 'verifyUser',
                        payload: sessionStorage.getItem('CAH_USER_ID'),
                    })
                );
            } else {
                dispatch({
                    type,
                    payload,
                });
            }
        };

        ws.onclose = () => {
            console.log('disconnected');
            // write something to try and reconnect every x for x seconds
        };
    }, []);

    const startGame = () => {
        ws.send(
            JSON.stringify({
                type: 'startGame',
                payload: null,
            })
        );
    };

    // Is this the best way to do this? Seems meh compared to the callback feature on this.setState
    useEffect(() => {
        if (state.game.isActive && cardsPlayed.length && state.game.playerTurn !== state.player.playerID) {
            console.log('cardsPlayed ', cardsPlayed);
            if (cardsPlayed.length === state.game.inPlayCards.blackCard.pick) {
                ws.send(
                    JSON.stringify({
                        type: 'playCard',
                        payload: {
                            playerID: state.player.playerID,
                            cards: cardsPlayed,
                        },
                    })
                );
            }
        }
    }, [cardsPlayed]);

    const playWhiteCards = (index) => {
        setCardsPlayed([...cardsPlayed, ...[index]]);
    };

    const selectWinner = (player) => {
        console.log('player ', player);
        ws.send(
            JSON.stringify({
                type: 'selectWinner',
                payload: {
                    playerTurn: state.player.playerID,
                    ...player,
                    blackCard: state.game.inPlayCards.blackCard,
                },
            })
        );
    };

    const showOverlay = () => {
        if (state.player.playerID === state.game.playerTurn) {
            return (
                <div className="overlay" style={{ display: 'flex' }}>
                    <h2 className="overlay__player-turn">It's your turn to choose the best white card!</h2>
                </div>
            );
        } else if (cardsPlayed.length >= state.game.inPlayCards.blackCard.pick) {
            return (
                <div className="overlay" style={{ display: 'flex' }}>
                    <h2 className="overlay__played">You already selected your {cardsPlayed.length > 1 ? 'cards' : 'card'}</h2>
                </div>
            );
        } else if (state.game.inPlayCards.whiteCards.filter((player) => player.playerID === state.player.playerID)[0]) {
            return (
                <div className="overlay" style={{ display: 'flex' }}>
                    <h2 className="overlay__played">You already selected your {cardsPlayed.length > 1 ? 'cards' : 'card'}</h2>
                </div>
            );
        } else {
            return <div className="overlay" style={{ display: 'none' }}></div>;
        }
    };

    if (!state.game.isActive) {
        if (state.player === null) {
            return <div></div>;
        } else if (state.player.host === false) {
            return <div>Waiting for game to start!</div>;
        } else {
            return <h3 onClick={() => startGame()}>Start Game</h3>;
        }
    } else {
        return (
            <div className="container">
                <div className="left">
                    <h3>CAH</h3>
                    <div className="black-card-container">
                        <div className="card card--black">{state.game.inPlayCards.blackCard.text}</div>
                    </div>
                    {/* <div>
                        <h3>Chat</h3>
                        <div>Chat here yay!</div>
                    </div> */}
                </div>
                <div className="cards">
                    <div className="cards__in-play">
                        <h3>Cards in Play</h3>
                        <ul className="card__grid card__grid--played">
                            {state.game.inPlayCards.whiteCards.map((player) => {
                                return player.cards.map((card) => {
                                    return (
                                        <li key={card} className="card card--white" onClick={() => selectWinner(player)}>
                                            {card}
                                        </li>
                                    );
                                });
                            })}
                        </ul>
                    </div>
                    <div className="cards__in-hand">
                        <h3>Your cards</h3>
                        <div className="card__container">
                            <ul className="card__grid card__grid--player">
                                {state.player.whiteCards.map((card, index) => (
                                    <li key={card} className="card card--white" onClick={() => playWhiteCards(index)}>
                                        <span dangerouslySetInnerHTML={{ __html: card }}></span>
                                    </li>
                                ))}
                            </ul>
                            {showOverlay()}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
};

export default App;
