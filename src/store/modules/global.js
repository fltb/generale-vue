import api from '../../api/user/account';

// initial state
const state = () => ({
    token: window.localStorage.getItem('token')
})

// getters
const getters = {}

// actions
const actions = {
    async login({ commit, state }, products) {
        // if error occurs, it will throw to caller
        const token = await api.login(products.username, products.password);
        commit('TOKEN', token);
    },

    async guestLogin({ commit, state }, products) {
        const token = await api.guestLogin(products.username);
        commit('TOKEN', token);
    },
    // won't modify the store, just a wrap
    async register({commit, state}, products){
        await api.register(products.username, products.password)
    },
    logout({commit}){
        commit('TOKEN', '')
    }
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