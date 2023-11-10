function safeJsonParse(str) {
    try {
        const jsonValue = JSON.parse(str);
        return jsonValue;
    } catch {
        return undefined;
    }
};
// initial state
const state = () => ({
    up: safeJsonParse(window.localStorage.getItem('upKey')) || ["W", "w", "ArrowUp"],
    down: safeJsonParse(window.localStorage.getItem('downKey')) || ["S", "s", "ArrowDown"],
    left: safeJsonParse(window.localStorage.getItem('leftKey')) || ["A", "a", "ArrowLeft"],
    right: safeJsonParse(window.localStorage.getItem('rightKey')) || ["D", "d", "ArrowRight"],
    clearQueue: safeJsonParse(window.localStorage.getItem('clearQueueKey')) || ["C", "c", "Backspace"],
})
const getters = {}
// actions
const actions = {
    getKey({ state }, key) {
        return state[key];
    },
}

// mutations
const mutations = {
    keyBind: (state, { key, value }) => {
        state[key] = value;
        window.localStorage.setItem(key, JSON.stringify(value));
    },
}

export default {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}