<script setup>
import { NDataTable, NIcon } from 'naive-ui';
import { IconEqual, IconAlignCenter, IconMountain, IconHome } from '@tabler/icons-vue';
import PinchScrollZoom from '@coddicat/vue-pinch-scroll-zoom';
import { ref, reactive, inject, onBeforeUnmount, onMounted, nextTick } from 'vue';
const { id } = inject('varables');
const createColumns = () => {
    return [{
        title: 'Name',
        key: 'name',
        width: 120,
        fixed: 'left',
        ellipsis: {
            tooltip: true
        }

    }, {
        title: 'Army',
        key: 'army',
        ellipsis: {
            tooltip: true
        }

    }, {
        title: 'Lands',
        key: 'lands',
        ellipsis: {
            tooltip: true
        }
    }]
};
const gameDataColumns = createColumns();

const map = reactive({
    /**
    * @type {Array<Array<{id:Number,
    *  color: String
    * , number:Number}>>}
    */
    data: [
        [{ id: 0, color: "#00AA90", number: 15514 }, { id: 1, color: "#26453D", number: 114 }, { id: 0, color: "#26453D", number: 114 }],
        [{ id: 0, color: "#00AA90", number: 114 }, { id: 1, color: "#26453D", number: 114 }, { id: 0, color: "#26453D", number: 114 }],
    ]
})
const windowWidth = ref(window.innerWidth);
const windowHeight = ref(window.innerHeight);
const gameDatas = ref([])
const iconMap = ref([
    undefined,
    IconMountain,
    IconHome,
    IconAlignCenter, // water
    IconEqual, // swamp
])
const zoomer = ref(null)
/**
 * @type {Array<{name: String, army: String, lands: String}>}
 */
gameDatas.value = [
    { name: "Foo", army: 1, lands: 1 },
    { name: "FloatingBlocks", army: 114514, lands: 1919810 },
    { name: "FFFFFFFFFFFFFFFF", army: 250000, lands: 2499750000 },
]

/**
 * Useless now, but better to prepare this for later use
 */
function reset() {
    zoomer.value.setData({
        scale: 1,
        originX: 0,
        originY: 0,
        translateX: 0,
        translateY: 0
    });
}
function onResize() {
    windowHeight.value = window.innerHeight
    windowWidth.value = window.innerWidth
}

onMounted(() => {
    nextTick(() => {
        window.addEventListener('resize', onResize);
    })
})
onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize);
}) 
</script>
<template>
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
    <n-data-table :resizeable="true" :columns="gameDataColumns" :data="gameDatas"
        style="position: fixed;top: 10px;right: 10px;width: 360px" />
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