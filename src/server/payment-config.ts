import type Database from "better-sqlite3";
import { getSettings, setSetting } from "./repo";
import { fileIdFromUrl } from "./private-files";

/**
 * 收款码配置。
 *
 * 只把文件 ID 存进 settings（几十字节），图片本体在 private_files，
 * 通过 /api/files/<id> 提供。否则 getSettings() 全量加载会把图片塞进每次页面渲染。
 */

export interface PaymentConfig {
  wechatFileId: string;
  alipayFileId: string;
  enabled: boolean;
  /** 支付页上给用户的说明（如“转账请务必备注付款码”） */
  notice: string;
}

const KEYS = {
  wechat: "payWechatFileId",
  alipay: "payAlipayFileId",
  enabled: "payEnabled",
  notice: "payNotice",
} as const;

export const DEFAULT_PAY_NOTICE =
  "转账时请务必在备注里填写下方付款码，否则无法自动对上你的订单。";

export function getPaymentConfig(_db: Database.Database): PaymentConfig {
  const s = getSettings();
  return {
    wechatFileId: s[KEYS.wechat] || "",
    alipayFileId: s[KEYS.alipay] || "",
    enabled: s[KEYS.enabled] === "1",
    notice: s[KEYS.notice] || DEFAULT_PAY_NOTICE,
  };
}

/** 给前端用：把文件 ID 转成可访问的图片地址。 */
export function publicPaymentConfig(db: Database.Database) {
  const c = getPaymentConfig(db);
  return {
    enabled: c.enabled,
    notice: c.notice,
    wechatQr: c.wechatFileId ? "/api/files/" + c.wechatFileId : "",
    alipayQr: c.alipayFileId ? "/api/files/" + c.alipayFileId : "",
  };
}

export function savePaymentConfig(
  db: Database.Database,
  input: unknown,
): PaymentConfig {
  if (!input || typeof input !== "object") throw new Error("收款配置格式不正确");
  const r = input as Record<string, unknown>;
  // 允许传文件地址或裸 ID，统一存 ID
  const idOf = (v: unknown) => {
    if (typeof v !== "string" || !v.trim()) return "";
    return fileIdFromUrl(v.trim()) || (v.trim().length === 36 ? v.trim() : "");
  };
  const wechat = idOf(r.wechatQr ?? r.wechatFileId);
  const alipay = idOf(r.alipayQr ?? r.alipayFileId);
  const enabled = r.enabled === true;
  if (enabled && !wechat && !alipay)
    throw new Error("启用收款前请至少上传一张收款码");

  const notice = String(r.notice ?? DEFAULT_PAY_NOTICE).trim().slice(0, 300);

  setSetting(KEYS.wechat, wechat);
  setSetting(KEYS.alipay, alipay);
  setSetting(KEYS.enabled, enabled ? "1" : "0");
  setSetting(KEYS.notice, notice);

  return getPaymentConfig(db);
}
