import { createEffect, createSignal } from "solid-js";
import { Input, Select } from "~/ui";
import { useT } from "~/i18n/useT";

export interface BombermanRoomFilter {
  roomName?: string;
  status?: "all" | "lobby" | "playing";
  hasPassword?: "all" | "yes" | "no";
  sortBy?: "playerCount" | "roomName";
  sortOrder?: "asc" | "desc";
}

interface RoomFilterProps {
  value: BombermanRoomFilter;
  onChange: (next: BombermanRoomFilter) => void;
}

export function RoomFilter(props: RoomFilterProps) {
  const { t } = useT();
  const [local, setLocal] = createSignal<BombermanRoomFilter>(props.value);
  let timer: ReturnType<typeof setTimeout>;

  createEffect(() => setLocal(props.value));

  function emit(next: BombermanRoomFilter) {
    clearTimeout(timer);
    timer = setTimeout(() => props.onChange(next), 250);
  }

  return (
    <div class="flex flex-wrap gap-2 items-end mb-4">
      <Input
        size="sm"
        placeholder={t("bomberman.filterByName")}
        value={local().roomName ?? ""}
        onInput={(e) => {
          const v = (e.target as HTMLInputElement).value;
          const next = { ...local(), roomName: v || undefined };
          setLocal(next);
          emit(next);
        }}
      />
      <Select
        size="sm"
        value={local().status ?? "all"}
        onChange={(e) => {
          const v = (e.target as HTMLSelectElement).value;
          const next = { ...local(), status: v as BombermanRoomFilter["status"] };
          setLocal(next);
          emit(next);
        }}
      >
        <option value="all">{t("bomberman.allStatus")}</option>
        <option value="lobby">{t("bomberman.lobby")}</option>
        <option value="playing">{t("bomberman.playing")}</option>
      </Select>
      <Select
        size="sm"
        value={local().hasPassword ?? "all"}
        onChange={(e) => {
          const v = (e.target as HTMLSelectElement).value;
          const next = { ...local(), hasPassword: v as BombermanRoomFilter["hasPassword"] };
          setLocal(next);
          emit(next);
        }}
      >
        <option value="all">{t("bomberman.allRooms")}</option>
        <option value="no">{t("bomberman.unlocked")}</option>
        <option value="yes">{t("bomberman.locked")}</option>
      </Select>
    </div>
  );
}
