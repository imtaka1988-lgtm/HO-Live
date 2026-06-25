
const mysql = require('mysql2/promise');
require('dotenv').config({path:'/var/www/haiou-api/.env'});

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    database: process.env.DB_NAME || 'haiou_live',
    user: process.env.DB_USER || 'haiou_app',
    password: process.env.DB_PASS || '',
    waitForConnections: true, connectionLimit: 5,
  });

  const updates = [
    ['\u4e3b\u7ebf\u8def\uff08HLS\uff09', '\u9ad8\u6e05\u6a21\u5f0f'],
    ['\u5907\u7528\u7ebf\u8def\uff08HLS\uff09', '\u6807\u6e05\u7ebf\u8def'],
    ['\u5907\u7528\u7ebf\u8def\uff08HLS\uff09', '\u9ad8\u6e05\u7ebf\u8def'],
    ['\u6781\u901f\u7ebf\u8def\uff08FLV\uff09', '\u6781\u901f\u6a21\u5f0f'],
    ['\u5907\u7528\u7ebf\u8def\uff08HLS\uff09', '\u5907\u7528\u7ebf\u8def'],
  ];

  for (const [newName, oldName] of updates) {
    const [r] = await pool.query('UPDATE room_streams SET name = ? WHERE name = ?', [newName, oldName]);
    console.log(oldName + ' -> ' + newName + ': ' + r.affectedRows + ' rows');
  }

  const [rows] = await pool.query('SELECT id, name FROM room_streams ORDER BY id');
  rows.forEach(r => console.log(r.id, r.name));
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });

