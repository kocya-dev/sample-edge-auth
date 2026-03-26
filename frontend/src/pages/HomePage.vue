<script setup lang="ts">
import { computed, ref } from "vue";

// トップページ（ログイン成功画面）

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

const popupMessageType = "sample-edge-auth:cloudfront-auth-complete";
const authStatus = ref("");
const isAuthenticating = ref(false);

const cloudFrontOrigin = computed(() => {
  if (!apiBaseUrl) {
    return "";
  }

  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return "";
  }
});

const needsCloudFrontPopupAuth = computed(
  () => window.location.origin.startsWith("http://localhost") || window.location.origin.startsWith("https://localhost"),
);

function buildApiUrl(path: string): string {
  if (!apiBaseUrl) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl}${normalizedPath}`;
}

function openAuthPopup(targetUrl: string): Window | null {
  const popup = window.open("about:blank", "sample-edge-auth-login", "popup=yes,width=520,height=720");
  if (!popup) {
    return null;
  }

  popup.name = window.location.origin;
  popup.location.href = targetUrl;
  return popup;
}

async function authenticateWithCloudFront(): Promise<void> {
  if (!needsCloudFrontPopupAuth.value) {
    authStatus.value = "CloudFront 配下で表示中のため、追加認証は不要です。";
    return;
  }

  if (!cloudFrontOrigin.value) {
    throw new Error("CloudFront の URL が設定されていません。");
  }

  if (isAuthenticating.value) {
    return;
  }

  isAuthenticating.value = true;
  authStatus.value = "CloudFront で認証しています...";

  try {
    await new Promise<void>((resolve, reject) => {
      const popup = openAuthPopup(`${cloudFrontOrigin.value}/auth-popup-complete.html`);
      if (!popup) {
        reject(new Error("ポップアップを開けませんでした。"));
        return;
      }

      const timer = window.setInterval(() => {
        if (!popup.closed) {
          return;
        }

        window.clearInterval(timer);
        window.removeEventListener("message", onMessage);
        reject(new Error("認証完了前にポップアップが閉じられました。"));
      }, 500);

      const onMessage = (event: MessageEvent) => {
        if (event.origin !== cloudFrontOrigin.value) {
          return;
        }

        if (event.data?.type !== popupMessageType) {
          return;
        }

        window.clearInterval(timer);
        window.removeEventListener("message", onMessage);
        popup.close();
        resolve();
      };

      window.addEventListener("message", onMessage);
    });

    authStatus.value = "CloudFront の認証 Cookie を取得しました。";
  } finally {
    isAuthenticating.value = false;
  }
}

async function callApi() {
  try {
    const res = await fetch(buildApiUrl("/api"), {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const body = await res.text();
    alert(`Status: ${res.status}\nBody: ${body}`);
  } catch (e) {
    alert(`通信エラー: ${e}`);
  }
}
</script>

<template>
  <div class="container">
    <h1>🎉 ログイン成功</h1>
    <p>cognito-at-edge による認証が正常に完了しました。</p>

    <div class="actions">
      <RouterLink class="nav" to="/testPage">testPage</RouterLink>
      <button v-if="needsCloudFrontPopupAuth" class="nav" :disabled="isAuthenticating" @click="authenticateWithCloudFront">
        {{ isAuthenticating ? "Authenticating..." : "CloudFront Login" }}
      </button>
      <button class="nav" @click="callApi">API Call</button>
      <a class="signout" href="/signout">Sign out</a>
    </div>

    <p v-if="authStatus" class="status">{{ authStatus }}</p>

    <div class="info">
      <p>この画面が表示されている場合、以下が正常に動作しています：</p>
      <ul>
        <li>CloudFront からの配信</li>
        <li>Lambda@Edge での認証処理</li>
        <li>Cognito User Pool との連携</li>
        <li>セキュアな Cookie によるトークン管理</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 600px;
  margin: 50px auto;
  padding: 20px;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  text-align: center;
}

h1 {
  color: #2c3e50;
  margin-bottom: 20px;
}

p {
  color: #555;
  line-height: 1.6;
}

.actions {
  margin-top: 18px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.nav {
  display: inline-block;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #b0d4f1;
  background-color: #f0f8ff;
  color: #2c3e50;
  text-decoration: none;
}

.nav:hover {
  filter: brightness(0.98);
}

.nav:disabled {
  opacity: 0.7;
  cursor: wait;
}

.signout {
  display: inline-block;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #b0d4f1;
  background-color: #f0f8ff;
  color: #2c3e50;
  text-decoration: none;
}

.signout:hover {
  filter: brightness(0.98);
}

.status {
  margin-top: 14px;
  color: #2c3e50;
}

.info {
  background-color: #f0f8ff;
  border: 1px solid #b0d4f1;
  border-radius: 8px;
  padding: 20px;
  margin-top: 30px;
  text-align: left;
}

.info ul {
  margin: 10px 0 0 20px;
  color: #333;
}

.info li {
  margin: 8px 0;
}
</style>
