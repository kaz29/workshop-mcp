import * as path from 'path';
import { config } from 'dotenv';

// Claude Desktop はリポジトリ以外のディレクトリから起動するので、
// カレントディレクトリではなくこのファイルの場所を基準に .env を探す。
// quiet: true にしないと dotenv が stdout にログを出し、stdio の通信が壊れる。
config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
