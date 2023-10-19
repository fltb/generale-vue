<template>
  <main class="login-page container-sm  font-weight-bold border border-primary rounded h-100 p-3 parallelogram">
    <div class="p-3 me-3" style="height: 100%;width: 100%;">
      <h1 class="font-weight-bold mb-3 text-center " style="">General E</h1>
      <p class="text-end mb-3 pe-1">Insprired by generals.io</p>
      <n-alert v-if="notice.enable" :title="notice.title" :type="notice.type">
        {{ notice.message }}
      </n-alert>
      <n-card :bordered="false">
        <n-tabs class="card-tabs " default-value="guest" size="large" animated pane-wrapper-style="margin: 0 -4px"
          pane-style="padding-left: 4px; padding-right: 4px; box-sizing: border-box;">
          <n-tab-pane name="guest" tab="游客">
            <n-input-group class="input-group input-group-lg pt-3 pb-3 ps-2 pe-2 ">
              <n-input v-model:value="guestname" type="text" class="form-control"
                placeholder="Enter your username here (Guest)" aria-label="Enter your username here (Guest)"
                aria-describedby="basic-addon2" />
              <n-button @click="guestLogin"><n-icon :component="ArrowForward"></n-icon></n-button>
            </n-input-group>
          </n-tab-pane>
          <n-tab-pane name="signin" tab="登录">
            <n-form>
              <n-form-item-row label="用户名">
                <n-input v-model:value="loginInfo.username" />
              </n-form-item-row>
              <n-form-item-row label="密码">
                <n-input v-model:value="loginInfo.password" />
              </n-form-item-row>
            </n-form>
            <n-button type="primary" block secondary strong @click="login">
              登录
            </n-button>
          </n-tab-pane>
          <n-tab-pane name="signup" tab="注册">
            <n-form>
              <n-form-item-row label="用户名">
                <n-input v-model:value="signupInfo.username" />
              </n-form-item-row>
              <n-form-item-row label="密码">
                <n-input v-model:value="signupInfo.password" />
              </n-form-item-row>
              <n-form-item-row label="重复密码">
                <n-input v-model="signupInfo.repassword" />
              </n-form-item-row>
            </n-form>
            <n-button type="primary" block secondary strong @click="signup">
              注册
            </n-button>
          </n-tab-pane>
        </n-tabs>
      </n-card>
    </div>
  </main>
</template>
  
<style>
@media (min-width: 768px) {
  .login-page {
    width: 768px;
  }
}

h1 {
  font-size: 4.5em;
  font-size: 4.5rem;
}

.split {
  font-size: 1.25em;
  font-size: 1.25rem;
}
</style>
  
<script setup>

</script>

<script>
import { NButton, NInputGroup, NInput, NTabs, NTabPane, NForm, NFormItemRow, NCard, NAlert, NIcon } from 'naive-ui';
import { ArrowForward } from '@vicons/ionicons5';
export default {
  name: 'LoginComponent',
  model: {
    event: 'myInput',
  },
  setup() {
    return {
      ArrowForward,
    }
  },
  data() {
    return {
      guestname: undefined,
      loginInfo: {
        username: undefined,
        password: undefined
      },
      signupInfo: {
        username: undefined,
        password: undefined,
        repassword: undefined
      },
      notice: {
        enable: false,
        title: undefined,
        type: undefined, // default || info || success ||  warning || error
        message: undefined
      }
    }
  },
  methods: {
    __setLogined() {
      this.$store.commit('global/TOKEN', "test-token"); //TEST
    },
    async __baseAct(action, args) {
      try {
        this.__setLogined();  
        await this.$store.dispatch('global/' + action, args);
        this.notice.enable = false;
      } catch (error) {
        this.notice.enable = true;
        this.notice.message = error.toString();
        this.notice.type = "error";
      }
    },
    guestLogin() {
      this.__baseAct('guestLogin', { username: this.guestname })
    },
    login() {
      this.__baseAct('login', { username: this.loginInfo.username, password: this.lginInfo.password })
    },
    signup() {
      const { username, password, repassword } = this.signupInfo;
      if (password != repassword) {
        this.notice.enable = true;
        this.notice.type = 'error';
        this.notice.message = 'password not match!';
        return;
      }
      this.__baseAct('register', { username: username, password, password });
    }
  },
  components: {
    NButton, NInput, NInputGroup, NTabs, NTabPane, NForm, NFormItemRow, NCard, NAlert, ArrowForward, NIcon
  }
}
</script>
  