import gameAPI from './game-api.json';

// If I don't need to share this json with Go server :(
const gameAPIConf = {...gameAPI, "event-id":{}, "block-id":{}}

gameAPIConf.blocks.forEach((block, index) => gameAPIConf["block-id"][index] = block)
gameAPIConf['event-types'].forEach((event, index) => gameAPIConf["event-id"][index] = event)

export default gameAPIConf;