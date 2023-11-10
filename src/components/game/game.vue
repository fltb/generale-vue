<script setup>
import { NDataTable, NIcon } from 'naive-ui';
import { IconEqual, IconAlignCenter, IconMountain, IconHome, IconChevronLeft, IconChevronRight, IconChevronUp, IconChevronDown } from '@tabler/icons-vue';
import { Square } from '@vicons/ionicons5';
import PinchScrollZoom from '@coddicat/vue-pinch-scroll-zoom';
import { h, ref, reactive, inject, onBeforeUnmount, onMounted, nextTick } from 'vue';
import { onKeyStroke } from '@vueuse/core'
import store from '../../store/index';
import gameAPIConf from '../../static/game-api-conf'

const { id, gameWs, roomInfos } = inject('variables');
const createColumns = () => {
    return [{
        title: 'Name',
        key: 'id',
        width: 120,
        fixed: 'left',
        ellipsis: {
            tooltip: true
        },
        render(row) {
            console.log(roomInfos.players[row.id].color)
            console.log(roomInfos.players[row.id].name)
            return [
                h(NIcon, { color: roomInfos.players[row.id].color }, { default: () => h(Square) }),
                h("SPAN", null, roomInfos.players[row.id].name)
            ]
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
    * @type {Array<Array<{
    *       id:Number,
    *       color: String
    *       number: Number
    *       display: {
    *           active: Boolean
    *           left: Number
    *           right: Number
    *           up: Number
    *           down: Number
    *       }
    * }>>}
    */
    data: [
        [{ id: 0, color: "#00AA90", number: 15514, display: {} }, { id: 1, color: "#26453D", number: 114, display: {} }, { id: 0, color: "#26453D", number: 114, display: {} }],
        [{ id: 0, color: "#00AA90", number: 114, display: { up: 1, down: 1, left: 1, right: 1 } }, { id: 1, color: "#26453D", number: 114, display: {} }, { id: 0, color: "#26453D", number: 114, display: {} }],
    ]
})
const windowWidth = ref(window.innerWidth);
const windowHeight = ref(window.innerHeight);
const gameData = ref([])
const currentBlock = reactive({ col: 0, row: 0 });
const actionQueue = ref([]);
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
gameData.value = [
    { id: 1, army: 1, lands: 1 },
    { id: 2, army: 114514, lands: 1919810 },
    { id: 3, army: 250000, lands: 2499750000 },
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
function setCurrentBlock(row, col) {
    map.data[currentBlock.row][currentBlock.col].display.active = false;
    map.data[row][col].display.active = true;
    currentBlock.row = row;
    currentBlock.col = col;
}
/**
 * 
 * @param {Number} row 
 * @param {Number} col 
 * @param {String} act - up down left right
 */
function pushAction(row, col, act) {
    actionQueue.value.push({ row, col, act })
    const display = map.data[row][col].display;
    if (display[act] !== undefined) {
        display[act]++;
    } else {
        display[act] = 1;
    }
    // TODO
    //gameWs.sendEventData('game-request-move', { row: row, col: col, act: act })
}
function clearAction() {
    actionQueue.value.forEach(({ row, col, act }) => map.data[row][col].display[act]--)
    actionQueue.value = []
    // TODO
    //gameWs.sendEventData('game-request-clear-move', {})
}
/**
 * 
 * @param {Array<{
 *      row: Number
 *      col: Number
 *      act: String
 * }>} newActionQueue 
 */
function setAction(newActionQueue) {
    actionQueue.value.forEach(({ row, col, act }) => map.data[row][col].display[act] = 0)
    actionQueue.value = newActionQueue;
    actionQueue.value.forEach(({ row, col, act }) => {
        const display = map.data[row][col].display;
        if (display[act] !== undefined) {
            display[act]++;
        } else {
            display[act] = 1;
        }
    })
}

function isInMap(row, col) { return (col >= 0 && col < map.data[0].length && row >= 0 && row < map.data.length) }
onMounted(() => {
    nextTick(() => {
        window.addEventListener('resize', onResize);
    })
})
onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize);
})
onKeyStroke(store.state.keybind.up, () => {
    const { row, col } = currentBlock;
    if (isInMap(row - 1, col)) {
        pushAction(row, col, 'up')
        setCurrentBlock(row - 1, col);
    }
})

onKeyStroke(store.state.keybind.down, () => {
    const { row, col } = currentBlock;
    if (isInMap(row + 1, col)) {
        pushAction(row, col, 'down')
        setCurrentBlock(row + 1, col);
    }
})

onKeyStroke(store.state.keybind.left, () => {
    const { row, col } = currentBlock;
    if (isInMap(row, col - 1)) {
        pushAction(row, col, 'left')
        setCurrentBlock(row, col - 1);
    }
})

onKeyStroke(store.state.keybind.right, () => {
    const { row, col } = currentBlock;
    if (isInMap(row, col + 1)) {
        pushAction(row, col, 'right')
        setCurrentBlock(row, col + 1);
    }
})

onKeyStroke(store.state.keybind.clearQueue, () => {
    clearAction()
})

gameWs.bindFunctionToEvent('game-update-map', data => {
    const conf = gameAPIConf['event-binary-chunk']['game-update-map'];
    const length = data[conf['length']];
    for (let i = 0; i < length; i++) {
        const idx = i * conf['blocks']['block-size'] + conf['blocks-begin'];
        const [rowIndex, colIndex, idIndex, playerIdIndex, numberIndex] =
            [conf['blocks']['row'], conf['blocks']['col'], conf['blocks']['id'], conf['blocks']['player-id'], conf['blocks']['number']]
                .map(item => item + idx);
        const [row, col, id, playerId, number] =
            [data[rowIndex], data[colIndex], data[idIndex], data[playerIdIndex], data[numberIndex]];
        const item = map.data[row][col];
        item.id = id;
        item.playerId = playerId;
        item.color = roomInfos.players[playerId].color;
        item.number = number;
    }
})

gameWs.bindFunctionToEvent('game-update-action-queue', data => {
    let newActionQueue = [];
    const conf = gameAPIConf['event-binary-chunk']['game-update-action-queue'];
    const length = data[conf["length"]];
    for (let i = 0; i < length; i++) {
        const idx = i * conf['action']['block-size'] + conf['queue-begin'];
        const [rowIndex, colIndex, actIndex] =
            [conf['action']["row"], conf["action"]["col"], conf["action"]["act"]]
                .map(item => item + idx);
        const item = { row: data[rowIndex], col: data[colIndex], act: data[actIndex] };
        newActionQueue.push(item);
    }
    setAction(newActionQueue);
})

gameWs.bindFunctionToEvent('game-update-rank', data => {
    const rank = data.rank;
    gameData.value = rank;
})

gameWs.bindFunctionToEvent('game-full-map', data => {
    const conf = gameAPIConf['event-binary-chunk']['game-full-map'];
    const [rows, cols] = [data[conf['rows']], data[conf['cols']]];
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const idx = (i * cols + j) * conf['blocks']['block-size'] + conf['blocks-begin'];
            const [idIndex, playerIdIndex, numberIndex] =
                [conf['blocks']['id'], conf['blocks']['player-id'], conf['blocks']['number']]
                    .map(item => item + idx);
            const [id, playerId, number] = [data[idIndex], data[playerIdIndex], data[numberIndex]];
            map.data[i][j] = item;
            item.id = id;
            item.playerId = playerId;
            item.color = roomInfos.players[playerId].color
            item.number = number;
        }
    }
})

</script>
<template>
    <PinchScrollZoom ref="zoomer" :width="windowWidth" :height="windowHeight" :within="false" :scale="scale"
        style="border: 1px solid black;background-color: black  ;">
        <table class="game-table"
            style="--block-size: 48px;--digit-size:11px;border-spacing: 0px;background-color: black;color: rgba(255, 255, 255, 0.82);">
            <tbody>
                <tr v-for="(row, rowIndex) in map.data">
                    <td v-for="(item, colIndex) in row" class="border m-0 p-0"
                        style="position: relative;margin: 0;padding: 0;">
                        <div :style="{ backgroundColor: item.color }" @click="setCurrentBlock(rowIndex, colIndex)">
                            <n-icon v-if:="iconMap[item.id]" size="48" :depth="5" :component="iconMap[item.id]"
                                class="icon-bg" />
                            <span :class="{ active: item.display.active }" style="position: absolute;top: 0;left: 0;">{{
                                item.number
                            }}</span>
                            <n-icon v-if:="item.display.up" size="16" :depth="2" :component="IconChevronUp"
                                class="icon-up" />
                            <n-icon v-if:="item.display.down" size="16" :depth="2" :component="IconChevronDown"
                                class="icon-down" />
                            <n-icon v-if:="item.display.left" size="16" :depth="2" :component="IconChevronLeft"
                                class="icon-left" />
                            <n-icon v-if:="item.display.right" size="16" :depth="2" :component="IconChevronRight"
                                class="icon-right" />
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </PinchScrollZoom>
    <n-data-table :resizeable="true" :columns="gameDataColumns" :data="gameData"
        style="position: fixed;top: 10px;right: 10px;width: 360px" />
</template>
<style>
.game-table div {
    width: var(--block-size);
    height: var(--block-size);
    color: var(--base-color);
    font-size: var(--digit-size);
    text-align: center;
    line-height: var(--block-size);
    margin: 0;
    padding: 0;
}

.game-table span {
    background-color: rgba(0, 0, 0, 0.15);
    width: var(--block-size);
    height: var(--block-size);
    z-index: 6;
    text-align: center;
    font-weight: bold;
    line-height: var(--block-size);
    overflow: hidden;
    text-overflow: ellipsis;
    margin: 0;
    padding: 0;
}

.game-table span.active {
    background-color: rgba(240, 248, 255, 0.15);
}

.game-table .icon-bg {
    width: var(--block-size);
    height: var(--block-size);

    text-align: center;
    line-height: var(--block-size);
    z-index: 5;
}

.game-table .icon-up {
    position: absolute;
    text-align: center;
    width: var(--block-size);
    z-index: 7;
    top: 0;
    left: 0;
}

.game-table .icon-down {
    width: var(--block-size);
    position: absolute;
    text-align: center;
    z-index: 7;
    bottom: 0;
    left: 0;
}

.game-table .icon-left {
    height: var(--block-size);
    text-align: center;
    line-height: var(--block-size);
    position: absolute;
    z-index: 7;
    top: 3px;
    left: 0;
}

.game-table .icon-right {
    height: var(--block-size);
    text-align: center;
    line-height: var(--block-size);
    position: absolute;
    z-index: 7;
    top: 3px;
    right: 0;
}
</style>