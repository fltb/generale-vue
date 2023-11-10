import store from '../../store/index';
import gameAPIConf from '../../static/game-api-conf';
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

        this.ws = new WebSocket(`${import.meta.env.VITE_WS_BASE_URL}/game/${id}?token=${store.state.global.token}`);
        // Send a message whenever the WebSocket connection opens.
        this.ws.onopen = (event) => {
            const json = JSON.parse(event.data);
            this.eventBindMap.get(gameAPIConf['event-id']['ws-onopen'])(json);
        }

        // Display any new messages received in the `messageDiv`.
        this.ws.onmessage = (event) => {
            if (event.data instanceof Blob) {
                const data = new Uint32Array(event.data);
                const type = data[0];
                this.eventBindMap.get(type)(data);
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
            if (!event.data) {
                return
            }
            const json = JSON.parse(event.data);
            this.eventBindMap.get(gameAPIConf['event-id']['ws-onclose'])(json);
        }
    }
    /**
     * 
     * @param {String} event - string
     * @param {Function} func 
     */
    bindFunctionToEvent(event, func){
        this.eventBindMap.set(gameAPIConf['event-id'][event], func);
    }
    /**
     * 
     * @param {String} event 
     * @param {Object} data 
     */
    sendEventData(event, data) {
        this.ws.send(JSON.stringify({type: event, ...data}));
    }
};
export default gameWebsocket;
