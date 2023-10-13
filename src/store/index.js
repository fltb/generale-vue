import { createStore, createLogger } from 'vuex'
import global from './modules/global'

const debug = process.env.NODE_ENV !== 'production'

export default createStore({
  modules: {
    global
  },
  strict: debug,
  plugins: debug ? [createLogger()] : []
})