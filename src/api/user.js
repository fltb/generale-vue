// login, logout, guest login, register.
import { baseActPost } from './fetch'

/**
 * @async
 * @param {String} username 
 * @param {String} password 
 * @returns {Promise<String>} - token
 */
async function login(username, password) {
    return await baseActPost('/user/login', {
        username: username,
        password, password
    }, "token");
}

/**
 * @async
 * @param {String} username 
 * @returns {Promise<String>} -token
 */
async function guestLogin(username) {
    return await baseActPost('/user/guest-login', {
        username: username
    }, "token");
}

/**
 * @async
 * @param {String} username 
 * @param {String} password 
 * @returns {Promise}
 */
async function register(username, password) {
    return await baseActPost('/user/register', {
        username: username,
        password: password
    })
}

export default {
    login,
    guestLogin,
    register
};