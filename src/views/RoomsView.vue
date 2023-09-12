<template>
    <n-layout class="w-100" style="height: 100%;">
        <n-layout-header bordered class="pb-3 ps-3 d-flex" size="large" style="height:10%;">
            <n-checkbox-group v-model:value="cities" class="mt-2">
                <n-checkbox value="Beijing" label="北京" size="large" />
                <n-checkbox value="Shanghai" label="上海" size="large" />
                <n-checkbox value="Guangzhou" label="广州" size="large" />
                <n-checkbox value="Shenzen" label="深圳" size="large" />
            </n-checkbox-group>
            <n-input-group style="width: 40%;margin-left: auto;">
                <n-input />
                <n-button type="primary" class="h-100">
                    搜索
                </n-button>
            </n-input-group>
        </n-layout-header>
        <n-layout-content class="p-2" style="height:90%;overflow: scroll;" native-scrollbar="false">
            <n-list hoverable clickable class="pb-3 mb-3">
                <n-list-item>
                    <n-thing>
                        <template #avatar>
                            <n-avatar>
                                <n-icon>
                                    <cash-icon />
                                </n-icon>
                            </n-avatar>
                        </template>
                        <template #header>
                            货币
                        </template>
                        <template #header-extra>
                            <n-button circle size="small">
                                <template #icon>
                                    <cash-icon />
                                </template>
                            </n-button>
                        </template>
                        <template #description>
                            描述
                        </template>
                        货币是为了提高交易效率而用于交换的中介商品。货币有多种形式，如贝壳粮食等自然物、金属纸张等加工品、银行卡信用卡等磁条卡、移动支付加密货币等APP。
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
                </n-list-item>
                <n-list-item>
                    <n-thing>
                        <template #avatar>
                            <n-avatar>
                                <n-icon>
                                    <cash-icon />
                                </n-icon>
                            </n-avatar>
                        </template>
                        <template #header>
                            货币
                        </template>
                        <template #header-extra>
                            <n-button circle size="small">
                                <template #icon>
                                    <cash-icon />
                                </template>
                            </n-button>
                        </template>
                        <template #description>
                            描述
                        </template>
                        货币是为了提高交易效率而用于交换的中介商品。货币有多种形式，如贝壳粮食等自然物、金属纸张等加工品、银行卡信用卡等磁条卡、移动支付加密货币等APP。
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
                </n-list-item>
                <n-list-item>
                    <n-thing>
                        <template #avatar>
                            <n-avatar>
                                <n-icon>
                                    <cash-icon />
                                </n-icon>
                            </n-avatar>
                        </template>
                        <template #header>
                            货币
                        </template>
                        <template #header-extra>
                            <n-button circle size="small">
                                <template #icon>
                                    <cash-icon />
                                </template>
                            </n-button>
                        </template>
                        <template #description>
                            描述
                        </template>
                        货币是为了提高交易效率而用于交换的中介商品。货币有多种形式，如贝壳粮食等自然物、金属纸张等加工品、银行卡信用卡等磁条卡、移动支付加密货币等APP。
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
                </n-list-item>
                <n-list-item>
                    <n-thing>
                        <template #avatar>
                            <n-avatar>
                                <n-icon>
                                    <cash-icon />
                                </n-icon>
                            </n-avatar>
                        </template>
                        <template #header>
                            货币
                        </template>
                        <template #header-extra>
                            <n-button circle size="small">
                                <template #icon>
                                    <cash-icon />
                                </template>
                            </n-button>
                        </template>
                        <template #description>
                            描述
                        </template>
                        货币是为了提高交易效率而用于交换的中介商品。货币有多种形式，如贝壳粮食等自然物、金属纸张等加工品、银行卡信用卡等磁条卡、移动支付加密货币等APP。
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
                </n-list-item>
                <n-list-item>
                    <n-thing>
                        <template #avatar>
                            <n-avatar>
                                <n-icon>
                                    <cash-icon />
                                </n-icon>
                            </n-avatar>
                        </template>
                        <template #header>
                            货币
                        </template>
                        <template #header-extra>
                            <n-button circle size="small">
                                <template #icon>
                                    <cash-icon />
                                </template>
                            </n-button>
                        </template>
                        <template #description>
                            描述
                        </template>
                        货币是为了提高交易效率而用于交换的中介商品。货币有多种形式，如贝壳粮食等自然物、金属纸张等加工品、银行卡信用卡等磁条卡、移动支付加密货币等APP。
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
                </n-list-item>
            </n-list>
        </n-layout-content>
        <n-layout-footer bordered position="absolute" class="p-2">
            成府路
        </n-layout-footer>
    </n-layout>
</template>
<script>
import { NList, NListItem, NCheckbox, NCheckboxGroup, NButton, NThing, NIcon, NSpace, NAvatar, NLayout, NLayoutHeader, NLayoutFooter, NLayoutContent, NScrollbar, NInput, NInputGroup } from 'naive-ui';
import { defineComponent } from 'vue';
export default defineComponent({
    components: {
        NList, NListItem, NCheckbox, NCheckboxGroup, NButton, NThing, NIcon, NSpace, NAvatar, NLayout, NLayoutHeader, NLayoutFooter, NLayoutContent, NScrollbar, NInput, NInputGroup
    }
})
</script>