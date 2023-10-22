<template>
    <n-config-provider :theme="darkTheme" class="h-100">
        <n-layout v-if="!ingame" class="h-100">
            <room />
        </n-layout>
        <div v-if="ingame" class="h-100" style="margin: 0; padding: 0;">
            <game />
            <chatbox />
        </div>
    </n-config-provider>
</template>
<script>
import { NConfigProvider, NLayout } from 'naive-ui';
import { toRefs } from 'vue';

import room from '../components/inGame/room.vue';
import chatbox from '../components/inGame/chatbox.vue';
import game from '../components/inGame/game.vue';
export default {
    props: ["id"],
    provide() {
        const { id } = toRefs(this.$props)
        return {
            varables: {
                id: id,
                ingame: this.ingame
            }
        };
    },
    data() {
        return {
            ingame: true,
        }
    },
    components: {game, chatbox, room, NConfigProvider, NLayout }
}
</script>