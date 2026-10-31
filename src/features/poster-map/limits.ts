// DB の check 制約・関数（supabase/migrations/*_poster_map.sql）と揃えること
export const NOTE_MAX_LENGTH = 500;
export const DISPLAY_NAME_MAX_LENGTH = 20;
export const HISTORY_LIMIT = 50;

/** 一度にまとめて予約できる掲示板の数（supabase/migrations/*_bulk_reserve.sql と揃える） */
export const BULK_RESERVE_MAX = 30;
