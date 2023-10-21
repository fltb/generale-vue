import { store } from '../../store/index';
import gameWsConf from '../../static/game-ws-conf';
class gameWebsocket {
    /**
     * Build a websocket connection to the game server.
     * @param {String} id - number in string format
     */
    constructor(id) {
        /**
         * @type {Map<String:Function>} - when event(String) happend, call this Function
         */
        this.eventBindMap = new Map();
        this.gameOverFunction = () => {};

        this.ws = new WebSocket(`${import.meta.env.VITE_WS_BASE_URL}/game/${id}?token=${store.state.global.token}`);
        // Send a message whenever the WebSocket connection opens.
        this.ws.onopen = (event) => {
            const json = JSON.parse(event.data);
        }

        // Display any new messages received in the `messageDiv`.
        this.ws.onmessage = (event) => {
            if (event.data instanceof Blob) {
                const data = new Uint32Array(event.data);
                const type = data[0];
                this.eventBindMap.get(type)(event.data);
            } else {
                const data = JSON.parse(event.data);
                const type = data.type;
                this.eventBindMap.get(type)(data);
            }
        }

        this.ws.onerror = (event) => {
            throw new Error(event)
        }

        this.ws.onclose = (event) => {
            // websocket will close automatically when the game ended for several minutes.
            this.gameOverFunction(JSON.parse(event.data));
        }
    }
    /**
     * 
     * @param {String} event 
     * @param {Function} func 
     */
    bindFuntionToEvent(event, func){
        this.eventBindMap.set(gameWsConf['event-id'][event], func);
    }
    bindFunctionToWsClose(func){
        this.gameOverFunction = func;
    }
};
export default gameWebsocket;
