/**
 * @async
 * @param {String} url - start from '/', domains are already added
 * @param {String} method - method
 * @param {Object} body 
 * @param {String} wanted - name of wanted data Or null
 * @returns {Promise<String>}
 */
async function baseAct(url, method, body, wanted) {
    /**
     * response: { // 200 OK
     *      status: "success" || "failed"
     *      `${wanted}`: String - only exist when success
     *      message: String - only exist when fail
     * }
     */
    const response = await fetch(
        `${import.meta.env.VITE_BASE_URL}${url}`, {
        method: method,
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

/**
 * @async
 * @param {String} url - start from '/', domains are already added
 * @param {Object} body 
 * @param {String} wanted - name of wanted data Or null
 * @returns {Promise<String>}
 */
async function baseActPost(url, body, wanted) {
    return await baseAct(url, "post", body, wanted)
}

/**
 * @async
 * @param {String} url - start from '/', domains are already added
 * @param {Object} body 
 * @param {String} wanted - name of wanted data Or null
 * @returns {Promise<String>}
 */
async function baseActGet(url, body, wanted) {
    return await baseAct(url, "get", body, wanted)
}

export {
    baseActPost,
    baseActGet
};
