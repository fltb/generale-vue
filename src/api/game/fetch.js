import store from '../../store/index';
import { baseActPost } from '../fetch';

/**
 * @async
 * @param {String} id - number in string 
 * @param {Object} setting - object, not json string
 * @returns {Promise<Object>} - object of changed setting
 */
async function postRoomSettingChange(id, setting) {
    return await baseActPost(
        `/game/${id}?act=room-setting&token=${store.state.global.token}`,
        setting,
        'updated'
    )
}
/**
 * 
 * @param {String} id - number in string 
 * @param {String} message - message wanna send 
 */

async function postChatMessage(id, message) {
    await baseActPost(
        `/game/${id}?act=post-chat-message&token=${store.state.global.token}`, {
        message: message
    })
}

export {
    postChatMessage,
    postRoomSettingChange
}