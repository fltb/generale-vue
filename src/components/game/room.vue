<script setup>
import { NLayoutHeader, NLayoutFooter, NCard, NButtonGroup, NButton, NGrid, NGi, NThing, NSpace, NDescriptions, NDescriptionsItem, NSlider, NInputNumber, NAvatar } from 'naive-ui';
import { inject, ref, watch } from 'vue';
const { id, gameWs, roominfos } = inject('variables');
let { ingame } = inject('variables');
import {getPlayerInfoInGame } from '../../api/user/game';

const infos = ref({
    /**
 * @type {Array<{
 *              color: String,
 *              username: String,
 *              team: String,
 *              description: String,
 *              uuid: String
 * }>}
 */
    playerList: [
        { color: "#FF0000", username: "fltb", team: "1", description: "foo bar foo bar", uuid: "5d79f1d0-c6a9-4bc8-92d8-8e2614c87d0c" },
        { color: "#FF0000", username: "fltb", team: "1", description: "foo bar foo bar", uuid: "5d79f1d0-c6a9-4bc8-92d8-8e2614c87d0c" },
        { color: "#FF0000", username: "fltb", team: "1", description: "foo bar foo bar", uuid: "5d79f1d0-c6a9-4bc8-92d8-8e2614c87d0c" },
        { color: "#FF0000", username: "fltb", team: "1", description: "foo bar foo bar", uuid: "5d79f1d0-c6a9-4bc8-92d8-8e2614c87d0c" },
        { color: "#FF0000", username: "fltb", team: "1", description: "foo bar foo bar", uuid: "5d79f1d0-c6a9-4bc8-92d8-8e2614c87d0c" },
    ],
    /**
     * @type {Array<Number>}
     */
    teams: [1, 2],
    settings: {
        map: {},
        speed: 50,
    },
    prepared: false,
});

function kick(uuid) { }
function report(uuid) { }
function addFriend(uuid) { }
function prepare() { }
function addTeam() {
    if (infos.value.teams.length > 20) {
        return
    }
    infos.value.teams.push(infos.value.teams[infos.value.teams.length - 1] + 1)
}
function deleteTeam() {
    if (infos.value.teams.length <= 2) {
        return;
    }
    const current = String(infos.value.teams[infos.value.teams.length - 1]);
    let removable = true
    infos.value.playerList.forEach(player => { if (player.team === current) { removable = false } })
    if (removable) {
        infos.value.teams.pop()
    }
}
function chooseTeam(team) { }

gameWs.bindFunctionToEvent('room-update-infos.value', data => {
    function updateObject(original, updates) {
        for (let key in updates) {
            if (updates.hasOwnProperty(key)) {
                if (typeof updates[key] === 'object' && updates[key] !== null && !Array.isArray(updates[key])) {
                    // Recursively update nested objects
                    original[key] = updateObject(original[key], updates[key]);
                } else {
                    original[key] = updates[key];
                }
            }
        }
        return original;
    }
    updateObject(infos.value, data);
})
watch(infos, (newValue, oldValue) => {
    if (newValue.playerList) {
        // Iterate through the playerList array
        newValue.playerList.forEach(async (player, index) => {
            if (player.uuid === oldValue.playerList[index].uuid) {
                return;
            }
            // Fetch additional information based on the player's uuid
            try {
                const data = await getPlayerInfoInGame(uuid);

                // Update the player's color, username, and description
                if (data) {
                    player.color = data.color;
                    player.username = data.username;
                    player.description = data.description;
                }
            } catch (error) {
                console.error('Error fetching player info:', error);
            }
        });
    }
}, { deep: true });

</script>

<template>
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
                    <n-button type="default" round @click="deleteTeam()">
                        -
                    </n-button>
                    <n-button v-for="team in infos.teams" type="default" @click="chooseTeam(team)">
                        {{ team }}
                    </n-button>
                    <n-button type="default" round @click="addTeam()">
                        +
                    </n-button>
                </n-button-group>
            </template>
            <n-grid x-gap="12" cols="2 400:3 600:4">
                <n-gi v-for="player in infos.playerList">
                    <n-thing class="m-2">
                        <template #avatar>
                            <n-avatar :style="{
                                backgroundColor: player.color
                            }" />
                        </template>
                        <template #header>
                            {{ player.username }}
                        </template>
                        <template #header-extra>
                            {{ player.team }}
                        </template>
                        <template #description>
                            {{ player.description }}
                        </template>
                        <template #action>
                            <n-space>
                                <n-button size="small" @click="kick(player.uuid)">
                                    Kick
                                </n-button>
                                <n-button size="small" @click="report(player.uuid)">
                                    Report
                                </n-button>
                                <n-button size="small" @click="addFriend(player.uuid)">
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
                {{ id }}
            </n-descriptions-item>
            <n-descriptions-item label="Map">
                <n-space vertical><span>Random <n-button size="small" strong> Anvanced Settings
                        </n-button></span> <n-button>Choose map</n-button></n-space>

            </n-descriptions-item>
            <n-descriptions-item label="Speed">
                <n-space vertical>
                    <n-slider v-model:value="infos.settings.speed" :step="1" />
                    <n-input-number v-model:value="infos.settings.speed" size="small" />
                </n-space>
            </n-descriptions-item>
        </n-descriptions>
        <template #footer>
            <n-button type="primary" size="large" @click="prepare" :class="{ active: infos.prepared }">
                Prepare
            </n-button>
        </template>
    </n-card>
    <n-layout-footer bordered position="absolute" style="z-index: 1;">
        Footer Footer Footer
    </n-layout-footer>
</template>