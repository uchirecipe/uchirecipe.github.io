/**
 * 本番サイトを一時的に「準備中」表示に差し替えるフラグ。
 * FREE_LIMIT_ENABLED と同じ運用: コードはmainにあってもフラグで隠す。
 * trueにしてbuild+mainへpushすると本番が準備中ページになり、
 * falseに戻してbuild+pushすると通常のアプリに戻る（データは一切変更しない）。
 */
export const MAINTENANCE_MODE = false
