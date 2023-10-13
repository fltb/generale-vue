// initial state
// shape: [{ id, quantity }]
const state = () => ({
    token: window.localStorage.getItem('token')
})

// getters
const getters = {}

// actions
const actions = {
    async login({ commit, state }, products) {
        const response = await fetch('/token');
        if (response.status !== 200) {
            // this will catch by login page and display on the message
            throw new Error(`${response.status} error when fetching token!`);
        }
        const json = await response.json();
        commit('TOKEN', json.token);
    },

    async guestLogin({ commit, state }, products) {
        const response = await fetch('/token');
        if (response.status !== 200) {
            // this will catch by login page and display on the message
            throw new Error(`${response.status} error when fetching token!`);
        }
        const json = await response.json();
        commit('TOKEN', json.token);
    },
}

// mutations
const mutations = {
    TOKEN: (state, value) => {
        state.token = value;
        window.localStorage.setItem('token', value);
    },
}

export default {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}