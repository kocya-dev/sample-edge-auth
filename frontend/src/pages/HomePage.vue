<script setup lang="ts">
// トップページ（ログイン成功画面）
</script>

<template>
  <div class="container">
    <h1>🎉 ログイン成功</h1>
    <p>cognito-at-edge による認証が正常に完了しました。</p>

    <div class="actions">
      <RouterLink class="nav" to="/testPage">testPage</RouterLink>
      <a class="signout" href="/signout">Sign out</a>
    </div>

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
