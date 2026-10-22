# TB_11

Public static configuration for the Taobao Double 11 Shortcuts workflow.

## Current mobile campaign
- Campaign: 双11超级红包 (wireless/mobile).
- Taobao mobile short link: `https://m.tb.cn/h.jduXz45`.
- Wireless link shown by Taobao Alliance: `https://s.click.taobao.com/OpBavOi`.
- The workflow uses the mobile short code `jduXz45` in the existing `taobao://m.tb.cn/h.` scheme.
- Taobao Alliance UI stated that short links are valid for 300 days and full TaoKouling for 30 days; regenerate after expiry.

## Files
- `config/1111.json` — primary config.
- `scripts/tb.txt` — primary task builder.
- `config/1111-backup.json` — alternate config.
- `scripts/mtbjs.js` — alternate task builder, migrated from the inspected Tencent response.

## Raw URLs
- Main config: `https://raw.githubusercontent.com/JamesAlaHZS/TB_11/main/config/1111.json`
- Main script: `https://raw.githubusercontent.com/JamesAlaHZS/TB_11/main/scripts/tb.txt`
- Backup config: `https://raw.githubusercontent.com/JamesAlaHZS/TB_11/main/config/1111-backup.json`
- Backup script: `https://raw.githubusercontent.com/JamesAlaHZS/TB_11/main/scripts/mtbjs.js`

The backup is on the same GitHub host and is not independent disaster recovery. No credentials or tokens should be stored here. Check Taobao Alliance rules and test the generated links on a device before use.
