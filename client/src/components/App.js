import React, { useEffect, useState, useReducer } from 'react';
import data from '../data/test';
import './App.css';
import 'keen-slider/keen-slider.min.css';

const URL = 'ws://localhost:8080';
const ws = new WebSocket(URL);

const App = () => {
    const reducer = (state, action) => {
        switch (action.type) {
            case 'userInit':
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
            console.log('type ', type);
            console.log('payload ', payload);
            dispatch({
                type,
                payload,
            });
        };

        ws.onclose = () => {
            console.log('disconnected');
            // automatically try to reconnect on connection loss
            // setState({
            //     ws: new WebSocket(URL),
            // });
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

    const playWhiteCards = (index) => {
        if (state.game.inPlayCards.blackCard.pick === 1) {
            ws.send(
                JSON.stringify({
                    type: 'playCard',
                    payload: {
                        playerID: state.player.playerID,
                        cards: [index],
                    },
                })
            );
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
                    <h3 onClick={() => startGame()}>CAH</h3>
                    <div className="black-card-container">
                        <div className="card card--black">{state.game.inPlayCards.blackCard.text}</div>
                    </div>
                    <div>
                        <h3>Chat</h3>
                        <div>Chat here yay!</div>
                    </div>
                </div>
                <div className="cards">
                    <div className="cards__in-play">
                        <h3>Cards in Play</h3>
                        <ul className="card__grid card__grid--played">
                            {state.game.inPlayCards.whiteCards.map((player) => {
                                return player.cards.map((card) => {
                                    return (
                                        <li key={card} className="card card--white">
                                            {card}
                                        </li>
                                    );
                                });
                            })}
                        </ul>
                    </div>
                    <div className="cards__in-hand">
                        <h3>Your cards</h3>
                        <ul className="card__grid card__grid--player">
                            {state.player.whiteCards.map((card, index) => (
                                <li key={card} className="card card--white" onClick={() => playWhiteCards(index)}>
                                    <span dangerouslySetInnerHTML={{ __html: card }}></span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        );
    }
};

export default App;
