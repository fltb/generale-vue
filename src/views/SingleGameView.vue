<template>
    <n-spin :show="loading">
        <n-layout v-if="!ingame" class="h-100">
            <room />
        </n-layout>
        <div v-if="ingame" class="h-100" style="margin: 0; padding: 0;">
            <game />
            <chatbox />
        </div>
    </n-spin>
</template>
<script>
import { NLayout, NSpin } from 'naive-ui';
import { toRefs, reactive } from 'vue';
import gameWebsocket from '../api/game/websocket';

import room from '../components/game/room.vue';
import chatbox from '../components/game/chatbox.vue';
import game from '../components/game/game.vue';
export default {
    props: ["id"],
    provide() {
        const { id } = toRefs(this.$props)
        const gameWs = new gameWebsocket(id.value);
        gameWs.bindFunctionToEvent("ws-onopen", () => this.loading = false)
        gameWs.bindFunctionToEvent('game-start', () => this.ingame = true)
        const roomInfos = reactive({
            players: {
                "1": {
                    color: "red",
                    name: "First",
                },
                "2": {
                    color: "green",
                    name: "Second"
                },
                "3": {
                    color: "blue",
                    name: "Third"
                }
            }
        });
        return {
            variables: {
                id: id,
                ingame: this.ingame,
                gameWs: gameWs,
                roomInfos: roomInfos
            }
        };
    },
    data() {
        return {
            ingame: true,
            loading: false
        }
    },
    components: { game, chatbox, room, NLayout, NSpin }
}
</script>