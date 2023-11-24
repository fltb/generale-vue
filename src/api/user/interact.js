import { baseActPost } from "../fetch"
import store from "../../store/index"

async function addFriend(uuid, description) {
    await baseActPost(
        `/user/add-friend/${uuid}?token=${store.state.global.token}`,
        { description: description }
    )
}