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
                <n-list-item v-for="room in roomist">
                    <n-thing>
                        <template #avatar>
                            <n-avatar>
                                <n-icon>
                                    <cash-icon />
                                </n-icon>
                            </n-avatar>
                        </template>
                        <template #header>
                            {{ room.header }}
                        </template>
                        <template #header-extra>
                            {{ room.headerExtra }}
                        </template>
                        <template #description>
                            {{ room.description }}
                        </template>
                        {{ room.body }}
                        <template #footer>
                            {{ room.footer }}
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
    data() {
        return {
            /**
             * @type {Array<{
             *              header: String,
             *              headerExtra: String,
             *              description: String,
             *              body: String,
             *              footer: String,
             *              roomId: String}>}
             */
            roomist: [
                {
                    header: "Test Room",
                    headerExtra: "extra",
                    description: "description",
                    body: "foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar",
                    footer: "footer",
                    roomId: "11111"
                }, {
                    header: "Test Room",
                    headerExtra: "extra",
                    description: "description",
                    body: "foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar",
                    footer: "footer",
                    roomId: "11111"
                }, {
                    header: "Test Room",
                    headerExtra: "extra",
                    description: "description",
                    body: "foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar",
                    footer: "footer",
                    roomId: "11111"
                }, {
                    header: "Test Room",
                    headerExtra: "extra",
                    description: "description",
                    body: "foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar",
                    footer: "footer",
                    roomId: "11111"
                }, {
                    header: "Test Room",
                    headerExtra: "extra",
                    description: "description",
                    body: "foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar",
                    footer: "footer",
                    roomId: "11111"
                }, {
                    header: "Test Room",
                    headerExtra: "extra",
                    description: "description",
                    body: "foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar foo bar",
                    footer: "footer",
                    roomId: "11111"
                },
            ]
        }
    },
    components: {
        NList, NListItem, NCheckbox, NCheckboxGroup, NButton, NThing, NIcon, NSpace, NAvatar, NLayout, NLayoutHeader, NLayoutFooter, NLayoutContent, NScrollbar, NInput, NInputGroup
    }
})
</script>