<template>
  <div class="p-3 h-100">
    <n-h2 class="ps-2">Click one to join the game.</n-h2>
    <n-grid x-gap="30" y-gap="30" :cols="3">
      <n-gi class="light-green gi p-3" span="2">
        <n-h2>1v1</n-h2>
        <n-gradient-text>
          two players battling in a large map
        </n-gradient-text>
      </n-gi>
      <n-gi class="green gi">
        <n-gradient-text :size="24">{{ playerOnline.one }} players online</n-gradient-text>
      </n-gi>
      <n-gi class="light-green gi p-3" span="2">
        <n-h2>2v2</n-h2>
        <n-gradient-text>
          each two players' group battling in a large map
        </n-gradient-text>
      </n-gi>
      <n-gi class="green gi">
        <n-gradient-text :size="24">{{ playerOnline.two }} players online</n-gradient-text>
      </n-gi>
      <n-gi class="light-green gi p-3" span="2">
        <n-h2>FFA</n-h2>
        <n-gradient-text>
          up to 8 players battling in a large map
        </n-gradient-text>
      </n-gi>
      <n-gi class="green gi">
        <n-gradient-text :size="24">{{ playerOnline.ffa }} players online</n-gradient-text>
      </n-gi>
    </n-grid>
  </div>
</template>
<style scoped>
.light-green {
  height: 114px;
  background-color: rgba(0, 128, 0, 0.12);
  transition: all 0.4s ease 0s;
}

.light-green:hover {
  background-color: rgba(0, 128, 0, 0.24);
}

.green {
  height: 114px;
  line-height: 114px;
  background-color: rgba(0, 128, 0, 0.24);
}

.green:hover {
  background-color: rgba(0, 128, 0, 0.12);
}

.gi {
  text-align: center;
}
</style>
<script>
import { NGrid, NGridItem, NGi, NH2, NGradientText } from 'naive-ui';
export default {
  data() {
    return {
      playerOnline: {
        one: 0,
        two: 0,
        ffa: 0
      }
    }
  },
  components: {
    NGrid, NGridItem, NGi, NH2, NGradientText
  }
}
</script>