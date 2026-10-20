#!/usr/bin/env python3
"""Sinh Shortcut "Gửi vào Crucible" — hiện ở nút Chia sẻ của TikTok / Facebook.

    python3 scripts/build-share-shortcut.py "https://domain" "TOKEN" "Gui vao Crucible.shortcut"

Luồng: Share Sheet -> /api/video/share/prepare (tiêu đề + đề tài)
       -> popup chọn đề tài -> /api/video/share/labels -> popup chọn nhãn con
       -> popup sửa tiêu đề -> /api/video/share (ghi + server tự tải về Drive).

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

# Phải trùng từng ký tự với NEW_LABEL trong src/lib/videoShare.ts.
NEW_LABEL = "＋ Nhãn mới…"

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


def if_block(var, condition, body, string=None):
    """condition: 100 = có giá trị, 4 = bằng chuỗi `string`."""
    gid = str(uuid.uuid4()).upper()
    params = {
        "GroupingIdentifier": gid,
        "WFControlFlowMode": 0,
        "WFCondition": condition,
        "WFInput": {"Type": "Variable", "Variable": attach_var(var)},
    }
    if string is not None:
        params["WFConditionalActionString"] = string
    return [
        act("is.workflow.actions.conditional", params),
        *body,
        act("is.workflow.actions.conditional", {"GroupingIdentifier": gid, "WFControlFlowMode": 2}),
    ]


actions = [
    # 1. Link từ nút Chia sẻ. Có app đưa cả đoạn chữ — server tự tách lại lần nữa.
    act("is.workflow.actions.detect.link", {"WFInput": SHORTCUT_INPUT}),
    set_var("Link"),

    # 2. Hỏi server: tiêu đề (đã bỏ #) và danh sách đề tài. Chưa ghi gì cả.
    post_json("/api/video/share/prepare", [("url", tok_var_string("Link"))]),
    set_var("Info"),

    # 3. Lỗi (sai token, không thấy link…) thì báo rồi dừng — đừng bắt người
    #    dùng đi qua ba popup để rồi mới biết.
    get_key("Info", "error"),
    set_var("Err"),
    *if_block("Err", 100, [
        act("is.workflow.actions.alert", {
            "WFAlertActionTitle": "Crucible",
            "WFAlertActionMessage": tok_var_string("Err"),
            "WFAlertActionCancelButtonShown": False,
        }),
        act("is.workflow.actions.exit"),
    ]),

    # 4. Popup 1 — đề tài (thư mục trên Drive).
    get_key("Info", "topics"),
    act("is.workflow.actions.choosefromlist", {"WFChooseFromListActionPrompt": "Đề tài"}),
    set_var("Topic"),

    # 5. Popup 2 — nhãn con đã dùng trong đề tài đó, cộng "không nhãn" / "nhãn mới".
    post_json("/api/video/share/labels", [("topic", tok_var_string("Topic"))]),
    set_var("Labels"),
    get_key("Labels", "choices"),
    act("is.workflow.actions.choosefromlist", {"WFChooseFromListActionPrompt": "Nhãn con"}),
    set_var("Sub"),
    *if_block("Sub", 4, [
        act("is.workflow.actions.ask", {
            "WFAskActionPrompt": "Tên nhãn mới",
            "WFInputType": "Text",
        }),
        set_var("Sub"),
    ], string=NEW_LABEL),

    # 6. Popup 3 — tiêu đề, điền sẵn tiêu đề video đã bỏ hashtag.
    get_key("Info", "title"),
    set_var("AutoTitle"),
    act("is.workflow.actions.ask", {
        "WFAskActionPrompt": "Tiêu đề",
        "WFInputType": "Text",
        "WFAskActionDefaultAnswer": tok_var_string("AutoTitle"),
    }),
    set_var("Title"),

    # 7. Ghi vào hàng đợi; server trả lời ngay rồi tự tải video về Drive.
    get_key("Info", "sourceUrl"),
    set_var("Source"),
    post_json("/api/video/share", [
        ("sourceUrl", tok_var_string("Source")),
        ("topic", tok_var_string("Topic")),
        ("subTopic", tok_var_string("Sub")),
        ("title", tok_var_string("Title")),
    ]),
    set_var("Result"),
    get_key("Result", "message"),
    set_var("Message"),
    act("is.workflow.actions.shownotification", {
        "WFNotificationActionTitle": "Crucible",
        "WFNotificationActionBody": tok_var_string("Message"),
        "WFNotificationActionSound": True,
    }),
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
