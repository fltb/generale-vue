<template>
    <n-config-provider :theme="darkTheme" class="h-100">
        <n-layout v-if="!ingame" class="h-100">
            <n-layout-header bordered position="absolute" style="z-index: 2;">
                Header Header Header
            </n-layout-header>
            <n-card class="container h-75 mt-3  p-2" position="absolute" style="top:7%;overflow: scroll;">
                <n-card class="mb-3" size="small" :segmented="{ content: true, footer: 'soft' }">
                    <template #header>
                        Players
                    </template>
                    <template #action>
                        <span class="me-3">Choose your team:</span>
                        <n-button-group size="small">
                            <n-button type="default" round>
                                -
                            </n-button>
                            <n-button type="default">
                                1
                            </n-button>
                            <n-button type="default">
                                2
                            </n-button>
                            <n-button type="default" round>
                                +
                            </n-button>
                        </n-button-group>
                    </template>
                    <n-grid x-gap="12" cols="2 400:3 600:4">
                        <n-gi>
                            <n-thing>
                                <template #avatar>
                                    <n-avatar>
                                        <n-icon>
                                            Color
                                        </n-icon>
                                    </n-avatar>
                                </template>
                                <template #header>
                                    Username
                                </template>
                                <template #header-extra>
                                    Team
                                </template>
                                <template #description>
                                    描述
                                </template>
                                <template #action>
                                    <n-space>
                                        <n-button size="small">
                                            Kick
                                        </n-button>
                                        <n-button size="small">
                                            Report
                                        </n-button>
                                        <n-button size="small">
                                            Add Friend
                                        </n-button>
                                    </n-space>
                                </template>
                            </n-thing>
                        </n-gi>
                        <n-gi>
                            <n-thing>
                                <template #avatar>
                                    <n-avatar>
                                        <n-icon>
                                            Color
                                        </n-icon>
                                    </n-avatar>
                                </template>
                                <template #header>
                                    Username
                                </template>
                                <template #header-extra>
                                    Team
                                </template>
                                <template #description>
                                    描述
                                </template>
                                <template #action>
                                    <n-space>
                                        <n-button size="small" dashed>
                                            Kick
                                        </n-button>
                                        <n-button size="small" dashed>
                                            Report
                                        </n-button>
                                        <n-button size="small" dashed>
                                            Add Friend
                                        </n-button>
                                    </n-space>
                                </template>
                            </n-thing>
                        </n-gi>
                        <n-gi>
                            <n-thing>
                                <template #avatar>
                                    <n-avatar>
                                        <n-icon>
                                            Color
                                        </n-icon>
                                    </n-avatar>
                                </template>
                                <template #header>
                                    Username
                                </template>
                                <template #header-extra>
                                    Team
                                </template>
                                <template #description>
                                    描述
                                </template>
                                <template #action>
                                    <n-space>
                                        <n-button size="small">
                                            Kick
                                        </n-button>
                                        <n-button size="small">
                                            Report
                                        </n-button>
                                        <n-button size="small">
                                            Add Friend
                                        </n-button>
                                    </n-space>
                                </template>
                            </n-thing>
                        </n-gi>
                        <n-gi>
                            <n-thing>
                                <template #avatar>
                                    <n-avatar>
                                        <n-icon>
                                            Color
                                        </n-icon>
                                    </n-avatar>
                                </template>
                                <template #header>
                                    Username
                                </template>
                                <template #header-extra>
                                    Team
                                </template>
                                <template #description>
                                    描述
                                </template>
                                <template #action>
                                    <n-space>
                                        <n-button size="small">
                                            Kick
                                        </n-button>
                                        <n-button size="small">
                                            Report
                                        </n-button>
                                        <n-button size="small">
                                            Add Friend
                                        </n-button>
                                    </n-space>
                                </template>
                            </n-thing>
                        </n-gi>
                    </n-grid>
                </n-card>
                <n-descriptions label-placement="left" title="Infomations">
                    <n-descriptions-item label="Room">
                        {{ gameID }}
                    </n-descriptions-item>
                    <n-descriptions-item label="Map">
                        <n-space vertical><span>Random <n-button size="small" strong> Anvanced Settings
                                </n-button></span> <n-button>Choose map</n-button></n-space>

                    </n-descriptions-item>
                    <n-descriptions-item label="Speed">
                        <n-space vertical>
                            <n-slider v-model:value="value" :step="1" />
                            <n-input-number v-model:value="value" size="small" />
                        </n-space>
                    </n-descriptions-item>
                    <n-descriptions-item label="夜宵">

                    </n-descriptions-item>
                </n-descriptions>
                <template #footer>
                    <n-button type="primary" size="large">
                        Prepare
                    </n-button>
                </template>
            </n-card>
            <n-layout-footer bordered position="absolute" style="z-index: 1;">
                Footer Footer Footer
            </n-layout-footer>
        </n-layout>
        <div v-if="ingame" class="h-100" style="margin: 0; padding: 0;">
            <PinchScrollZoom ref="zoomer" :width="windowWidth" :height="windowHeight" :within="false" :scale="scale"
                style="border: 1px solid black">
                <table class="game-table" style="--block-size: 32px;--digit-size:12px;border-spacing: 0px;">
                    <tbody>
                        <tr v-for="row in map.data">
                            <td v-for="item in row" style="background-color: {{ item.color; }};position: relative;">
                                <n-icon v-if:="iconMap[item.id]" size="30" :depth="5" :component="iconMap[item.id]" />
                                <span style="position: absolute;top: 0;left: 0;">{{ item.number }}</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </PinchScrollZoom>

            <n-card :bordered="false" class="pl-3" style="position: fixed;bottom: 10px;width: 380px;">
                <n-list class="chatbox-scroll-container" ref="chatBoxScrollContainer" style="height: 180px;overflow-y: scroll;">
                    <n-list-item v-for="comment in chatMessages">
                        <span>[{{ comment.time }}]</span>
                        <span>{{ comment.author }}</span>
                        :
                        <span>{{ comment.message }}</span>
                    </n-list-item>
                </n-list>
                <template #footer>
                    <n-input-group>
                        <n-button @click="scrollToLastMessage()">
                            <n-icon :component="ArrowDown" />
                </n-button>
                        <n-input v-model:value="guestname" type="text" class="form-control"
                            placeholder="Say something here." aria-label="Say something here."
                            aria-describedby="basic-addon2" />
                        <n-button @click="guestLogin"><n-icon :component="ArrowForward" /></n-button>
                    </n-input-group>
                </template>
            </n-card>
            <n-data-table :resizeable="true" :columns="gameDataColumns" :data="gameDatas"
                style="position: fixed;top: 10px;right: 10px;width: 360px" />
        </div>
    </n-config-provider>
</template>
<style>
.game-table td {
    width: var(--block-size);
    height: var(--block-size);
    color: var(--base-color);
    font-size: var(--digit-size);
    text-align: center;
    line-height: var(--block-size);
}

.game-table span {
    width: var(--block-size);
    height: var(--block-size);
    z-index: 11;
    text-align: center;
    line-height: var(--block-size);
    overflow: hidden;
    text-overflow: ellipsis;
}

.game-table .n-icon {
    width: var(--icon-size);
    height: var(--icon-size);
    z-index: 10;
}
</style>
<script>
import { NDataTable, NSlider, NInputNumber, NDescriptions, NDescriptionsItem, NInputGroup, NButtonGroup, NSpace, NAvatar, NIcon, NThing, NInput, NButton, NConfigProvider, NLayout, NLayoutContent, NLayoutFooter, NLayoutHeader, NCard, NGrid, NGi, NAffix, NList, NListItem } from 'naive-ui';
import { HomeOutline, CashOutline, ArrowDown, ArrowForward } from '@vicons/ionicons5';
import { IconEqual, IconAlignCenter, IconMountain, IconHome } from '@tabler/icons-vue';
import PinchScrollZoom from "@coddicat/vue-pinch-scroll-zoom";
import { ref } from 'vue'

const createColumns = () => {
    return [
        {
            title: 'Name',
            key: 'name',
            width: 120,
            fixed: 'left',
            ellipsis: {
                tooltip: true
            }

        },
        {
            title: 'Army',
            key: 'army',
            ellipsis: {
                tooltip: true
            }

        },
        {
            title: 'Lands',
            key: 'lands',
            ellipsis: {
                tooltip: true
            }

        }
    ]
}

export default {
    props: ["gameID"],
    setup() {
        const containerRef = ref < HTMLElement | undefined > (undefined)
        const chatBoxScrollContainer = ref < HTMLElement | undefined > (undefined)
        return {
            HomeOutline,
            IconMountain,
            IconHome,
            IconAlignCenter,
            IconEqual,
            ArrowDown,
            ArrowForward,
            containerRef,
            chatBoxScrollContainer,
            gameDataColumns: createColumns()
        }
    },
    data() {
        return {
            ingame: true,
            windowHeight: window.innerHeight,
            windowWidth: window.innerWidth,
            map: {
                /**
            * @type {Array<Array<{id:Number,
            *  color: String
            * , number:Number}>>}
            */
                data: [
                    [{ id: 0, color: "#00AA90", number: 15514 }, { id: 1, color: "#26453D", number: 114 }, { id: 0, color: "#26453D", number: 114 }],
                    [{ id: 0, color: "#00AA90", number: 114 }, { id: 1, color: "#26453D", number: 114 }, { id: 0, color: "#26453D", number: 114 }],
                ]
            },
            iconMap: [
                undefined,
                IconMountain,
                IconHome,
                IconAlignCenter, // water
                IconEqual, // swamp
            ],
            /**
             * @type {Array<{author: String, time: String, message: String}>}
             */
            chatMessages: [
                { author: "system", time: "12:34", message: "testtesttesttesttesttesttesttesttesttesttesttesttesttesttesttesttest" },
                { author: "system", time: "12:34", message: "test" },
                { author: "system", time: "12:34", message: "test" },
                { author: "system", time: "12:34", message: "test" },
                { author: "system", time: "12:34", message: "test" },
            ],
            /**
             * @type {Array<{name: String, army: String, lands: String}>}
             */
            gameDatas: [
                { name: "Foo", army: 1, lands: 1 },
                { name: "FloatingBlocks", army: 114514, lands: 1919810 },
                { name: "FFFFFFFFFFFFFFFF", army: 250000, lands: 2499750000 },
            ]
        }
    },
    mounted() {
        this.$nextTick(() => {
            window.addEventListener('resize', this.onResize);
        })
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.onResize);
    },
    methods: {
        reset() {
            this.$refs.zoomer.setData({
                scale: 1,
                originX: 0,
                originY: 0,
                translateX: 0,
                translateY: 0
            });
        },
        onResize() {
            this.windowHeight = window.innerHeight
            this.windowWidth = window.innerWidth
        },
        scrollToLastMessage() {
            const lastChildElement = this.$refs.chatBoxScrollContainer.$el.lastElementChild;
            lastChildElement?.scrollIntoView({
                behavior: 'smooth',
            });
        },

    },
    components: {  PinchScrollZoom, CashOutline, NDataTable, NSlider, NInputNumber, NDescriptions, NInput, NInputGroup, NDescriptionsItem, NButtonGroup, NSpace, NAvatar, NIcon, NThing, NButton, NConfigProvider, NLayout, NLayoutContent, NLayoutFooter, NLayoutHeader, NCard, NGrid, NGi, NAffix, NList, NListItem }
}
</script>