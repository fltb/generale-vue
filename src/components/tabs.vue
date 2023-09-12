<script>
const menus = [
    {
        path: "/games",
        name: "Games",
        icon: GameController
    },
    {
        path: "/rooms",
        name: "Rooms",
        icon: CubeSharp
    },
    {
        path: "/maps",
        name: "Maps",
        icon: MapSharp
    }, {
        path: "/settings",
        name: "Settings",
        icon: Settings
    }
];
import { Settings, GameController, CubeSharp, MapSharp } from '@vicons/ionicons5';
import { NTab, NTabs, NIcon } from 'naive-ui';
export default {
    data() {
        return {
            menus: menus
        }
    },
    methods: {
        /**
         * 
         * @param {String} path 
         */
        goToLink(path) {
            this.$router.push(path)
        },
    },
    props: ['nowTab'],
    components: {
        NTab, NTabs, NIcon, Settings, GameController, CubeSharp, MapSharp
    }
}
</script>
<template>
    <n-tabs type="line" animated placement="left" size="large" :default-value="nowTab">
        <n-tab v-for="item in menus" :name="item.path" :tab="item.name" @click="goToLink(item.path)">
            <n-icon :component="item.icon" class="me-2"></n-icon> {{ item.name }}
        </n-tab>
    </n-tabs>
</template>