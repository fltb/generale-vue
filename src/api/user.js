// login, logout, guest login, register.

/**
 * 
 * @param {String} url 
 * @param {Object} body 
 * @param {String} wanted - name of wanted data Or null
 * @returns 
 */
async function baseAct(url, body, wanted) {
    /**
     * response: { // 200 OK
     *      status: "success" || "failed"
     *      `${wanted}`: String - only exist when success
     *      message: String - only exist when fail
     * }
     */
    const response = await fetch(
        url, {
        method: "post",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json;charset=UTF-8",
        },
        body: JSON.stringify(body)
    });
    if (response.status !== 200) {
        // Non-server errors.
        throw new Error(`${response.status} error when fetching!`);
    }
    const json = await response.json();
    switch (json.status) {
        case "failed":
            throw new Error(json.message); break;
        case "success":
            if (wanted) {
                return json[wanted];
            }
        default:
            throw new Error(`Unknown status ${json.status}`)
    }

}

async function login(username, password) {
    return await baseAct('/user/login', {
        username: username,
        password, password
    }, "token");
}

async function guestLogin(username) {
    return await baseAct('/user/guest-login', {
        username: username
    }, "token");
}

async function register(username, password) {
    return await baseAct('user/register', {
        username: username,
        password: password
    }, null)
}

export default {
    login,
    guestLogin,
    register
};