<script setup>
import { NCard, NList, NListItem, NInputGroup, NButton, NInput, NIcon } from 'naive-ui';
import { ArrowDown, ArrowForward, Square } from '@vicons/ionicons5';
import { inject, ref } from 'vue';
import { postChatMessage } from '../../api/game/fetch';

const { id, gameWs, roomInfos } = inject('variables');
const chatMessages = ref([]);
const inputMessage = ref("");
const chatBoxScrollContainer = ref(null);
/**
 * @type {Array<{author: String, time: String, message: String}>}
 */
chatMessages.value = [
    { id: 1, time: "12:34", message: "testtesttesttesttesttesttesttesttesttesttesttesttesttesttesttesttest" },
    { id: 1, time: "12:34", message: "test" },
    { id: 2, time: "12:34", message: "test" },
    { id: 1, time: "12:34", message: "test" },
    { id: 1, time: "12:34", message: "test" },
]

function sendMessage() {
    postChatMessage(id, inputMessage.value);
    inputMessage.value = "";
}
function scrollToLastMessage() {
    const lastChildElement = chatBoxScrollContainer.value.$el.lastElementChild;
    lastChildElement?.scrollIntoView({
        behavior: 'smooth',
    });
}

gameWs.bindFunctionToEvent('chatbox-message-receive', data => {
    chatMessages.value.push(data);
})

</script>
<template>
    <n-card :bordered="false" class="pl-3" style="position: fixed;bottom: 10px;width: 380px;">
        <n-list class="chatbox-scroll-container" ref="chatBoxScrollContainer" style="height: 180px;overflow-y: scroll;">
            <n-list-item v-for="comment in chatMessages">
                <n-icon :color="roomInfos.players[comment.id].color" :component="Square"></n-icon>
                <span>[{{ comment.time }}]</span>
                <span>{{ roomInfos.players[comment.id].name }}</span>
                :
                <span>{{ comment.message }}</span>
            </n-list-item>
        </n-list>
        <template #footer>
            <n-input-group>
                <n-button @click="scrollToLastMessage()"><n-icon :component="ArrowDown" /></n-button>
                <n-input v-model:value="inputMessage" type="text" class="form-control" placeholder="Say something here."
                    aria-label="Say something here." aria-describedby="basic-addon2" />
                <n-button @click="sendMessage"><n-icon :component="ArrowForward" /></n-button>
            </n-input-group>
        </template>
    </n-card>
</template>