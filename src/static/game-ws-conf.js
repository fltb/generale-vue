import gameWs from './game-ws.json';

// If I don't need to share this json with Go server :(
const gameWsConf = {...gameWs, "event-id":{}, "block-id":{}}

gameWsConf.blocks.forEach((block, index) => gameWsConf["block-id"][index] = block)
gameWsConf['event-types'].forEach((event, index) => gameWsConf["event-id"][index] = event)

export default gameWsConf;