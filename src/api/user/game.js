import { baseActGet } from "../fetch";

/**
 * no authentication, because I think it should be public
 * @param {String} uuid - player uuid
 * @returns {Promise<Object>} - check it on user-api.json
 */
async function getPlayerInfoInGame(uuid) {
    return await baseActGet(
        `/user/info-in-game/${uuid}`,
        null,
        'infos'
    )
}

export {
    getPlayerInfoInGame
};