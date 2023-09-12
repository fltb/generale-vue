<script>
import { RouterLink, RouterView, useRouter, useRoute } from 'vue-router';
import TabsVue from './components/tabs.vue';
import LoginComponent from './views/LoginView.vue';
import { Settings, GameController, CubeSharp, MapSharp } from '@vicons/ionicons5'
import { NIcon, darkTheme, NConfigProvider, NLayout, NLayoutSider, NLayoutContent, NLayoutHeader, NLayoutFooter, NSpace, NTab, NTabs, NH1, NCard } from 'naive-ui';
export default {
  name: 'GenrealE',
  data() {
    return {
      isAuthenticated: false,
      darkTheme: darkTheme,
    }
  },
  methods: {
    /**
     * 
     * @param {String} path 
     */
    goToLink(path) {
      this.$router.push(path)
    },
  },
  components: {
   TabsVue, NConfigProvider, RouterLink, RouterView, LoginComponent, NLayoutSider, NLayout, NLayoutContent, NLayoutHeader, NLayoutFooter, NSpace, NTab, NCard, NTabs, NH1, Settings, GameController, CubeSharp, MapSharp, NIcon,
  }
}
</script>

<template>
  <n-config-provider :theme="darkTheme" class="h-100">
    <div v-if="!isAuthenticated" class="container">
      <LoginComponent @myInput="isAuthenticated = $event" />
    </div>
    <div v-else-if="isAuthenticated && !$route.fullPath.includes('/game/')" class="h-100">
      <n-layout class="h-100">
        <n-layout-header bordered position="absolute" style="z-index: 2;">
          Header Header Header
        </n-layout-header>
        <div style="/*position: relative;*/" class="container h-75 mt-3">
          <div style="/*position: absolute;top: 7%;left: 0;bottom: 0;right: 0; margin: auto;*/">
            <n-h1 style="font-size: 3.8em;padding-left: 0.2em;margin-top: 4.5%;">General E</n-h1>
            <n-card>
              <n-layout has-sider>
                <n-layout-sider bordered collapse-mode="width" style="width: min-content;">
                  <TabsVue />
                </n-layout-sider>
                <n-layout bordered style="height: 570px;">
                  <RouterView class="h-100" />
                </n-layout>
              </n-layout>
            </n-card>
          </div>
        </div>
        <n-layout-footer bordered position="absolute" style="z-index: 1;">
          Footer Footer Footer
        </n-layout-footer>
      </n-layout>
      <!--RouterView /-->
    </div>
    <div v-else class="h-100">
      <RouterView class="h-100"></RouterView>
    </div>
  </n-config-provider>
</template>

<style scoped>
header {
  line-height: 1.5;
  max-height: 100vh;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

nav {
  width: 100%;
  font-size: 12px;
  text-align: center;
  margin-top: 2rem;
}

nav a.router-link-exact-active {
  color: var(--color-text);
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
  border: 0;
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }

  nav {
    text-align: left;
    margin-left: -1rem;
    font-size: 1rem;

    padding: 1rem 0;
    margin-top: 1rem;
  }
}
</style>
