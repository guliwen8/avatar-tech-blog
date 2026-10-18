"use client";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
const KEY = "avatar-consult-draft";
export function ConsultDraft({ email, url }: { email?: string; url?: string }) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    try {
      setText(localStorage.getItem(KEY) || "");
    } catch {}
  }, []);
  function update(value: string) {
    setText(value);
    setMessage("");
    try {
      localStorage.setItem(KEY, value);
    } catch {
      setMessage("当前浏览器无法保存草稿，请复制后自行保留。");
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("问题已复制，可发送给阿凡达。");
    } catch {
      setMessage("无法自动复制，请选中上方文字手动复制。");
    }
  }
  return (
    <div className="consult-card">
      <h2>
        <Icon name="chat" />
        整理你的问题
      </h2>
      <label htmlFor="consult-question">问题描述</label>
      <textarea
        id="consult-question"
        value={text}
        onChange={(e) => update(e.target.value)}
        placeholder="描述你遇到的问题、设备与系统、已经尝试的方法。请勿填写密码或密钥。"
        maxLength={8000}
      />
      <div className="consult-form-footer">
        <p>草稿只保存在当前浏览器，不会自动发送。</p>
        <button
          className="primary-button"
          disabled={!text.trim()}
          onClick={copy}
        >
          复制问题 <Icon name="arrow" size={16} />
        </button>
      </div>
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
      {(email || url) && (
        <div className="consult-contact">
          {email && (
            <a
              href={`mailto:${email}?subject=${encodeURIComponent("博客技术咨询")}&body=${encodeURIComponent(text)}`}
            >
              通过邮件联系
            </a>
          )}
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer">
              打开咨询渠道 <Icon name="arrow" size={16} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
