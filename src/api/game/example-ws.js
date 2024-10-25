"use strict";

import gameAPIConf from "../../static/game-api-conf";
import GameWebsocket from "./websocket";

const gameWs = new GameWebsocket('1234');

gameWs.bindFunctionToEvent("ws-onopen", () => console.log("ws open"));
gameWs.bindFunctionToEvent('game-start', () => console.log("start game"));

gameWs.bindFunctionToEvent('chatbox-message-receive', (payload) => {
    // In JSON File:    
    // "chatbox-message-receive": {
    //     "id": "number",
    //     "time": "string",
    //     "message": "string"
    // },
    // so we get payload: { id: number, time: string, message: string }, done

    console.log(`recv msg id ${payload.id} time ${payload.time} msg ${payload.message}.`);
})

// and Send usage:
gameWs.sendEventData('chatbox-message-receive', JSON.stringify({
    id: 'aaa',
    time: '2024-10-25',
    message: 'ping!'
}))

// listen to binary
gameWs.bindFunctionToEvent('game-update-map', (data) => {
    const { length: LENGTH, "blocks-begin": BLOCKS_BEGIN, blocks } = gameAPIConf["event-binary-chunk"]["game-update-map"]
    const { row: ROW, col: COL, id: ID, "player-id": PLAYER_ID, number: NUMBER, "block-size": BLOCK_SIZE } = blocks;

    for (let i = 0; i < LENGTH; i++) {
        const CUR_BLOCK = BLOCKS_BEGIN + i * BLOCK_SIZE;
        const row = CUR_BLOCK + ROW,
            col = CUR_BLOCK + COL,
            id = CUR_BLOCK + ID,
            num = CUR_BLOCK + NUMBER;
        console.log(`Extracted block ${i} from data, at ${row}-${col} type ${id}, have ${num} number.`)            
    }
})

// send binary, same logic.
const QUE_CONF = gameAPIConf["event-binary-chunk"]["game-update-action-queue"];
const sendBin = [];
sendBin[gameAPIConf["event-binary-chunk"].base.type] = gameAPIConf["event-id"]['game-update-action-queue']
sendBin[gameAPIConf["event-binary-chunk"].base["error-code"]] = 0
sendBin[QUE_CONF.length] = 2;

sendBin[QUE_CONF["queue-begin"] + QUE_CONF.action.to] = 0 // to 0 1 2 3, up down left right
sendBin[QUE_CONF["queue-begin"] + QUE_CONF.action.type] = 0 // type 0 1, move full or 50% 
sendBin[QUE_CONF["queue-begin"] + QUE_CONF.action.col] = 3
sendBin[QUE_CONF["queue-begin"] + QUE_CONF.action.row] = 3

sendBin[QUE_CONF["queue-begin"] + QUE_CONF.action.to + QUE_CONF.action["block-size"]] = 0 // to 0 1 2 3, up down left right
sendBin[QUE_CONF["queue-begin"] + QUE_CONF.action.type + QUE_CONF.action["block-size"]] = 0 // type 0 1, move full or 50% 
sendBin[QUE_CONF["queue-begin"] + QUE_CONF.action.col + QUE_CONF.action["block-size"]] = 3
sendBin[QUE_CONF["queue-begin"] + QUE_CONF.action.row + QUE_CONF.action["block-size"]] = 2
gameWs.sendEventData('game-update-action-queue', sendBin);