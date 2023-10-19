import './assets/main.css'
import '@coddicat/vue-pinch-scroll-zoom/style.css';


import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store/index'
console.log(store)
const app = createApp(App)

app.use(router)
app.use(store)
app.mount('#app')
