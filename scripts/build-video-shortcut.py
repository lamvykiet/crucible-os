#!/usr/bin/env python3
"""Sinh file .shortcut cho luồng: đọc hàng đợi -> tải -> đẩy lên Drive."""
import plistlib
import sys
import uuid

DOMAIN = sys.argv[1] if len(sys.argv) > 1 else "https://DOI-THANH-DOMAIN-CUA-BAN"
TOKEN = sys.argv[2] if len(sys.argv) > 2 else "DAN-VIDEO_UPLOAD_TOKEN-VAO-DAY"
OUT = sys.argv[3] if len(sys.argv) > 3 else "Crucible.shortcut"

OBJ = "￼"  # OBJECT REPLACEMENT CHARACTER — chỗ cắm biến trong chuỗi


def tok_string(s):
    """Chuỗi thuần."""
    return {"Value": {"string": s}, "WFSerializationType": "WFTextTokenString"}


def tok_var_string(name):
    """Chuỗi chỉ chứa đúng một biến (dùng cho value trong dictionary/form)."""
    return {
        "Value": {
            "string": OBJ,
            "attachmentsByRange": {"{0, 1}": {"Type": "Variable", "VariableName": name}},
        },
        "WFSerializationType": "WFTextTokenString",
    }


def attach_var(name):
    """Tham chiếu biến cho các tham số nhận đối tượng (WFInput, WFURL)."""
    return {
        "Value": {"Type": "Variable", "VariableName": name},
        "WFSerializationType": "WFTextTokenAttachment",
    }


def dict_field(pairs):
    """pairs: list các (key:str, value:dict đã serialize)."""
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


AUTH = [("Authorization", tok_string(f"Bearer {TOKEN}"))]
repeat_gid = str(uuid.uuid4()).upper()

actions = [
    # 1. Hỏi server: có video nào đang chờ không?
    act("is.workflow.actions.downloadurl", {
        "WFURL": f"{DOMAIN}/api/video/pending",
        "WFHTTPMethod": "GET",
        "ShowHeaders": True,
        "WFHTTPHeaders": dict_field(AUTH),
    }),

    # 2. Lấy mảng `items`. Mảng rỗng => vòng lặp dưới không chạy lần nào,
    #    nên không cần khối If nào để xử lý hàng đợi trống.
    act("is.workflow.actions.getvalueforkey", {
        "WFDictionaryKey": "items",
        "WFGetDictionaryValueType": "Value",
    }),

    # 3. Lặp qua từng video
    act("is.workflow.actions.repeat.each", {
        "WFControlFlowMode": 0,
        "GroupingIdentifier": repeat_gid,
    }),

    #    3a. Link tải trực tiếp (server đã giải sẵn qua fdown.vn)
    act("is.workflow.actions.getvalueforkey", {
        "WFInput": attach_var("Repeat Item"),
        "WFDictionaryKey": "downloadUrl",
        "WFGetDictionaryValueType": "Value",
    }),
    act("is.workflow.actions.setvariable", {"WFVariableName": "VideoURL"}),

    #    3b. Link gốc — upload cần nó để tra ra đề tài đã chọn trên web
    act("is.workflow.actions.getvalueforkey", {
        "WFInput": attach_var("Repeat Item"),
        "WFDictionaryKey": "sourceUrl",
        "WFGetDictionaryValueType": "Value",
    }),
    act("is.workflow.actions.setvariable", {"WFVariableName": "SourceURL"}),

    #    3c. Tải file về máy
    act("is.workflow.actions.downloadurl", {
        "WFURL": attach_var("VideoURL"),
        "WFHTTPMethod": "GET",
    }),
    act("is.workflow.actions.setvariable", {"WFVariableName": "VideoFile"}),

    #    3d. Đẩy lên server -> Drive, và đánh dấu bản ghi là đã lưu
    act("is.workflow.actions.downloadurl", {
        "WFURL": f"{DOMAIN}/api/video/upload",
        "WFHTTPMethod": "POST",
        "ShowHeaders": True,
        "WFHTTPHeaders": dict_field(AUTH),
        "WFHTTPBodyType": "Form",
        "WFFormValues": dict_field([
            ("file", tok_var_string("VideoFile")),
            ("sourceUrl", tok_var_string("SourceURL")),
        ]),
    }),

    # 4. Hết vòng lặp
    act("is.workflow.actions.repeat.each", {
        "WFControlFlowMode": 2,
        "GroupingIdentifier": repeat_gid,
    }),

    # 5. Báo xong
    act("is.workflow.actions.shownotification", {
        "WFNotificationActionTitle": "Crucible",
        "WFNotificationActionBody": "Đã xử lý xong hàng đợi video.",
        "WFNotificationActionSound": True,
    }),
]

workflow = {
    "WFWorkflowClientVersion": "3000",
    "WFWorkflowMinimumClientVersion": 900,
    "WFWorkflowMinimumClientVersionString": "900",
    "WFWorkflowHasOutputFallback": False,
    "WFWorkflowHasShortcutInputVariables": False,
    "WFWorkflowIcon": {
        "WFWorkflowIconStartColor": 946986751,  # xanh dương
        "WFWorkflowIconGlyphNumber": 59511,     # biểu tượng video
    },
    "WFWorkflowImportQuestions": [],
    "WFWorkflowInputContentItemClasses": [],
    "WFWorkflowTypes": [],
    "WFWorkflowActions": actions,
    "WFQuickActionSurfaces": [],
}

with open(OUT, "wb") as f:
    plistlib.dump(workflow, f, fmt=plistlib.FMT_BINARY)

print(f"đã ghi {OUT} ({len(actions)} action)")
