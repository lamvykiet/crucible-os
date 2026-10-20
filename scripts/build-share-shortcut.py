#!/usr/bin/env python3
"""Sinh Shortcut "Gửi vào Crucible" — hiện ở nút Chia sẻ của TikTok / Facebook.

    python3 scripts/build-share-shortcut.py "https://domain" "TOKEN" "Gui vao Crucible.shortcut"

Luồng: Share Sheet -> /api/video/share/prepare (đổi token lấy `formUrl` có vé)
       -> Show Web Page: trang /video-share nổi ngay trên TikTok, chọn đề tài,
          nhãn con, tiêu đề tự điền -> Lưu (server tự tải về Drive).

Cố tình không có khối "If" và không có popup gốc nào: bản đầu dùng ba popup
"Choose from List" + "If", và một action sai mã định danh là iOS từ chối chạy
CẢ shortcut ("Tác vụ không xác định"). Ít action là ít chỗ hỏng.

Mã định danh action đã đối chiếu với Cherri (github.com/electrikmilk/cherri,
actions/web.cherri, basic.cherri) ngày 20/10/2026 — đừng đoán: Show
Notification là `notification`, KHÔNG phải `shownotification`.

File sinh ra chứa token — đừng commit, đừng gửi ai. iOS 15 trở đi chỉ nhập
được file ĐÃ KÝ; trên macOS script tự gọi `shortcuts sign`.
"""
import os
import plistlib
import subprocess
import sys
import time
import uuid

DOMAIN = (sys.argv[1] if len(sys.argv) > 1 else "https://DOI-THANH-DOMAIN-CUA-BAN").rstrip("/")
TOKEN = sys.argv[2] if len(sys.argv) > 2 else "DAN-VIDEO_UPLOAD_TOKEN-VAO-DAY"
OUT = sys.argv[3] if len(sys.argv) > 3 else "Gui vao Crucible.shortcut"

OBJ = "￼"  # OBJECT REPLACEMENT CHARACTER — chỗ cắm biến trong chuỗi


def tok_string(s):
    return {"Value": {"string": s}, "WFSerializationType": "WFTextTokenString"}


def tok_var_string(name):
    """Chuỗi chỉ chứa đúng một biến."""
    return {
        "Value": {
            "string": OBJ,
            "attachmentsByRange": {"{0, 1}": {"Type": "Variable", "VariableName": name}},
        },
        "WFSerializationType": "WFTextTokenString",
    }


def attach_var(name):
    return {
        "Value": {"Type": "Variable", "VariableName": name},
        "WFSerializationType": "WFTextTokenAttachment",
    }


SHORTCUT_INPUT = {"Value": {"Type": "ExtensionInput"}, "WFSerializationType": "WFTextTokenAttachment"}


def dict_field(pairs):
    return {
        "Value": {
            "WFDictionaryFieldValueItems": [
                {"WFItemType": 0, "WFKey": tok_string(k), "WFValue": v} for k, v in pairs
            ]
        },
        "WFSerializationType": "WFDictionaryFieldValue",
    }


def act(identifier, params=None):
    return {
        "WFWorkflowActionIdentifier": identifier,
        "WFWorkflowActionParameters": {"UUID": str(uuid.uuid4()).upper(), **(params or {})},
    }


AUTH = dict_field([("Authorization", tok_string(f"Bearer {TOKEN}"))])


def post_json(path, pairs):
    return act("is.workflow.actions.downloadurl", {
        "WFURL": f"{DOMAIN}{path}",
        "WFHTTPMethod": "POST",
        "ShowHeaders": True,
        "WFHTTPHeaders": AUTH,
        "WFHTTPBodyType": "JSON",
        "WFJSONValues": dict_field(pairs),
    })


def get_key(var, key):
    return act("is.workflow.actions.getvalueforkey", {
        "WFInput": attach_var(var),
        "WFDictionaryKey": key,
        "WFGetDictionaryValueType": "Value",
    })


def set_var(name):
    return act("is.workflow.actions.setvariable", {"WFVariableName": name})


actions = [
    # 1. Link từ nút Chia sẻ. Có app đưa cả đoạn chữ — server tự tách lại lần nữa.
    act("is.workflow.actions.detect.link", {"WFInput": SHORTCUT_INPUT}),
    set_var("Link"),

    # 2. Đổi token lấy trang form. Lỗi (sai token, không thấy link) cũng trả
    #    `formUrl` — trỏ tới trang báo lỗi — nên không cần khối If.
    post_json("/api/video/share/prepare", [("url", tok_var_string("Link"))]),
    set_var("Info"),
    get_key("Info", "formUrl"),
    set_var("FormURL"),

    # 3. Mở form ngay trên TikTok. Bấm "Xong" là quay lại video.
    act("is.workflow.actions.showwebpage", {"WFURL": tok_var_string("FormURL")}),
]

workflow = {
    "WFWorkflowClientVersion": "3000",
    "WFWorkflowMinimumClientVersion": 900,
    "WFWorkflowMinimumClientVersionString": "900",
    "WFWorkflowHasOutputFallback": False,
    "WFWorkflowHasShortcutInputVariables": True,
    "WFWorkflowIcon": {
        "WFWorkflowIconStartColor": 4251333119,  # cam đất
        "WFWorkflowIconGlyphNumber": 59511,      # biểu tượng video
    },
    "WFWorkflowImportQuestions": [],
    # Hiện trong Share Sheet, nhận link hoặc đoạn chữ có link.
    "WFWorkflowTypes": ["ActionExtension"],
    "WFWorkflowInputContentItemClasses": ["WFURLContentItem", "WFStringContentItem"],
    "WFWorkflowActions": actions,
    "WFQuickActionSurfaces": [],
}

# `shortcuts sign` chỉ nhận file đuôi .shortcut — đuôi khác báo "isn't in the
# correct format" dù nội dung đúng.
unsigned = OUT[: -len(".shortcut")] + ".unsigned.shortcut" if OUT.endswith(".shortcut") else OUT + ".unsigned.shortcut"
with open(unsigned, "wb") as f:
    plistlib.dump(workflow, f, fmt=plistlib.FMT_BINARY)

# Dịch vụ ký của Apple thỉnh thoảng trả "Failed to modify some records" rồi lần
# sau lại chạy (đo 20/10/2026) — thử lại vài lần trước khi bỏ cuộc.
detail = ""
for attempt in range(3):
    try:
        subprocess.run(
            ["shortcuts", "sign", "--mode", "anyone", "--input", unsigned, "--output", OUT],
            check=True, capture_output=True, text=True, timeout=120,
        )
        os.remove(unsigned)
        print(f"đã ghi {OUT} (đã ký, {len(actions)} action)")
        sys.exit(0)
    except FileNotFoundError:
        detail = "không có lệnh `shortcuts` (chỉ có trên macOS 12+)"
        break
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as err:
        detail = (getattr(err, "stderr", "") or str(err)).strip()
        time.sleep(3)

os.replace(unsigned, OUT)
print(f"đã ghi {OUT} ({len(actions)} action) — CHƯA KÝ: {detail}")
print("iOS 15+ không nhập được file chưa ký; dựng tay theo docs/shortcut-tai-video.md.")
