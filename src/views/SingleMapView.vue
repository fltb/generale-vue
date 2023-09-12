<template>
    <div class="h-100 w-100 p-3">
        <n-thing>
            <template #header>
                地图
            </template>
            <template #header-extra>
                <n-button circle size="small">
                    <template #icon>
                        <cash-icon />
                    </template>
                </n-button>
            </template>
            <template #description>
                描述{{ this.mapID }}
            </template>
            货币是为了提高交易效率而用于交换的中介商品。货币有多种形式，如贝壳粮食等自然物、金属纸张等加工品、银行卡信用卡等磁条卡、移动支付加密货币等APP。
            <n-button @click="showModal = true">
                来吧
            </n-button>
            <template #footer>
                尾部
            </template>
            <template #action>
                <n-space>
                    <n-button size="small">
                        <template #icon>
                            <n-icon>
                                <cash-icon />
                            </n-icon>
                        </template>
                        1 块钱
                    </n-button>
                    <n-button size="small">
                        <template #icon>
                            <n-icon>
                                <cash-icon />
                            </n-icon>
                        </template>
                        10 块钱
                    </n-button>
                    <n-button size="small">
                        <template #icon>
                            <n-icon>
                                <cash-icon />
                            </n-icon>
                        </template>
                        100 块钱
                    </n-button>
                </n-space>
            </template>
        </n-thing>
    </div>
    <n-modal v-model:show="showModal">
        <n-card style="width: 600px" title="Map" :bordered="false" size="huge" role="dialog" aria-modal="true">
            <template #header-extra>
                噢！
            </template>
            内容
            <template #footer>
                尾部
            </template>
        </n-card>
    </n-modal>
</template>
<script>
import { NThing, NSpace, NButton, NIcon, NModal, NCard } from 'naive-ui';
import { defineComponent, ref } from 'vue';
export default defineComponent({
    setup() {
        return {
            showModal: ref(false)
        }
    },
    props: ['mapID'],
    components: {
        NThing, NSpace, NButton, NIcon, NModal, NCard
    }
})
</script>