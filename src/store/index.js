import { createStore, createLogger } from 'vuex'
import global from './modules/global'
import keybind from './modules/keybind'

const debug = process.env.NODE_ENV !== 'production'

export default createStore({
  modules: {
    global: global,
    keybind: keybind,
  },
  strict: debug,
  plugins: debug ? [createLogger()] : []
})