# Cài bộ thiết kế lại "Sương sớm" vào crucible-os

1. Giải nén vào **gốc repo** `crucible-os` (cùng cấp `AGENTS.md`). Sẽ có:
   - `.claude/agents/crucible-ui-redesigner.md` — subagent thiết kế lại từng màn
   - `.claude/agents/crucible-trend-scout.md` — subagent đọc hệ thống + tra xu hướng UI/UX
   - `.claude/skills/suong-som-design/SKILL.md` — design system v4
   - `docs/redesign-plan-suong-som.md` — kế hoạch theo màn
   - `docs/trends/` — báo cáo xu hướng (đã có bản 17/11 từ 8 pin, đã duyệt)
   - `1991-new-design/demo/suong-som/pins-17-11.html` — demo 6 pattern đã duyệt, mở bằng trình duyệt để xem
2. Commit lên `main` để mọi worktree đều có.
3. Mở Claude Code trong VS Code tại thư mục repo, gõ `/agents` để thấy hai agent.
   Trend-scout cần quyền WebSearch/WebFetch — Claude Code sẽ hỏi lần đầu, chọn cho phép.

## Cách giao việc

**Tra xu hướng và nhận gợi ý:**
> Dùng agent crucible-trend-scout rà soát xu hướng UI/UX hiện nay cho Crucible

Nó đọc code + tài liệu, tìm ≥ 8 góc xu hướng, chấm điểm theo độ hợp với
Crucible, ghi báo cáo vào `docs/trends/` và gợi ý 3 việc nên làm. Không sửa code.
Nên chạy lại mỗi 1–2 tháng.

**Thiết kế lại một màn:**
> Dùng agent crucible-ui-redesigner làm mục P0 trong docs/redesign-plan-suong-som.md

Nó làm demo rồi dừng chờ duyệt. Duyệt xong nhắn "duyệt, sửa code".

Các mục ghi "(demo đã duyệt)" — P1b, P1c, P11, P12 — agent làm thẳng vào code theo demo, không hỏi lại.

Thứ tự khuyên dùng: P0 (token) → P1 + P1b + P1c (vỏ giao diện) → P11 → P2 → P3 → P12 → các mục còn lại.
Câu giao việc mẫu:
> Dùng agent crucible-ui-redesigner làm P1b trong docs/redesign-plan-suong-som.md
